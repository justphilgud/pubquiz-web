"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ContentSearchControls from "@/app/components/content/ContentSearchControls";
import {
  getStoryElementScopeLabel,
  getStoryElementStatusLabel,
  getStoryElementTypeLabel,
  type StoryElementScopeValue,
  type StoryElementStatusValue,
  type StoryElementType,
  type StoryQuestionRelationshipValue,
} from "./storyElement";
import {
  linkQuestionStoryElement,
  reorderQuestionStoryElements,
  unlinkQuestionStoryElement,
} from "./questionActions";

type StoryOption = {
  id: number;
  title: string;
  description: string | null;
  type: StoryElementType;
  status: StoryElementStatusValue;
  scope?: StoryElementScopeValue;
  eventSeriesName: string | null;
};

type StoryLink = StoryOption & { relationship: StoryQuestionRelationshipValue };

export default function QuestionStoryElementPanel({
  questionId,
  links,
  options,
  canEdit,
}: {
  questionId: number;
  links: StoryLink[];
  options: StoryOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const filteredOptions = options.filter((option) =>
    `${option.id} ${option.title} ${option.description ?? ""} ${getStoryElementTypeLabel(option.type)}`
      .toLocaleLowerCase("de-DE")
      .includes(query.trim().toLocaleLowerCase("de-DE")),
  );
  const newStoryHref = `/story-elemente/new?questionId=${questionId}&returnTo=/fragen/editor/${questionId}`;

  function run(action: () => Promise<{ success: boolean; message?: string }>) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) setMessage(result.message ?? "Verknüpfung konnte nicht gespeichert werden.");
      else router.refresh();
    });
  }

  function move(storyElementIdToMove: number, direction: -1 | 1) {
    const currentIndex = links.findIndex((link) => link.id === storyElementIdToMove);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= links.length) return;
    const ids = links.map((link) => link.id);
    [ids[currentIndex], ids[targetIndex]] = [ids[targetIndex], ids[currentIndex]];
    run(() => reorderQuestionStoryElements({ questionId, storyElementIds: ids }));
  }

  return (
    <section className="mx-auto mb-10 w-full max-w-4xl rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-slate-950 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Redaktionelle Beziehung</p><h2 className="mt-1 text-xl font-black">Story-Elemente</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Story-Elemente sind unbewertete Inhalte wie Anekdoten, Bilder, Zitate, Audio oder Video.</p></div>
        {canEdit && <Link target="_blank" href={newStoryHref} className="inline-flex min-h-11 items-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-950">Neues Story-Element</Link>}
      </div>

      <div className="mt-4 space-y-2">
        {links.map((link, index) => (
          <article key={link.id} className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><strong className="break-words">{link.title}</strong><p className="text-xs text-slate-500">Content-ID #{link.id} · {getStoryElementTypeLabel(link.type)} · {getStoryElementStatusLabel(link.status)}{link.eventSeriesName ? ` · ${link.eventSeriesName}` : ""}</p>{link.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{link.description}</p>}</div>
            <div className="flex flex-wrap gap-2"><Link target="_blank" href={`/story-elemente/${link.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold">Vorschau</Link>{canEdit && <><button type="button" disabled={pending || index === 0} onClick={() => move(link.id, -1)} className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold disabled:opacity-40" aria-label={`${link.title} nach oben`}>↑</button><button type="button" disabled={pending || index === links.length - 1} onClick={() => move(link.id, 1)} className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold disabled:opacity-40" aria-label={`${link.title} nach unten`}>↓</button><button type="button" disabled={pending} onClick={() => run(() => unlinkQuestionStoryElement({ questionId, storyElementId: link.id }))} className="min-h-10 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50">Verknüpfung lösen</button></>}</div>
          </article>
        ))}
        {links.length === 0 && <p className="rounded-xl border border-dashed border-emerald-300 bg-white/70 p-4 text-sm text-slate-600">Zu dieser Frage sind keine Story-Elemente verknüpft.</p>}
      </div>

      {canEdit && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3">
          <ContentSearchControls query={query} placeholder="Story-Elemente durchsuchen …" onQueryChange={setQuery} onSubmit={() => undefined} />
          <div className="mt-3 space-y-2" aria-live="polite">
            {filteredOptions.map((option) => <article key={option.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><strong className="break-words">{option.title}</strong><p className="mt-1 text-xs text-slate-500">Content-ID #{option.id} · {getStoryElementTypeLabel(option.type)} · {getStoryElementStatusLabel(option.status)}{option.scope ? ` · ${getStoryElementScopeLabel(option.scope)}` : ""}</p>{option.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{option.description}</p>}</div><button type="button" disabled={pending} onClick={() => run(() => linkQuestionStoryElement({ questionId, storyElementId: option.id }))} className="min-h-11 shrink-0 rounded-xl bg-emerald-800 px-4 font-bold text-white disabled:opacity-50">Verknüpfen</button></article>)}
          </div>
          {filteredOptions.length === 0 && <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600"><p>Keine passenden Story-Elemente gefunden.</p><div className="mt-2 flex flex-wrap gap-3"><button type="button" onClick={() => setQuery("")} className="font-bold underline">Filter zurücksetzen</button><Link target="_blank" href={newStoryHref} className="font-bold underline">Neues Story-Element erstellen</Link></div></div>}
        </div>
      )}
      {message && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{message}</p>}
    </section>
  );
}
