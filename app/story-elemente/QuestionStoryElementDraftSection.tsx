"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ContentSearchControls from "@/app/components/content/ContentSearchControls";
import {
  getStoryElementStatusLabel,
  getStoryElementTypeLabel,
  getStoryQuestionRelationshipLabel,
  PRODUCTIVE_STORY_QUESTION_RELATIONSHIPS,
  type StoryElementScopeValue,
  type StoryElementStatusValue,
  type StoryElementType,
  type StoryQuestionRelationshipValue,
} from "./storyElement";

export type QuestionStoryElementDraftOption = {
  id: number;
  title: string;
  description: string | null;
  type: StoryElementType;
  status: StoryElementStatusValue;
  scope: StoryElementScopeValue;
  eventSeriesId: number | null;
  eventSeriesName: string | null;
};

export type QuestionStoryElementDraftLink = {
  storyElementId: number;
  relationship: StoryQuestionRelationshipValue;
};

export default function QuestionStoryElementDraftSection({
  options,
  links,
  questionScope,
  questionEventSeriesIds,
  disabled,
  onChange,
}: {
  options: QuestionStoryElementDraftOption[];
  links: QuestionStoryElementDraftLink[];
  questionScope: "GLOBAL" | "EVENT_SERIES";
  questionEventSeriesIds: number[];
  disabled: boolean;
  onChange: (links: QuestionStoryElementDraftLink[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [storyElementId, setStoryElementId] = useState("");
  const [relationship, setRelationship] = useState<StoryQuestionRelationshipValue>("AFTER_SOLUTION");
  const eligible = useMemo(() => options.filter((option) =>
    !links.some((link) => link.storyElementId === option.id) &&
    (option.scope === "GLOBAL" ||
      (questionScope === "EVENT_SERIES" && option.eventSeriesId !== null && questionEventSeriesIds.includes(option.eventSeriesId))) &&
    `${option.title} ${option.description ?? ""} ${getStoryElementTypeLabel(option.type)}`.toLocaleLowerCase("de-DE").includes(query.trim().toLocaleLowerCase("de-DE")),
  ), [links, options, query, questionEventSeriesIds, questionScope]);
  const selectedLinks = links.flatMap((link) => {
    const option = options.find((candidate) => candidate.id === link.storyElementId);
    return option ? [{ ...option, relationship: link.relationship }] : [];
  });

  function add() {
    const id = Number(storyElementId);
    if (!eligible.some((option) => option.id === id)) return;
    onChange([...links, { storyElementId: id, relationship }]);
    setStoryElementId("");
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Story-Elemente</h2><p className="mt-1 text-sm text-slate-600">Story-Elemente sind unbewertete Inhalte wie Anekdoten, Bilder, Zitate, Audio oder Video.</p></div><Link href="/story-elemente/new" target="_blank" className="inline-flex min-h-11 items-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-950">Neues Story-Element anlegen</Link></div>
      <div className="mt-4 space-y-2">{selectedLinks.map((link, index) => <article key={link.id} className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><strong>{link.title}</strong><p className="text-xs text-slate-500">{getStoryElementTypeLabel(link.type)} · {getStoryElementStatusLabel(link.status)} · {getStoryQuestionRelationshipLabel(link.relationship)}</p></div><div className="flex flex-wrap gap-2"><Link href={`/story-elemente/${link.id}`} target="_blank" className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold">Vorschau</Link><button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} className="min-h-10 rounded-xl border border-slate-300 px-3 disabled:opacity-40" aria-label={`${link.title} nach oben`}>↑</button><button type="button" disabled={disabled || index === selectedLinks.length - 1} onClick={() => move(index, 1)} className="min-h-10 rounded-xl border border-slate-300 px-3 disabled:opacity-40" aria-label={`${link.title} nach unten`}>↓</button><button type="button" disabled={disabled} onClick={() => onChange(links.filter((candidate) => candidate.storyElementId !== link.id))} className="min-h-10 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50">Entfernen</button></div></article>)}{selectedLinks.length === 0 && <p className="rounded-xl border border-dashed border-emerald-300 bg-white/70 p-4 text-sm text-slate-600">Zu dieser Frage sind keine Story-Elemente verknüpft.</p>}</div>
      <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3"><ContentSearchControls query={query} placeholder="Story-Elemente durchsuchen …" onQueryChange={setQuery} onSubmit={() => undefined} /><div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(190px,0.7fr)_auto]"><select aria-label="Story-Element auswählen" value={storyElementId} onChange={(event) => setStoryElementId(event.target.value)} disabled={disabled} className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-3"><option value="">Story-Element auswählen</option>{eligible.map((option) => <option key={option.id} value={option.id}>{option.title} · {getStoryElementTypeLabel(option.type)}{option.status === "DRAFT" ? " · eigener Entwurf" : ""}</option>)}</select><select aria-label="Beziehungsart" value={relationship} onChange={(event) => setRelationship(event.target.value as StoryQuestionRelationshipValue)} disabled={disabled} className="min-h-11 rounded-xl border border-slate-300 px-3">{PRODUCTIVE_STORY_QUESTION_RELATIONSHIPS.map((value) => <option key={value} value={value}>{getStoryQuestionRelationshipLabel(value)}</option>)}</select><button type="button" onClick={add} disabled={disabled || !storyElementId} className="min-h-11 rounded-xl bg-emerald-800 px-4 font-bold text-white disabled:opacity-50">Hinzufügen</button></div>{eligible.length === 0 && <p className="mt-3 text-sm text-slate-500">Keine passenden Story-Elemente. Suche zurücksetzen oder ein neues Element in einem zweiten Tab anlegen.</p>}</div>
    </section>
  );
}
