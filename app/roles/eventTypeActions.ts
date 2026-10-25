"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
import { isEventType, type EventType } from "./eventTypes";
import { logRoleAudit } from "./roleAudit.server";
import { syncLegacyQuizRoles } from "./eventTypeWrites.server";

/** Old open matrix clients cannot mutate the replacement series-role model. */
export async function saveEventTypeMatrix(_userId: number, _input: unknown) {
  await requireAdmin();
  void _userId; void _input;
  return { success: false, message: "Bitte Benutzer bearbeiten und dort Rollen je Eventreihe pflegen." };
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
      const roles = await tx.benutzer_reihenrollen.findMany({ where: { eventreihe_id: eventSeriesId }, select: { benutzer_id: true } });
      for (const role of roles) await syncLegacyQuizRoles(tx, role.benutzer_id, Number(user.id));
    }
    return { success: true, message: enabled ? "Eventart aktiviert. Erhaltene Rollenzuweisungen gelten wieder." : "Eventart deaktiviert. Inhalte und Rollenzuweisungen bleiben erhalten; ihr Zugriff ist gesperrt." };
  // Quiz activation projects the same large series assignments as the user form.
  }, { isolationLevel: "ReadCommitted", timeout: 30_000 });
  if (result.success) logRoleAudit("event_type_changed", { eventSeriesId, eventType, enabled, assignedById: Number(user.id) });
  revalidatePath(`/admin/eventreihen/${eventSeriesId}`); revalidatePath("/admin/users");
  return result;
}
