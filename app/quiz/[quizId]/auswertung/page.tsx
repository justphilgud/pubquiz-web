import {
  getQuizAuswertungAlleAntworten,
  getQuizPunktestand,
  getQuizPraesentation,
} from "../../actions";

import { requireQuizAdmin } from "../../quizAccess.server";
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
  await requireQuizAdmin(Number(quizId));
  await searchParams;

  const quiz = await getQuizPraesentation(Number(quizId));

  if (!quiz) {
    return <div className="p-10 text-xl font-bold">Quiz nicht gefunden</div>;
  }

  const alleAntworten = await getQuizAuswertungAlleAntworten(Number(quizId));
  const punktestand = await getQuizPunktestand(Number(quizId));

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
          antworten={alleAntworten}
          punktestand={punktestand}
        />
      </div>
    </main>
  );
}
