import type { Metadata } from "next";
import { PublicQuestionSubmissionForm } from "./PublicQuestionSubmissionForm";

export const metadata: Metadata = {
  title: "Quizfrage einreichen | ungegoogelt",
  description: "Reiche deine eigene Pubquiz-Frage zur redaktionellen Prüfung ein.",
};

export default function PublicQuestionSubmissionPage() {
  return (
    <main className="min-h-screen bg-[#f5f2ea] px-4 py-8 text-slate-950 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-600">ungegoogelt</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Welche Frage fehlt noch?</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-700 sm:text-lg">
            Schick uns eine kluge, überraschende oder herrlich unnütze Quizfrage. Jede Einreichung wird redaktionell geprüft und erst danach für Quizabende freigegeben.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <PublicQuestionSubmissionForm />
        </section>

        <section id="datenschutz" className="mt-6 rounded-2xl border border-slate-300 bg-white/70 p-4 text-sm leading-6 text-slate-700">
          <h2 className="font-bold text-slate-950">Datenschutzhinweis</h2>
          <p className="mt-1">
            Die Frage und ihre Lösung werden für die redaktionelle Prüfung gespeichert. Name und E-Mail sind freiwillig, dienen ausschließlich möglichen Rückfragen und werden nicht in Quiz oder Präsentation ausgegeben.
          </p>
          <a className="mt-2 inline-block font-semibold underline" href="#datenschutz">Hinweis dauerhaft verlinken</a>
        </section>
      </div>
    </main>
  );
}
