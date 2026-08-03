import Link from "next/link";
import { Suspense } from "react";
import ContentSearch from "./ContentSearch";
import type { ContentInitialType, ContentQuizOption } from "./contentLibrary";

export default function ContentWorkspace({ initialType, quizzes }: { initialType?: ContentInitialType; quizzes: ContentQuizOption[] }) {
  const heading = initialType === "QUESTION" ? "Fragen" : initialType === "STORY_ELEMENT" ? "Story-Elemente" : "Content";
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 md:px-8"><div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">Content</p><h1 className="mt-1 text-3xl font-black">{heading}</h1><p className="mt-2 max-w-3xl text-slate-600">Fragen und nicht bewertete Story-Elemente gemeinsam suchen, pflegen und Quizzen zuordnen.</p></div><Link href="/content/new" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 py-2 font-bold text-white">Neuen Inhalt erstellen</Link></header>
    <div className="flex flex-wrap gap-2 text-sm font-semibold"><Link href="/fragen/editor" className="min-h-11 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-cyan-950">Direkt: neue Frage</Link><Link href="/story-elemente/new" className="min-h-11 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-emerald-950">Direkt: neues Story-Element</Link></div>
    <Suspense fallback={<div className="rounded-2xl bg-white p-6">Inhaltssuche wird geladen …</div>}><ContentSearch initialType={initialType} quizzes={quizzes} /></Suspense>
  </div></main>;
}
