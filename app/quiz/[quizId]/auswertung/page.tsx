import { getQuizAuswertungPageData } from "../../actions";
import QuizAuswertungClient from "./QuizAuswertungClient";

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

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
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
        />
      </div>
    </main>
  );
}
