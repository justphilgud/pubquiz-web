import {
  archiveQuiz,
  getQuizDetails,
  restoreQuiz,
  copyQuiz
} from "../actions";

import {
  ArchiveBoxIcon,
  DocumentDuplicateIcon,
  LockOpenIcon,
  PlayIcon,
  ArrowLeftIcon,
  MegaphoneIcon,
  UsersIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

import { requireAdmin } from "@/app/lib/permissions";
import Link from "next/link";
import QuizFragenSortableTable from "./QuizFragenSortableTable";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function QuizDetailPage({
  params,
}: Props) {
  await requireAdmin();
  const { quizId } = await params;

  const quiz = await getQuizDetails(Number(quizId));

  if (!quiz) {
    return (
      <div className="p-10 text-xl font-bold">
        Quiz nicht gefunden
      </div>
    );
  }

  const quizIdValue = quiz.quiz_id;
  const quizTitelValue = quiz.titel;

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

  async function copyAction() {
    "use server";

    await copyQuiz({
      quizId: quizIdValue,
      neuerTitel: `${quizTitelValue} (Kopie)`,
    });
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {quiz.titel}
            </h1>

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

            <form action={copyAction}>
              <button
                type="submit"
                title="Quiz kopieren"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white p-3 text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <DocumentDuplicateIcon className="h-5 w-5" />
              </button>
            </form>

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

            <a
              href={`/quiz/${quiz.quiz_id}/praesentation`}
              target="_blank"
              rel="noopener noreferrer"
              title="Präsentieren"
              className="inline-flex items-center justify-center rounded-xl border border-cyan-300 bg-white p-3 text-cyan-700 shadow-sm transition hover:bg-cyan-50"
            >
              <PlayIcon className="h-5 w-5" />
            </a>
            <a
              href={`/quiz/${quiz.quiz_id}/moderation`}
              target="_blank"
              rel="noopener noreferrer"
              title="Moderation"
              className="inline-flex items-center justify-center rounded-xl border border-violet-300 bg-white p-3 text-violet-700 shadow-sm transition hover:bg-violet-50"
            >
              <MegaphoneIcon className="h-5 w-5" />
            </a>

            <a
              href={`/quiz/${quiz.quiz_id}/antworten`}
              target="_blank"
              rel="noopener noreferrer"
              title="Antwortformular"
              className="inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-white p-3 text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              <UsersIcon className="h-5 w-5" />
            </a>

            <a
              href={`/quiz/${quiz.quiz_id}/auswertung`}
              target="_blank"
              rel="noopener noreferrer"
              title="Auswertung"
              className="inline-flex items-center justify-center rounded-xl border border-yellow-300 bg-white p-3 text-yellow-700 shadow-sm transition hover:bg-yellow-50"
            >
              <ChartBarIcon className="h-5 w-5" />
            </a>
          </div>
        </div>

        <QuizFragenSortableTable
          quizId={quiz.quiz_id}
          fragen={quiz.fragen}
          abschnitte={quiz.abschnitte}
        />
      </div>
    </main>
  );
}
