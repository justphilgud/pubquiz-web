import { EVENT_TYPES } from "./eventTypes";
import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";

/** Compatibility projection only. Authorization never reads legacy series rows. */
export async function syncLegacyQuizRoles(tx: Prisma.TransactionClient, userId: number, assignedById: number) {
  await tx.$queryRaw`SELECT set_config('pubquiz.event_type_projection', 'on', true)`;
  // Keep already-deployed Preview clients consistent, without accepting their old matrix writes.
  const stored = await tx.benutzer_reihenrollen.findMany({ where: { benutzer_id: userId } });
  await tx.benutzer_eventartrollen.deleteMany({ where: { benutzer_id: userId, eventart: { in: EVENT_TYPES.map(t => t.id) }, eventreihe_id: { notIn: stored.map(r => r.eventreihe_id) } } });
  for (const row of stored) for (const type of EVENT_TYPES) await tx.benutzer_eventartrollen.upsert({
    where: { benutzer_id_eventreihe_id_eventart: { benutzer_id: userId, eventreihe_id: row.eventreihe_id, eventart: type.id } },
    create: { benutzer_id: userId, eventreihe_id: row.eventreihe_id, eventart: type.id, rolle: row.rolle, zugewiesen_von_user_id: row.zugewiesen_von_user_id, created_at: row.created_at, updated_at: row.updated_at },
    update: { rolle: row.rolle, zugewiesen_von_user_id: row.zugewiesen_von_user_id },
  });
  const roles = await tx.benutzer_reihenrollen.findMany({
    where: { benutzer_id: userId, eventreihe: { eventarten: { some: { eventart: "QUIZ", ist_freigeschaltet: true } } } },
  });
  const ids = roles.map(row => row.eventreihe_id);
  await tx.benutzer_rollenzuweisungen.deleteMany({ where: { benutzer_id: userId, scope_typ: "EVENT_SERIES", eventreihe_id: { notIn: ids } } });
  await tx.eventreihe_benutzerrollen.deleteMany({ where: { benutzer_id: userId, eventreihe_id: { notIn: ids } } });
  for (const row of roles) {
    const existing = await tx.benutzer_rollenzuweisungen.findFirst({ where: { benutzer_id: userId, eventreihe_id: row.eventreihe_id, scope_typ: "EVENT_SERIES" } });
    if (!existing) await tx.benutzer_rollenzuweisungen.create({ data: {
      benutzer_id: userId, eventreihe_id: row.eventreihe_id, scope_typ: "EVENT_SERIES", rolle: row.rolle,
      zugewiesen_von_user_id: assignedById, created_at: row.created_at, updated_at: row.updated_at,
    } });
    else if (existing.rolle !== row.rolle) await tx.benutzer_rollenzuweisungen.update({
      where: { rollenzuweisung_id: existing.rollenzuweisung_id }, data: { rolle: row.rolle, zugewiesen_von_user_id: assignedById },
    });
    await tx.eventreihe_benutzerrollen.upsert({
      where: { benutzer_id_eventreihe_id: { benutzer_id: userId, eventreihe_id: row.eventreihe_id } },
      create: { benutzer_id: userId, eventreihe_id: row.eventreihe_id, rolle: row.rolle === "EDITOR" ? "EVENT_EDITOR" : "EVENT_MANAGER", zugewiesen_von_user_id: assignedById, created_at: row.created_at, updated_at: row.updated_at },
      update: { rolle: row.rolle === "EDITOR" ? "EVENT_EDITOR" : "EVENT_MANAGER", zugewiesen_von_user_id: assignedById },
    });
  }
}
