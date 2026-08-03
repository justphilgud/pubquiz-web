import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { resolveQuizTemplates } from "@/app/rendering/resolveQuizTemplates.server";
import { getQuizPraesentation } from "../../actions";
import { requireQuizViewer } from "../../quizAccess.server";
import AblaufEditor from "./AblaufEditor";
import { getActorForSession } from "@/app/roles/roleAssignments.server";
import { listSelectableStoryElementsForQuiz } from "@/app/story-elemente/storyElementRepository.server";
import { synchronizeQuizBlockQuestionItems } from "@/app/quiz/flow/quizFlowRepository.server";

type Props = { params: Promise<{ quizId: string }> };

export default async function QuizAblaufPage({ params }: Props) {
  const { quizId: rawQuizId } = await params;
  const quizId = Number(rawQuizId);
  if (!Number.isInteger(quizId)) notFound();
  const access = await requireQuizViewer(quizId);
  const actor = await getActorForSession(access.session);
  if (!access.quiz.ist_archiviert) {
    await synchronizeQuizBlockQuestionItems(quizId);
  }
  const [quiz, templates, storyElements] = await Promise.all([
    getQuizPraesentation(quizId),
    resolveQuizTemplates(quizId),
    listSelectableStoryElementsForQuiz(actor, quizId),
  ]);
  if (!quiz || !templates) notFound();

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Ablauf</p>
              <h1 className="mt-1 break-words text-3xl font-black">{quiz.titel ?? `Quiz ${quizId}`}</h1>
              <p className="mt-2 max-w-3xl text-slate-600">Nicht-Frage-Folien ordnen und inhaltlich konfigurieren. Fragen und Auflösungen bleiben mit der Quizpflege verbunden.</p>
            </div>
            <Link href={`/quiz/${quizId}`} className={"inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold shadow-sm"}>Zurück zum Quiz</Link>
          </div>
          {access.quiz.ist_archiviert && (
            <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Archivierte Quizze zeigen ihren Ablauf schreibgeschützt.</div>
          )}
          <AblaufEditor
            quiz={quiz}
            theme={templates.theme}
            canEdit={!access.quiz.ist_archiviert}
            storyElements={storyElements.map((story) => ({
              id: story.id,
              title: story.title,
              description: story.description,
              type: story.type,
              status: story.status,
              scope: story.scope,
              eventSeriesName: story.eventSeriesName,
              quizTitle: story.quizTitle,
              usageCount: story.usageCount,
            }))}
          />
        </div>
      </main>
    </>
  );
}
