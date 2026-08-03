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
  ClipboardDocumentListIcon,
  SwatchIcon,
  BeakerIcon,
} from "@heroicons/react/24/outline";

import { requireQuizViewer } from "../quizAccess.server";
import Link from "next/link";
import QuizFragenSortableTable from "./QuizFragenSortableTable";
import QuizFragenHinzufuegen from "./QuizFragenHinzufuegen";
import { QuizCopyDialog } from "../QuizCopyDialog";
import AppHeader from "@/app/components/AppHeader";
import { resolveQuizTemplates } from "@/app/rendering/resolveQuizTemplates.server";
import { isAdmin, requireActor } from "@/app/lib/permissions";
import {
  getQuizProductActions,
  type QuizProductActionId,
} from "../quizProductActions";

const productActionAppearance: Record<QuizProductActionId, {
  icon: typeof PlayIcon;
  className: string;
}> = {
  FLOW: { icon: ClipboardDocumentListIcon, className: "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400 hover:bg-white" },
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

  const [quiz, templates, actorContext] = await Promise.all([
    getQuizDetails(Number(quizId)),
    resolveQuizTemplates(Number(quizId)),
    requireActor(),
  ]);

  if (!quiz || !templates) {
    return (
      <div className="p-10 text-xl font-bold">
        Quiz nicht gefunden
      </div>
    );
  }

  const quizIdValue = quiz.quiz_id;
  const quizTitelValue = quiz.titel;
  const canManageTemplates = isAdmin(actorContext.actor);
  const templateStatus = ({
    SYSTEM: "Systemtemplate",
    ACTIVE: "Aktives Nutzertemplate",
    ARCHIVED: "Archiviertes Nutzertemplate",
    DRAFT: "Entwurf",
  } as Record<string, string>)[templates.presentationInfo.status] ?? templates.presentationInfo.status;
  const templateSource = templates.presentationInfo.source === "QUIZ"
    ? "Für dieses Quiz überschrieben"
    : templates.presentationInfo.source === "EVENT_SERIES"
      ? `Geerbt von Eventreihe „${templates.presentationInfo.eventSeriesName}“`
      : "Systemstandard";
  const productActions = getQuizProductActions(quiz.quiz_id);

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

        <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Quizabend</p>
              <h2 className="mt-1 text-xl font-black">Produktive Oberflächen</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {productActions.map((action) => {
                const appearance = productActionAppearance[action.id];
                const Icon = appearance.icon;
                const className = `flex min-h-20 items-center gap-3 rounded-2xl border px-4 py-3 font-bold transition ${appearance.className}`;
                return action.opensNewTab ? (
                  <a key={action.id} href={action.href} target="_blank" rel="noopener noreferrer" className={className}>
                    <Icon className="h-6 w-6" /> {action.label}
                  </a>
                ) : (
                  <Link key={action.id} href={action.href} className={className}>
                    <Icon className="h-6 w-6" /> {action.label}
                  </Link>
                );
              })}
            </div>
            {canManageTemplates && (
              <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-cyan-950 p-2 text-white">
                      <BeakerIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-black text-cyan-950">Quiz testen</p>
                      <p className="mt-1 text-sm text-cyan-900">
                        Interne Mehrflächenprüfung mit Live-State und Schnellsprüngen.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/quiz/${quiz.quiz_id}/test`}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-cyan-950 px-4 py-2 text-sm font-bold text-white"
                  >
                    Testansicht öffnen
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-slate-900 p-2 text-white"><SwatchIcon className="h-6 w-6" /></span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Effektives Präsentationstemplate</p>
                <h2 className="mt-1 break-words text-2xl font-black">{templates.presentationInfo.name}</h2>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="font-semibold text-slate-500">Herkunft</dt><dd className="font-bold text-slate-900">{templateSource}</dd></div>
              <div><dt className="font-semibold text-slate-500">Status</dt><dd className="font-bold text-slate-900">{templateStatus}</dd></div>
            </dl>
            {templates.presentationInfo.usedFallback && (
              <p role="status" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">Die gespeicherte Zuordnung war nicht verfügbar; der sichere Fallback wird verwendet.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/quiz?editQuizId=${quiz.quiz_id}`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Zuordnung ändern</Link>
              {canManageTemplates && (
                <Link href={`/templates/${encodeURIComponent(templates.presentationInfo.id)}`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Template ansehen</Link>
              )}
            </div>
          </div>
        </section>

        <section id="fragen-hinzufuegen" className="mb-6 scroll-mt-24">
          <QuizFragenHinzufuegen quizId={quiz.quiz_id} />
        </section>

        <QuizFragenSortableTable
          quizId={quiz.quiz_id}
          fragen={quiz.fragen}
          abschnitte={quiz.abschnitte}
        />
      </div>
    </main></>
  );
}
