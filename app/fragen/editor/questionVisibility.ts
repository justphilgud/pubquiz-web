import type { Prisma } from "@/app/generated/prisma/client";
import {
  canEditGlobalQuestions,
  getActorEventSeriesIds,
  isAdministrator,
  hasAnyEditorialAssignment,
  type AuthorizationActor,
} from "@/app/roles/roleAssignmentPolicy";

/** Query equivalent of canViewScopedQuestion; never use authorship as a scope grant. */
export function questionVisibilityWhere(actor: AuthorizationActor): Prisma.fragenWhereInput {
  if (isAdministrator(actor)) return {};
  if (!hasAnyEditorialAssignment(actor)) return { fragen_id: { in: [] } };
  return {
    OR: [
      { geltungsbereich: "GLOBAL", freigegeben: true },
      ...(canEditGlobalQuestions(actor)
        ? [{ geltungsbereich: "GLOBAL" as const, created_by_user_id: actor.userId }]
        : []),
      {
        geltungsbereich: "EVENT_SERIES",
        eventreihen: { some: { eventreihe_id: { in: getActorEventSeriesIds(actor) } } },
      },
    ],
  };
}

export function questionQuizUsageWhere(actor: AuthorizationActor): Prisma.quiz_fragenWhereInput {
  return isAdministrator(actor) ? {} : {
    quiz: { eventreihe_id: { in: getActorEventSeriesIds(actor, "EVENT_MANAGER") } },
  };
}
