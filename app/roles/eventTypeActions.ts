"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
import { withSerializableTransaction } from "./serializableTransaction.server";
import { EVENT_TYPES, isEventType, isEventTypeRole, type EventType, type EventTypeRole } from "./eventTypes";
import { logRoleAudit } from "./roleAudit.server";
import { syncLegacyQuizRoles } from "./eventTypeWrites.server";

export type EventTypeMatrixRow = {
  eventSeriesId: number; name: string; archived: boolean; enabled: string[];
  roles: Partial<Record<EventType, EventTypeRole>>; manageSeries: boolean;
};
export async function getEventTypeMatrix(userId: number): Promise<EventTypeMatrixRow[]> {
  await requireAdmin();
  const rows = await prisma.eventreihen.findMany({ orderBy: { name: "asc" }, include: {
    eventarten: true, eventartrollen: { where: { benutzer_id: userId } }, verwalter: { where: { benutzer_id: userId } },
  } });
  return rows.map(row => ({ eventSeriesId: row.eventreihe_id, name: row.name, archived: row.ist_archiviert,
    enabled: row.eventarten.filter(p => p.ist_freigeschaltet).map(p => p.eventart),
    roles: Object.fromEntries(row.eventartrollen.map(r => [r.eventart, r.rolle])), manageSeries: row.verwalter.length > 0,
  }));
}
export async function saveEventTypeMatrix(userId: number, input: { eventSeriesId: number; roles: Partial<Record<EventType, EventTypeRole>>; manageSeries: boolean }[]) {
  const { user } = await requireAdmin();
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Array.isArray(input) || input.length > 10000 ||
    new Set(input.map(r => r.eventSeriesId)).size !== input.length || input.some(row =>
      !Number.isSafeInteger(row.eventSeriesId) || row.eventSeriesId <= 0 || typeof row.manageSeries !== "boolean" ||
      !row.roles || Object.entries(row.roles).some(([key, value]) => !isEventType(key) || !isEventTypeRole(value)))) {
    return { success: false, message: "Ungültige Rechtezuweisung." };
  }
  await withSerializableTransaction(async tx => {
    if (!await tx.users.findUnique({ where: { id: userId }, select: { id: true } })) throw new Error("Benutzer nicht gefunden.");
    const count = await tx.eventreihen.count({ where: { eventreihe_id: { in: input.map(row => row.eventSeriesId) } } });
    if (count !== input.length) throw new Error("Eventreihe nicht gefunden.");
    for (const row of input) {
      // Submitted rows replace only these known products. Future catalogue entries are preserved.
      await tx.benutzer_eventartrollen.deleteMany({ where: { benutzer_id: userId, eventreihe_id: row.eventSeriesId, eventart: { in: EVENT_TYPES.map(t => t.id), notIn: Object.keys(row.roles) } } });
      for (const [eventart, rolle] of Object.entries(row.roles)) {
        if (!isEventType(eventart) || !isEventTypeRole(rolle)) throw new Error("Ungültige Rolle.");
        await tx.benutzer_eventartrollen.upsert({
          where: { benutzer_id_eventreihe_id_eventart: { benutzer_id: userId, eventreihe_id: row.eventSeriesId, eventart } },
          create: { benutzer_id: userId, eventreihe_id: row.eventSeriesId, eventart, rolle, zugewiesen_von_user_id: Number(user.id) },
          update: { rolle, zugewiesen_von_user_id: Number(user.id) },
        });
      }
      if (row.manageSeries) await tx.eventreihe_verwaltung.upsert({
        where: { benutzer_id_eventreihe_id: { benutzer_id: userId, eventreihe_id: row.eventSeriesId } },
        create: { benutzer_id: userId, eventreihe_id: row.eventSeriesId, zugewiesen_von_user_id: Number(user.id) }, update: {},
      });
      else await tx.eventreihe_verwaltung.deleteMany({ where: { benutzer_id: userId, eventreihe_id: row.eventSeriesId } });
    }
    await syncLegacyQuizRoles(tx, userId, Number(user.id));
  });
  logRoleAudit("role_assignment_changed", { userId, scope: "EVENT_TYPE_MATRIX", assignedById: Number(user.id) });
  revalidatePath("/admin/users"); revalidatePath("/admin/eventreihen");
  return { success: true, message: "Eventartrechte gespeichert. Nicht freigeschaltete Eventarten bleiben gesperrt." };
}
export async function setEventTypeEnabled(eventSeriesId: number, eventType: EventType, enabled: boolean) {
  const { user } = await requireAdmin();
  if (!Number.isSafeInteger(eventSeriesId) || eventSeriesId <= 0 || !isEventType(eventType) || typeof enabled !== "boolean") {
    return { success: false, message: "Ungültige Produktfreischaltung." };
  }
  // Product toggles and starts use the same per-series advisory lock. Read Committed
  // deliberately reads the latest lifecycle after waiting; Serializable could keep
  // an older snapshot from before the lock acquisition.
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(860012, ${eventSeriesId})::text`;
    const series = await tx.eventreihen.findUnique({ where: { eventreihe_id: eventSeriesId }, select: { eventreihe_id: true } });
    if (!series) return { success: false, message: "Eventreihe nicht gefunden." };
    if (eventType === "QUIZ" && !enabled) {
      // Same quiz row lock as start/navigation. Query lifecycle after acquiring every lock.
      await tx.$queryRaw`SELECT quiz_id FROM pubquiz.quiz WHERE eventreihe_id = ${eventSeriesId} ORDER BY quiz_id FOR UPDATE`;
      const running = await tx.quiz_praesentation_status.count({ where: {
        quiz: { eventreihe_id: eventSeriesId }, quiz_started_at: { not: null }, quiz_stopped_at: null,
      } });
      if (running > 0) return { success: false, message: "Quiz kann während eines laufenden Quiz nicht deaktiviert werden. Bitte den Durchlauf zuerst regulär beenden." };
    }
    await tx.eventreihe_eventarten.upsert({ where: { eventreihe_id_eventart: { eventreihe_id: eventSeriesId, eventart: eventType } },
      create: { eventreihe_id: eventSeriesId, eventart: eventType, ist_freigeschaltet: enabled }, update: { ist_freigeschaltet: enabled } });
    if (eventType === "QUIZ") {
      const roles = await tx.benutzer_eventartrollen.findMany({ where: { eventreihe_id: eventSeriesId, eventart: "QUIZ" }, select: { benutzer_id: true } });
      for (const role of roles) await syncLegacyQuizRoles(tx, role.benutzer_id, Number(user.id));
    }
    return { success: true, message: enabled ? "Eventart aktiviert. Erhaltene Rollenzuweisungen gelten wieder." : "Eventart deaktiviert. Inhalte und Rollenzuweisungen bleiben erhalten; ihr Zugriff ist gesperrt." };
  }, { isolationLevel: "ReadCommitted" });
  if (result.success) logRoleAudit("event_type_changed", { eventSeriesId, eventType, enabled, assignedById: Number(user.id) });
  revalidatePath(`/admin/eventreihen/${eventSeriesId}`); revalidatePath("/admin/users");
  return result;
}
