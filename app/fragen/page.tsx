import { prisma } from "@/app/lib/prisma";
import FragenWorkspace from "./FragenWorkspace";
import { getAktiveQuizListe } from "@/app/quiz/actions";
import { Suspense } from "react";
import Link from "next/link";
import {
  getQuestionOverviewCapabilities,
  requireQuestionEditor,
} from "@/app/lib/permissions";
import { loadOwnQuestionWorklists, loadReviewQueue } from "./questionWorklists";
import { QuestionWorklist } from "./components/QuestionWorklist";
import { ReviewQueue } from "./components/ReviewQueue";

export default async function FragenPage() {
  const session = await requireQuestionEditor();
  const capabilities = getQuestionOverviewCapabilities(session);
  const userId = Number(session.user.id);

  const ownWorklists = capabilities.canViewOwnQuestionWorklist
    ? await loadOwnQuestionWorklists(userId)
    : null;
  const reviewQueue = capabilities.canViewReviewQueue
    ? await loadReviewQueue()
    : null;

  const searchData = capabilities.canViewReviewQueue
    ? await Promise.all([
        prisma.fragenkategorie.findMany({ orderBy: { kategorie: "asc" } }),
        prisma.antworttyp.findMany({ orderBy: { antworttyp: "asc" } }),
        prisma.medientyp.findMany({ orderBy: { medientyp: "asc" } }),
        getAktiveQuizListe(),
      ])
    : null;

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
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

        {ownWorklists && (
          <div className="space-y-8">
            <QuestionWorklist
              title="Meine Entwürfe"
              description="Noch nicht zur Prüfung eingereichte Fragen."
              emptyTitle="Du hast aktuell keine Entwürfe."
              entries={ownWorklists.drafts}
              timestampLabel="Zuletzt geändert"
            />
            <QuestionWorklist
              title="Zur Prüfung eingereicht"
              description="Fertige Fragen, die auf eine Prüfung warten."
              emptyTitle="Du hast aktuell keine eingereichten Fragen."
              entries={ownWorklists.submitted}
              timestampLabel="Eingereicht"
            />
            <QuestionWorklist
              title="Zur Überarbeitung zurückgegeben"
              description="Fragen mit einem Rückgabehinweis aus der Prüfung."
              emptyTitle="Aktuell ist keine Überarbeitung erforderlich."
              entries={ownWorklists.changesRequested}
              timestampLabel="Zurückgegeben"
            />
          </div>
        )}

        {reviewQueue && <ReviewQueue entries={reviewQueue} />}

        {searchData && (
          <Suspense fallback={<div className="p-8">Lade Fragensuche...</div>}>
            <FragenWorkspace
              embedded
              defaultTab="suche"
              kategorien={searchData[0]}
              antworttypen={searchData[1]}
              medientypen={searchData[2]}
              quizze={searchData[3]}
            />
          </Suspense>
        )}
      </div>
    </main>
  );
}
