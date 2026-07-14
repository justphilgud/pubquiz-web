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

type QuestionView = "drafts" | "review" | "changes-requested";

function getQuestionView(view: string | undefined): QuestionView | null {
  if (view === "drafts" || view === "review" || view === "changes-requested") {
    return view;
  }

  return null;
}

export default async function FragenPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const view = getQuestionView(params?.view);
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

        {view && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <span className="font-medium text-slate-700">
              Gefilterte Ansicht: {view === "drafts" ? "Entwürfe" : view === "review" ? "Prüfung" : "Überarbeitung"}
            </span>
            <Link href="/fragen" className="font-semibold text-slate-700 hover:text-slate-950">
              Alle Bereiche anzeigen
            </Link>
          </div>
        )}

        {ownWorklists && (
          <div className="space-y-8">
            {(!view || view === "changes-requested") && (
              <QuestionWorklist
                title="Zur Überarbeitung zurückgegeben"
                description="Fragen mit einem Rückgabehinweis aus der Prüfung."
                emptyTitle="Aktuell ist keine Überarbeitung erforderlich."
                entries={ownWorklists.changesRequested}
                timestampLabel="Zurückgegeben"
              />
            )}
            {(!view || view === "drafts") && (
              <QuestionWorklist
                title="Meine Entwürfe"
                description="Noch nicht zur Prüfung eingereichte Fragen."
                emptyTitle="Du hast aktuell keine Entwürfe."
                entries={ownWorklists.drafts}
                timestampLabel="Zuletzt geändert"
              />
            )}
            {(!view || view === "review") && (
              <QuestionWorklist
                title="Zur Prüfung eingereicht"
                description="Fertige Fragen, die auf eine Prüfung warten."
                emptyTitle="Du hast aktuell keine eingereichten Fragen."
                entries={ownWorklists.submitted}
                timestampLabel="Eingereicht"
              />
            )}
          </div>
        )}

        {reviewQueue && (!view || view === "review") && (
          <ReviewQueue entries={reviewQueue} />
        )}

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
