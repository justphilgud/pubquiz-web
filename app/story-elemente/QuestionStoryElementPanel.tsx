"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ContentSearchControls from "@/app/components/content/ContentSearchControls";
import { getStoryElementScopeLabel, getStoryElementStatusLabel, getStoryElementTypeLabel, type StoryElementScopeValue, type StoryElementStatusValue, type StoryElementType, type StoryQuestionRelationshipValue } from "./storyElement";
import { linkQuestionStoryElement, reorderQuestionStoryElements, unlinkQuestionStoryElement } from "./questionActions";
import StoryElementCreateDialog, { type CreatedStoryElement } from "./StoryElementCreateDialog";
import type { StoryElementEditorOptions } from "./StoryElementEditor";

type StoryOption = { id: number; title: string; description: string | null; type: StoryElementType; status: StoryElementStatusValue; scope?: StoryElementScopeValue; eventSeriesName: string | null };
type StoryLink = StoryOption & { relationship: StoryQuestionRelationshipValue };

export default function QuestionStoryElementPanel({ questionId, links, options, canEdit, editorOptions }: { questionId: number; links: StoryLink[]; options: StoryOption[]; canEdit: boolean; editorOptions: StoryElementEditorOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const filteredOptions = options.filter((option) => `${option.id} ${option.title} ${option.description ?? ""} ${getStoryElementTypeLabel(option.type)}`.toLocaleLowerCase("de-DE").includes(query.trim().toLocaleLowerCase("de-DE")));

  function run(action: () => Promise<{ success: boolean; message?: string }>) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) setMessage(result.message ?? "Verknüpfung konnte nicht gespeichert werden.");
      else router.refresh();
    });
  }

  function move(id: number, direction: -1 | 1) {
    const current = links.findIndex((link) => link.id === id);
    const target = current + direction;
    if (current < 0 || target < 0 || target >= links.length) return;
    const ids = links.map((link) => link.id);
    [ids[current], ids[target]] = [ids[target], ids[current]];
    run(() => reorderQuestionStoryElements({ questionId, storyElementIds: ids }));
  }

  function linkCreated(story: CreatedStoryElement) {
    setCreateOpen(false);
    run(() => linkQuestionStoryElement({ questionId, storyElementId: story.id }));
  }

  return <details className="mx-auto mb-10 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 text-slate-950 sm:p-6">
    <summary className="min-h-11 cursor-pointer text-lg font-black">Story-Elemente ({links.length})</summary>
    <p className="mt-2 text-sm text-slate-600">Der Anzeigezeitpunkt wird vom jeweiligen Präsentationstemplate bestimmt.</p>
    {canEdit && <button type="button" onClick={() => setCreateOpen(true)} className="mt-3 min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold">Neues Story-Element</button>}
    <div className="mt-4 space-y-2">
      {links.map((link, index) => <article key={link.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><strong className="break-words">{link.title}</strong><p className="text-xs text-slate-500">{getStoryElementTypeLabel(link.type)} · {getStoryElementStatusLabel(link.status)}{link.eventSeriesName ? ` · ${link.eventSeriesName}` : ""}</p>{link.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{link.description}</p>}</div><div className="flex flex-wrap gap-2"><Link href={`/content/story-elements/${link.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold">Öffnen</Link>{canEdit && <><button type="button" disabled={pending || index === 0} onClick={() => move(link.id, -1)} className="min-h-10 rounded-xl border border-slate-300 px-3 disabled:opacity-40" aria-label={`${link.title} nach oben`}>↑</button><button type="button" disabled={pending || index === links.length - 1} onClick={() => move(link.id, 1)} className="min-h-10 rounded-xl border border-slate-300 px-3 disabled:opacity-40" aria-label={`${link.title} nach unten`}>↓</button><button type="button" disabled={pending} onClick={() => run(() => unlinkQuestionStoryElement({ questionId, storyElementId: link.id }))} className="min-h-10 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700">Lösen</button></>}</div></article>)}
      {links.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Keine Story-Elemente verknüpft.</p>}
    </div>
    {canEdit && <div className="mt-4 rounded-xl border border-slate-200 p-3"><ContentSearchControls query={query} placeholder="Story-Elemente durchsuchen …" onQueryChange={setQuery} onSubmit={() => undefined} /><div className="mt-3 space-y-2">{filteredOptions.map((option) => <article key={option.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><strong>{option.title}</strong><p className="text-xs text-slate-500">{getStoryElementTypeLabel(option.type)} · {getStoryElementStatusLabel(option.status)}{option.scope ? ` · ${getStoryElementScopeLabel(option.scope)}` : ""}</p></div><button type="button" disabled={pending} onClick={() => run(() => linkQuestionStoryElement({ questionId, storyElementId: option.id }))} className="min-h-11 rounded-xl bg-slate-950 px-4 font-bold text-white">Verknüpfen</button></article>)}</div>{filteredOptions.length === 0 && <p className="mt-3 text-sm text-slate-500">Keine passenden unverknüpften Story-Elemente.</p>}</div>}
    {message && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{message}</p>}
    <StoryElementCreateDialog open={createOpen} options={editorOptions} onClose={() => setCreateOpen(false)} onCreated={linkCreated} />
  </details>;
}
