import { getQuizAuswertungPageData } from "../../actions";
import QuizAuswertungClient from "./QuizAuswertungClient";
import { buildEvaluationMatrix } from "../../evaluation/evaluationMatrix";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
  searchParams: Promise<{
    frage?: string;
  }>;
};

export default async function QuizAuswertungPage({
  params,
  searchParams,
}: Props) {
  const { quizId } = await params;
  await searchParams;
  const { quiz, antworten, punktestand, backfillStatus } =
    await getQuizAuswertungPageData(Number(quizId));

  if (!quiz) {
    return <div className="p-10 text-xl font-bold">Quiz nicht gefunden</div>;
  }

  const matrix = buildEvaluationMatrix({
    answers: antworten.map((antwort) => ({
      quizQuestionId: antwort.quiz_fragen_id,
      questionNumber: antwort.frageIndex,
      questionText: antwort.frage,
      sectionTitle: antwort.abschnittTitel,
      maximumPointsLabel: antwort.maximumPointsLabel,
      teamName: antwort.teamname,
      isUnanswered: antwort.istUnbeantwortet,
      evaluationStatus: antwort.bewertungsstatus,
      answerText: antwort.antwortText ?? antwort.ausgewaehlteAntwort,
      correctAnswer: antwort.richtigeAntwort,
      awardedPoints: antwort.vergebenePunkte,
    })),
    ranking: punktestand,
  });

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-[96rem] space-y-6">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Auswertung
          </div>

          <h1 className="text-4xl font-black text-slate-900">{quiz.titel}</h1>
        </div>

        <QuizAuswertungClient
          quizId={quiz.quiz_id}
          antworten={antworten}
          punktestand={punktestand}
          backfillStatus={backfillStatus}
          matrix={matrix}
        />
      </div>
    </main>
  );
}
