import QuizWorkspace from "./QuizWorkspace";
import { getQuizListe, getSchnellQuizKategorien } from "./actions";

type Props = {
  searchParams: Promise<{
    passwort?: string;
    tab?: string;
  }>;
};

export default async function QuizPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const passwort = resolvedSearchParams.passwort ?? "";

  if (passwort !== process.env.AUSWERTUNG_PASSWORT) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-slate-900">
            Quizbereich geschützt
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

  const quizze = await getQuizListe();
  const kategorien = await getSchnellQuizKategorien();

  return (
    <QuizWorkspace
      quizze={quizze}
      kategorien={kategorien}
      passwort={passwort}
    />
  );
}