"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ContentSearchControls from "@/app/components/content/ContentSearchControls";
import StoryElementCreateDialog, { type CreatedStoryElement } from "./StoryElementCreateDialog";
import type { StoryElementEditorOptions } from "./StoryElementEditor";
import {
  getStoryElementStatusLabel,
  getStoryElementTypeLabel,
  getNewStoryQuestionRelationship,
  type StoryElementScopeValue,
  type StoryElementStatusValue,
  type StoryElementType,
  type StoryQuestionRelationshipValue,
} from "./storyElement";
import {
  storyPlacementFromRelationship,
  storyPlacementToRelationship,
} from "./storyPlacement";

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
  editorOptions,
}: {
  options: QuestionStoryElementDraftOption[];
  links: QuestionStoryElementDraftLink[];
  questionScope: "GLOBAL" | "EVENT_SERIES";
  questionEventSeriesIds: number[];
  disabled: boolean;
  onChange: (links: QuestionStoryElementDraftLink[]) => void;
  editorOptions: StoryElementEditorOptions;
}) {
  const [query, setQuery] = useState("");
  const [storyElementId, setStoryElementId] = useState("");
  const [createdOptions, setCreatedOptions] = useState<QuestionStoryElementDraftOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const allOptions = useMemo(() => [...options, ...createdOptions], [createdOptions, options]);
  const eligible = useMemo(() => allOptions.filter((option) =>
    !links.some((link) => link.storyElementId === option.id) &&
    (option.scope === "GLOBAL" ||
      (questionScope === "EVENT_SERIES" && option.eventSeriesId !== null && questionEventSeriesIds.includes(option.eventSeriesId))) &&
    `${option.title} ${option.description ?? ""} ${getStoryElementTypeLabel(option.type)}`.toLocaleLowerCase("de-DE").includes(query.trim().toLocaleLowerCase("de-DE")),
  ), [allOptions, links, query, questionEventSeriesIds, questionScope]);
  const selectedLinks = links.flatMap((link) => {
    const option = allOptions.find((candidate) => candidate.id === link.storyElementId);
    return option ? [{ ...option, relationship: link.relationship }] : [];
  });

  function add() {
    const id = Number(storyElementId);
    if (!eligible.some((option) => option.id === id)) return;
    onChange([...links, { storyElementId: id, relationship: getNewStoryQuestionRelationship() }]);
    setStoryElementId("");
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function addCreated(story: CreatedStoryElement) {
    setCreatedOptions((current) => [...current, story]);
    onChange([...links, { storyElementId: story.id, relationship: getNewStoryQuestionRelationship() }]);
    setCreateOpen(false);
  }

  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="min-h-11 cursor-pointer font-semibold text-slate-950">Story-Elemente ({selectedLinks.length})</summary>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3"><p className="text-sm text-slate-600">Verknüpfte, unbewertete Inhalte mit einer Standardposition vor der Frage oder nach ihrer Auflösung.</p><button type="button" onClick={() => setCreateOpen(true)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold">Neues Story-Element anlegen</button></div>
      <div className="mt-4 space-y-2">{selectedLinks.map((link, index) => <article key={link.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><strong>{link.title}</strong><p className="text-xs text-slate-500">{getStoryElementTypeLabel(link.type)} · {getStoryElementStatusLabel(link.status)}</p></div><div className="flex flex-wrap gap-2"><Link href={`/content/story-elements/${link.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold">Öffnen</Link><button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} className="min-h-10 rounded-xl border border-slate-300 px-3 disabled:opacity-40" aria-label={`${link.title} nach oben`}>↑</button><button type="button" disabled={disabled || index === selectedLinks.length - 1} onClick={() => move(index, 1)} className="min-h-10 rounded-xl border border-slate-300 px-3 disabled:opacity-40" aria-label={`${link.title} nach unten`}>↓</button><button type="button" disabled={disabled} onClick={() => onChange(links.filter((candidate) => candidate.storyElementId !== link.id))} className="min-h-10 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50">Entfernen</button></div></article>)}{selectedLinks.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Zu dieser Frage sind keine Story-Elemente verknüpft.</p>}</div>
      {selectedLinks.length > 0 && <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">{selectedLinks.map((link) => <label key={link.id} className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Standardposition für {link.title}</span><select value={storyPlacementFromRelationship(link.relationship)} disabled={disabled} onChange={(event) => onChange(links.map((candidate) => candidate.storyElementId === link.id ? { ...candidate, relationship: storyPlacementToRelationship(event.target.value as "BEFORE_QUESTION" | "AFTER_SOLUTION") } : candidate))} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 sm:max-w-sm"><option value="BEFORE_QUESTION">Vor der Frage</option><option value="AFTER_SOLUTION">Nach der Auflösung</option></select></label>)}</div>}
      <div className="mt-4 rounded-xl border border-slate-200 p-3"><ContentSearchControls query={query} placeholder="Story-Elemente durchsuchen …" onQueryChange={setQuery} onSubmit={() => undefined} /><div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"><select aria-label="Story-Element auswählen" value={storyElementId} onChange={(event) => setStoryElementId(event.target.value)} disabled={disabled} className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-3"><option value="">Story-Element auswählen</option>{eligible.map((option) => <option key={option.id} value={option.id}>{option.title} · {getStoryElementTypeLabel(option.type)}{option.status === "DRAFT" ? " · eigener Entwurf" : ""}</option>)}</select><button type="button" onClick={add} disabled={disabled || !storyElementId} className="min-h-11 rounded-xl bg-slate-950 px-4 font-bold text-white disabled:opacity-50">Hinzufügen</button></div>{eligible.length === 0 && <p className="mt-3 text-sm text-slate-500">Keine passenden unverknüpften Story-Elemente.</p>}</div>
      <StoryElementCreateDialog open={createOpen} options={editorOptions} onClose={() => setCreateOpen(false)} onCreated={addCreated} />
    </details>
  );
}
