import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/app/lib/prisma";
import FragenWorkspace from "./FragenWorkspace";
import { getAktiveQuizListe } from "@/app/quiz/actions";
import {
  getQuestionOverviewCapabilities,
  requireQuestionEditor,
} from "@/app/lib/permissions";
import { loadQuestionStatusCounts } from "./questionWorklists";
import { getEventSeriesIdsForCapability } from "@/app/eventreihen/eventSeriesAccess.server";
import { getQuestionActor } from "./editor/questionAccess.server";
import {
  getActorEventSeriesIds,
  isAdministrator,
} from "@/app/roles/roleAssignmentPolicy";
import { localizeQuestionTemplates } from "./editor/templates/questionTemplates";
import { loadQuestionEditorMessages } from "@/app/i18n/questionEditorMessages";

export default async function FragenPage() {
  const session = await requireQuestionEditor();
  const capabilities = getQuestionOverviewCapabilities(session.actor);
  const actor = await getQuestionActor(session);
  const canViewOwnWorklists =
    capabilities.canViewOwnQuestionWorklist || actor.assignments.length > 0;
  const managedEventSeriesIds = await getEventSeriesIdsForCapability(
    "REVIEW_QUESTION",
    session,
  );
  const canReview =
    isAdministrator(actor) || (managedEventSeriesIds?.length ?? 0) > 0;
  const userId = Number(session.user.id);

  const [categories, quizzes, statusCounts] = await Promise.all([
    prisma.fragenkategorie.findMany({
      where: { status: { in: ["ACTIVE", "ARCHIVED"] } },
      orderBy: { kategorie: "asc" },
    }),
    canReview ? getAktiveQuizListe() : Promise.resolve([]),
    loadQuestionStatusCounts({
      userId,
      accessibleEventSeriesIds: getActorEventSeriesIds(actor),
      managedEventSeriesIds: canReview ? managedEventSeriesIds : [],
    }),
  ]);
  const templates = localizeQuestionTemplates(
    loadQuestionEditorMessages("de"),
  )
    .filter(({ availableForFiltering }) => availableForFiltering)
    .map(({ id, name }) => ({ id, name }));
  const visibleStatusCounts = {
    ...(canViewOwnWorklists
      ? {
          MY_DRAFTS: statusCounts.MY_DRAFTS,
          MY_SUBMITTED: statusCounts.MY_SUBMITTED,
          CHANGES_REQUESTED: statusCounts.CHANGES_REQUESTED,
        }
      : {}),
    ...(canReview ? { REVIEW_QUEUE: statusCounts.REVIEW_QUEUE } : {}),
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Fragen</h1>
            <p className="mt-1 text-sm text-slate-500">
              Fragen erstellen, pflegen und zur Prüfung begleiten.
            </p>
          </div>
          <Link
            href="/fragen/editor"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
          >
            Neue Frage erstellen
          </Link>
        </header>

        <Suspense fallback={<div className="p-6">Lade Fragenfilter …</div>}>
          <FragenWorkspace
            embedded
            kategorien={categories}
            quizze={quizzes}
            templates={templates}
            statusCounts={visibleStatusCounts}
          />
        </Suspense>
      </div>
    </main>
  );
}
