import Link from "next/link";
import { Suspense } from "react";
import ContentSearch from "./ContentSearch";
import type { ContentFilterOption, ContentInitialType, ContentQuizOption } from "./contentLibrary";

export default function ContentWorkspace({ initialType, quizzes, categories, eventSeries }: { initialType?: ContentInitialType; quizzes: ContentQuizOption[]; categories: ContentFilterOption[]; eventSeries: ContentFilterOption[] }) {
  const heading = initialType === "QUESTION" ? "Fragen" : initialType === "STORY_ELEMENT" ? "Story-Elemente" : "Content";
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 md:px-8"><div className="mx-auto max-w-6xl space-y-6">
    <header><p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">Content</p><h1 className="mt-1 text-3xl font-black">{heading}</h1><p className="mt-2 max-w-3xl text-slate-600">Fragen und nicht bewertete Story-Elemente gemeinsam suchen, pflegen und Quizzen zuordnen.</p></header>
    <div className="flex flex-wrap gap-2 text-sm font-semibold"><Link href="/content/questions/new" className="min-h-11 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-cyan-950">Neue Frage</Link><Link href="/content/story-elements/new" className="min-h-11 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-emerald-950">Neues Story-Element</Link></div>
    <Suspense fallback={<div className="rounded-2xl bg-white p-6">Inhaltssuche wird geladen …</div>}><ContentSearch initialType={initialType} quizzes={quizzes} categories={categories} eventSeries={eventSeries} /></Suspense>
  </div></main>;
}
