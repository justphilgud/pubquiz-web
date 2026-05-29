import { notFound } from "next/navigation";
import { getQuizDetails } from "@/app/quiz/actions";
import { saveBekanntmachungen } from "./actions";

type Props = {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ passwort?: string }>;
};

export default async function BekanntmachungenPage({
  params,
  searchParams,
}: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const passwort = resolvedSearchParams.passwort ?? "";

  const quiz = await getQuizDetails(Number(resolvedParams.quizId));

  if (!quiz) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow">
        <div className="mb-8">
          <div className="text-sm font-black uppercase tracking-[0.3em] text-cyan-600">
            Outro
          </div>

          <h1 className="mt-2 text-4xl font-black">
            Bekanntmachungen
          </h1>
        </div>

        <form action={saveBekanntmachungen} className="space-y-6">
          <input type="hidden" name="quizId" value={quiz.quiz_id} />
          <input type="hidden" name="passwort" value={passwort} />

          <textarea
            name="bekanntmachungen"
            defaultValue={
              quiz.outro_bekanntmachungen ??
              "Danke fürs Mitspielen!\n\nNächster Quizabend:\n..."
            }
            rows={14}
            className="w-full rounded-2xl border border-slate-300 p-5 text-lg"
          />

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-2xl bg-cyan-600 px-6 py-3 font-semibold text-white"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}