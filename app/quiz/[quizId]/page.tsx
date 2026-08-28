import {
  archiveQuiz,
  getQuizDetails,
  restoreQuiz,
} from "../actions";

import {
  ArchiveBoxIcon,
  LockOpenIcon,
  PlayIcon,
  ArrowLeftIcon,
  MegaphoneIcon,
  UsersIcon,
  ChartBarIcon,
  BeakerIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";

import { requireQuizViewer } from "../quizAccess.server";
import Link from "next/link";
import QuizFragenSortableTable from "./QuizFragenSortableTable";
import QuizFragenHinzufuegen from "./QuizFragenHinzufuegen";
import { QuizCopyDialog } from "../QuizCopyDialog";
import AppHeader from "@/app/components/AppHeader";
import { isAdmin, requireActor } from "@/app/lib/permissions";
import {
  getQuizProductActions,
  type QuizProductActionId,
} from "../quizProductActions";
import { listSelectableStoryElementsForQuiz } from "@/app/story-elemente/storyElementRepository.server";
import QuizConfigurationPanel from "./QuizConfigurationPanel";
import { searchContent } from "@/app/components/content/actions";
import { parseContentFilters } from "@/app/components/content/contentLibrary";

const productActionAppearance: Record<QuizProductActionId, {
  icon: typeof PlayIcon;
  className: string;
}> = {
  MODERATION: { icon: MegaphoneIcon, className: "border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-400" },
  PRESENTATION: { icon: PlayIcon, className: "border-cyan-200 bg-cyan-50 text-cyan-900 hover:border-cyan-400" },
  ANSWER_FORM: { icon: UsersIcon, className: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400" },
  EVALUATION: { icon: ChartBarIcon, className: "border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-400" },
};

type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function QuizDetailPage({
  params,
}: Props) {
  const { quizId } = await params;
  await requireQuizViewer(Number(quizId));

  const [quiz, actorContext, pollSearch] = await Promise.all([
    getQuizDetails(Number(quizId)),
    requireActor(),
    searchContent(parseContentFilters(new URLSearchParams("contentType=POLL"))),
  ]);

  if (!quiz) {
    return (
      <div className="p-10 text-xl font-bold">
        Quiz nicht gefunden
      </div>
    );
  }

  const quizIdValue = quiz.quiz_id;
  const quizTitelValue = quiz.titel;
  const canManageTemplates = isAdmin(actorContext.actor);
  const productActions = getQuizProductActions(quiz.quiz_id);
  const selectableStories = await listSelectableStoryElementsForQuiz(
    actorContext.actor,
    quiz.quiz_id,
  );
  const questionAssignmentById = new Map(
    quiz.fragen.map((question) => [question.fragen_id, question]),
  );

  async function archiveAction() {
    "use server";

    await archiveQuiz({
      quizId: quizIdValue,
      archivierungsgrund: "Manuell archiviert",
    });
  }

  async function restoreAction() {
    "use server";

    await restoreQuiz(quizIdValue);
  }

  return (
    <><AppHeader /><main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {quiz.titel}
            </h1>

            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{quiz.eventreihe_name}</span>
              <span className={`rounded-full px-3 py-1 font-semibold ring-1 ${quiz.quiz_datum ? "bg-white ring-slate-200" : "bg-amber-50 text-amber-900 ring-amber-300"}`}>
                {quiz.quiz_datum ? `${quiz.quiz_datum}${quiz.veranstaltungszeit ? `, ${quiz.veranstaltungszeit}` : ""}` : "Datum fehlt"}
              </span>
              {quiz.veranstaltungsname && <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{quiz.veranstaltungsname}</span>}
            </div>

            {(quiz.karten_url || quiz.oeffentliche_url) && (
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                {quiz.karten_url && <a href={quiz.karten_url} target="_blank" rel="noopener noreferrer" className="underline">Route öffnen</a>}
                {quiz.oeffentliche_url && <a href={quiz.oeffentliche_url} target="_blank" rel="noopener noreferrer" className="underline">Veranstaltungsseite öffnen</a>}
              </div>
            )}

            {!quiz.quiz_datum && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                Dieses Bestandsquiz besitzt noch kein Datum. Es bleibt lesbar, muss aber vor dem nächsten Speichern in der Quizverwaltung ergänzt werden.
              </div>
            )}

            {quiz.ist_archiviert && (
              <div className="mt-3 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
                Dieses Quiz ist archiviert
                {quiz.archivierungsgrund
                  ? `: ${quiz.archivierungsgrund}`
                  : "."}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/quiz"
              title="Zur Übersicht"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white p-3 text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>

            <Link
              href={`/quiz?editQuizId=${quiz.quiz_id}`}
              title="Quiz-Einstellungen"
              aria-label="Quiz-Einstellungen öffnen"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-300 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </Link>

            {productActions.map((action) => {
              const appearance = productActionAppearance[action.id];
              const Icon = appearance.icon;
              const className = `inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border p-2 shadow-sm transition ${appearance.className}`;
              return action.opensNewTab ? (
                <a key={action.id} href={action.href} target="_blank" rel="noopener noreferrer" title={action.label} aria-label={action.label} className={className}>
                  <Icon className="h-5 w-5" />
                </a>
              ) : (
                <Link key={action.id} href={action.href} title={action.label} aria-label={action.label} className={className}>
                  <Icon className="h-5 w-5" />
                </Link>
              );
            })}

            {canManageTemplates && (
              <Link
                href={`/quiz/${quiz.quiz_id}/test`}
                title="Quiz testen"
                aria-label="Interne Testansicht öffnen"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-950 p-2 text-white shadow-sm"
              >
                <BeakerIcon className="h-5 w-5" />
              </Link>
            )}

            <QuizCopyDialog
              quizId={quizIdValue}
              quizTitle={quizTitelValue ?? `Quiz ${quizIdValue}`}
            />

            {quiz.ist_archiviert ? (
              <form action={restoreAction}>
                <button
                  type="submit"
                  title="Archivierung aufheben"
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-white p-3 text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                >
                  <LockOpenIcon className="h-5 w-5" />
                </button>
              </form>
            ) : (
              <form action={archiveAction}>
                <button
                  type="submit"
                  title="Archivieren"
                  className="inline-flex items-center justify-center rounded-xl border border-orange-300 bg-white p-3 text-orange-600 shadow-sm transition hover:bg-orange-50"
                >
                  <ArchiveBoxIcon className="h-5 w-5" />
                </button>
              </form>
            )}

          </div>
        </div>

        <section id="fragen-hinzufuegen" className="mb-6 flex scroll-mt-24 justify-end">
          <QuizFragenHinzufuegen
            quizId={quiz.quiz_id}
            polls={pollSearch.items.flatMap((item) => item.pollMetrics ? [{
              id: item.id,
              prompt: item.title,
              subtype: item.subtype,
              publicationMode: item.pollMetrics.publicationMode,
              isUsedInQuiz: item.quizUsages.some((usage) => usage.quizId === quiz.quiz_id),
              canAssign: item.assignableQuizIds.includes(quiz.quiz_id),
            }] : [])}
            storyElements={selectableStories.map((story) => {
              const linkedAssignment = story.linkedQuestion
                ? questionAssignmentById.get(story.linkedQuestion.fragen_id) ?? null
                : null;
              return {
                id: story.id,
                title: story.title,
                description: story.description,
                type: story.type,
                status: story.status,
                scope: story.scope,
                eventSeriesName: story.eventSeriesName,
                quizTitle: story.quizTitle,
                usageCount: story.usageCount,
                mediaCount: story.mediaCount,
                isUsedInQuiz: story.quizUsages.some((usage) => usage.quizId === quiz.quiz_id),
                linkedQuestion: story.linkedQuestion ? {
                  id: story.linkedQuestion.fragen_id,
                  title: story.linkedQuestion.frage,
                  isInQuiz: linkedAssignment !== null,
                  sectionId: linkedAssignment?.quiz_abschnitt_id ?? null,
                } : null,
              };
            })}
          />
        </section>

        <QuizConfigurationPanel
          quizId={quiz.quiz_id}
          initialStrategy={quiz.aufloesungsstrategie}
        />

        <QuizFragenSortableTable
          key={[
            ...quiz.fragen.map((frage) => `q${frage.quiz_fragen_id}`),
            ...quiz.standaloneStoryElements.map((story) => `s${story.placementId}-${story.quiz_abschnitt_id ?? "none"}`),
            ...quiz.standalonePolls.map((poll) => `p${poll.placementId}-${poll.quiz_abschnitt_id ?? "none"}`),
          ].join("-")}
          quizId={quiz.quiz_id}
          fragen={quiz.fragen}
          abschnitte={quiz.abschnitte}
          standaloneStories={quiz.standaloneStoryElements}
          standalonePolls={quiz.standalonePolls}
        />
      </div>
    </main></>
  );
}
