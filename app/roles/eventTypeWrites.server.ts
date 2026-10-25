import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";

/** Compatibility projection only. Authorization never reads legacy series rows. */
export async function syncLegacyQuizRoles(tx: Prisma.TransactionClient, userId: number, assignedById: number) {
  await tx.$queryRaw`SELECT set_config('pubquiz.event_type_projection', 'on', true)`;
  const roles = await tx.benutzer_eventartrollen.findMany({
    where: { benutzer_id: userId, eventart: "QUIZ", eventreihe: { eventarten: { some: { eventart: "QUIZ", ist_freigeschaltet: true } } } },
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
