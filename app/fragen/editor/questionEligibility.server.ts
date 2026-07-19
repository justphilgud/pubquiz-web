import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";

export function buildQuestionEligibilityWhere(
  eventSeriesId: number,
  now: Date,
): Prisma.fragenWhereInput {
  return {
    freigegeben: true,
    ist_archiviert: false,
    OR: [
      { geltungsbereich: "GLOBAL" },
      {
        geltungsbereich: "EVENT_SERIES",
        eventreihen: { some: { eventreihe_id: eventSeriesId } },
      },
    ],
    AND: [{ OR: [{ gueltig_bis: null }, { gueltig_bis: { gte: now } }] }],
  };
}
