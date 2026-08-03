"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ContentSearchControls from "@/app/components/content/ContentSearchControls";
import {
  getStoryElementScopeLabel,
  getStoryElementStatusLabel,
  getStoryElementTypeLabel,
  STORY_ELEMENT_TYPES,
  type StoryElementScopeValue,
  type StoryElementStatusValue,
  type StoryElementType,
} from "./storyElement";
import { addStoryElementToQuizBlock } from "@/app/quiz/[quizId]/ablauf/actions";

export type QuizStoryElementOption = {
  id: number;
  title: string;
  description: string | null;
  type: StoryElementType;
  status: StoryElementStatusValue;
  scope: StoryElementScopeValue;
  eventSeriesName: string | null;
  quizTitle: string | null;
  usageCount: number;
};

const PAGE_SIZE = 8;

export default function StoryElementQuizPicker({
  quizId,
  sectionId,
  options,
}: {
  quizId: number;
  sectionId: number;
  options: QuizStoryElementOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<StoryElementType | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => options.filter((story) =>
    (type === "ALL" || story.type === type) &&
    `${story.title} ${story.description ?? ""} ${story.eventSeriesName ?? ""} ${story.quizTitle ?? ""}`
      .toLocaleLowerCase("de-DE")
      .includes(query.trim().toLocaleLowerCase("de-DE")),
  ), [options, query, type]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((Math.min(page, pageCount) - 1) * PAGE_SIZE, Math.min(page, pageCount) * PAGE_SIZE);
  const selected = options.find((story) => story.id === selectedId);

  function add() {
    if (!selectedId) return;
    setMessage("");
    startTransition(async () => {
      const result = await addStoryElementToQuizBlock({ quizId, sectionId, storyElementId: selectedId });
      if (!result.success) setMessage(result.message);
      else {
        setMessage("Story-Element wurde in diesem Block platziert.");
        setSelectedId(null);
        router.refresh();
      }
    });
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white">Story-Element hinzufügen</button>;
  }

  return (
    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-bold">Story-Element aus der Bibliothek</h4><p className="mt-1 text-sm text-slate-600">Nicht bewerteten Inhalt wie Bild, Anekdote, Zitat, Audio oder Video auswählen.</p></div><button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold">Schließen</button></div>
      <div className="mt-3"><ContentSearchControls query={query} placeholder="Story-Elemente durchsuchen …" filterCount={type === "ALL" ? 0 : 1} filtersOpen onQueryChange={(value) => { setQuery(value); setPage(1); }} onSubmit={() => undefined} onReset={() => { setType("ALL"); setPage(1); }}><div className="mt-3 max-w-sm"><label><span className="mb-1 block text-xs font-bold text-slate-600">Typ</span><select value={type} onChange={(event) => { setType(event.target.value as StoryElementType | "ALL"); setPage(1); }} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="ALL">Alle Typen</option>{STORY_ELEMENT_TYPES.map((value) => <option key={value} value={value}>{getStoryElementTypeLabel(value)}</option>)}</select></label></div></ContentSearchControls></div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{filtered.length} Treffer</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{visible.map((story) => <button type="button" key={story.id} aria-pressed={selectedId === story.id} onClick={() => setSelectedId(story.id)} className={`min-w-0 rounded-xl border p-3 text-left transition ${selectedId === story.id ? "border-emerald-700 bg-white ring-2 ring-emerald-200" : "border-emerald-200 bg-white/80 hover:border-emerald-500"}`}><div className="flex flex-wrap gap-1.5 text-xs font-bold"><span className="rounded-full bg-emerald-100 px-2 py-1">{getStoryElementTypeLabel(story.type)}</span><span className="rounded-full bg-slate-100 px-2 py-1">{getStoryElementStatusLabel(story.status)}</span><span className="rounded-full bg-slate-100 px-2 py-1">{getStoryElementScopeLabel(story.scope)}</span></div><strong className="mt-2 block break-words">{story.title}</strong>{story.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{story.description}</p>}<p className="mt-2 text-xs text-slate-500">{story.quizTitle ?? story.eventSeriesName ?? "Global"} · {story.usageCount} Verwendungen</p></button>)}</div>
      {filtered.length === 0 && <div className="mt-3 rounded-xl border border-dashed border-emerald-300 bg-white p-4 text-sm text-slate-600"><p>Keine passenden Story-Elemente gefunden.</p><div className="mt-2 flex flex-wrap gap-3"><button type="button" onClick={() => { setQuery(""); setType("ALL"); }} className="font-bold underline">Filter zurücksetzen</button><Link href={`/story-elemente/new?quizId=${quizId}&sectionId=${sectionId}&returnTo=${encodeURIComponent(`/quiz/${quizId}/ablauf#block-${sectionId}`)}`} className="font-bold underline">Neues Story-Element erstellen</Link></div></div>}
      {pageCount > 1 && <div className="mt-3 flex items-center justify-center gap-3"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 disabled:opacity-40">Zurück</button><span className="text-sm">Seite {Math.min(page, pageCount)} von {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 disabled:opacity-40">Weiter</button></div>}
      {selected && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-300 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase text-emerald-700">Ausgewählt</p><strong>{selected.title}</strong><p className="text-xs text-slate-500">Die aktuelle Revision wird unveränderlich mit dem Block verknüpft.</p></div><div className="flex flex-wrap gap-2"><Link href={`/story-elemente/${selected.id}`} target="_blank" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 font-semibold">Vorschau</Link><button type="button" disabled={pending} onClick={add} className="min-h-11 rounded-xl bg-emerald-800 px-4 font-bold text-white disabled:opacity-50">{pending ? "Wird platziert …" : "Im Block platzieren"}</button></div></div>}
      {message && <p role="status" className="mt-3 text-sm font-semibold text-slate-700">{message}</p>}
      <div className="mt-3"><Link href={`/story-elemente/new?quizId=${quizId}&sectionId=${sectionId}&returnTo=${encodeURIComponent(`/quiz/${quizId}/ablauf#block-${sectionId}`)}`} className="text-sm font-bold text-emerald-900 underline underline-offset-2">Neues Story-Element erstellen</Link></div>
    </div>
  );
}
