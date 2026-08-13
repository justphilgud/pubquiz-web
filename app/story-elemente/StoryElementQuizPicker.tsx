"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ContentSearchControls from "@/app/components/content/ContentSearchControls";
import QuizElementSearchResult from "@/app/quiz/[quizId]/QuizElementSearchResult";
import { addStoryElementToQuizBlock } from "@/app/quiz/[quizId]/ablauf/actions";
import { addStoryElementToQuiz } from "./actions";
import {
  getStoryElementScopeLabel,
  getStoryElementStatusLabel,
  getStoryElementTypeLabel,
  STORY_ELEMENT_TYPES,
  type StoryElementScopeValue,
  type StoryElementStatusValue,
  type StoryElementType,
} from "./storyElement";

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
  mediaCount: number;
  isUsedInQuiz: boolean;
  linkedQuestion: {
    id: number;
    title: string;
    isInQuiz: boolean;
    sectionId: number | null;
  } | null;
};

const PAGE_SIZE = 8;

export default function StoryElementQuizPicker({
  quizId,
  sectionId,
  options,
  embedded = false,
}: {
  quizId: number;
  sectionId?: number;
  options: QuizStoryElementOption[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(embedded);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<StoryElementType | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [pendingStoryId, setPendingStoryId] = useState<number | null>(null);
  const [addedStoryIds, setAddedStoryIds] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => options.filter((story) =>
    (type === "ALL" || story.type === type) &&
    `${story.title} ${story.description ?? ""} ${story.eventSeriesName ?? ""} ${story.quizTitle ?? ""} ${story.linkedQuestion?.title ?? ""}`
      .toLocaleLowerCase("de-DE")
      .includes(query.trim().toLocaleLowerCase("de-DE")),
  ), [options, query, type]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function add(story: QuizStoryElementOption) {
    const targetSectionId = story.linkedQuestion?.sectionId ?? sectionId;
    if (story.isUsedInQuiz || addedStoryIds.includes(story.id)) return;
    if (story.linkedQuestion && (!story.linkedQuestion.isInQuiz || targetSectionId == null)) return;

    setMessage("");
    setPendingStoryId(story.id);
    startTransition(async () => {
      const result = targetSectionId === undefined
        ? await addStoryElementToQuiz({ quizId, storyElementId: story.id })
        : await addStoryElementToQuizBlock({
            quizId,
            sectionId: targetSectionId,
            storyElementId: story.id,
          });
      setPendingStoryId(null);
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      setAddedStoryIds((current) => [...current, story.id]);
      setMessage(story.linkedQuestion
        ? "Story-Element wurde an seiner Frage übernommen."
        : targetSectionId === undefined
          ? "Story-Element wurde unter Kein Block hinzugefügt."
          : "Story-Element wurde im Block hinzugefügt.");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white">
        Story-Element hinzufügen
      </button>
    );
  }

  return (
    <div className={embedded ? "min-w-0" : "mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4"}>
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-bold">Story-Element aus der Bibliothek</h4>
            <p className="mt-1 text-sm text-slate-600">Nicht bewerteten Inhalt auswählen und regelkonform platzieren.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold">Schließen</button>
        </div>
      )}

      <div className={embedded ? "" : "mt-3"}>
        <ContentSearchControls
          query={query}
          placeholder="Story-Elemente durchsuchen …"
          filterCount={type === "ALL" ? 0 : 1}
          filtersOpen
          onQueryChange={(value) => { setQuery(value); setPage(1); }}
          onSubmit={() => undefined}
          onReset={() => { setType("ALL"); setPage(1); }}
        >
          <div className="mt-3 max-w-sm">
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-600">Typ</span>
              <select value={type} onChange={(event) => { setType(event.target.value as StoryElementType | "ALL"); setPage(1); }} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
                <option value="ALL">Alle Typen</option>
                {STORY_ELEMENT_TYPES.map((value) => <option key={value} value={value}>{getStoryElementTypeLabel(value)}</option>)}
              </select>
            </label>
          </div>
        </ContentSearchControls>
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-700">{filtered.length} Treffer</p>
      <div className="mt-3 space-y-3">
        {visible.map((story) => {
          const isUsed = story.isUsedInQuiz || addedStoryIds.includes(story.id);
          const questionMissing = story.linkedQuestion !== null && !story.linkedQuestion.isInQuiz;
          const questionUnassigned = story.linkedQuestion?.isInQuiz === true && story.linkedQuestion.sectionId === null;
          const disabled = pending || isUsed || questionMissing || questionUnassigned;
          const actionLabel = isUsed
            ? "Bereits im Quiz"
            : questionMissing
              ? "Frage fehlt"
              : questionUnassigned
                ? "Noch nicht verwendbar"
                : pendingStoryId === story.id
                  ? "Wird hinzugefügt …"
                  : "Hinzufügen";
          return (
            <QuizElementSearchResult
              key={story.id}
              title={story.title}
              description={story.description}
              metadata={<>
                <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">{getStoryElementTypeLabel(story.type)}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{getStoryElementStatusLabel(story.status)}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{getStoryElementScopeLabel(story.scope)}</span>
                <span>{story.mediaCount === 0 ? "Keine Medien" : `${story.mediaCount} Medien`}</span>
                <span>{story.usageCount} Quiz-Verwendungen</span>
                <span>{story.linkedQuestion ? `Verknüpfte Frage: ${story.linkedQuestion.title}` : "Keine Frage verknüpft"}</span>
                {questionMissing && (
                  <span className="font-semibold text-amber-800">
                    Frage fehlt im Quiz; die gebundene Story kann nicht allein hinzugefügt werden.
                  </span>
                )}
                {(story.quizTitle || story.eventSeriesName) && <span>{story.quizTitle ?? story.eventSeriesName}</span>}
              </>}
              actionLabel={actionLabel}
              disabled={disabled}
              onAction={() => add(story)}
            />
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          <p>Keine passenden Story-Elemente gefunden.</p>
          <button type="button" onClick={() => { setQuery(""); setType("ALL"); }} className="mt-2 font-bold underline">Filter zurücksetzen</button>
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => current - 1)} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 disabled:opacity-40">Zurück</button>
          <span className="text-sm">Seite {safePage} von {pageCount}</span>
          <button type="button" disabled={safePage >= pageCount} onClick={() => setPage((current) => current + 1)} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 disabled:opacity-40">Weiter</button>
        </div>
      )}

      {message && <p role="status" className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">{message}</p>}
    </div>
  );
}
