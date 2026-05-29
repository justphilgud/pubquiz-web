import {
  getQuizAuswertungAlleAntworten,
  getQuizPunktestand,
  getQuizPraesentation,
} from "../../actions";

import QuizAuswertungClient from "./QuizAuswertungClient";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
  searchParams: Promise<{
    passwort?: string;
    frage?: string;
  }>;
};

export default async function QuizAuswertungPage({
  params,
  searchParams,
}: Props) {
  const { quizId } = await params;
  const resolvedSearchParams = await searchParams;
  const passwort = resolvedSearchParams.passwort;

  if (passwort !== process.env.AUSWERTUNG_PASSWORT) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-slate-900">
            Auswertung geschützt
          </h1>

          <form className="mt-5 space-y-4">
            <input
              name="passwort"
              type="password"
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              placeholder="Passwort"
            />

            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
            >
              Öffnen
            </button>
          </form>
        </div>
      </main>
    );
  }

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