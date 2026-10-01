"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addFrageToQuiz,
  searchFragenForQuiz,
} from "../actions";
import type { QuizFrageSuchResult } from "../actions";
import ContentSearchControls from "@/app/components/content/ContentSearchControls";
import ContentFilters from "@/app/components/content/ContentFilters";
import {
  parseContentFilters,
  type ContentFilterOption,
  type ContentFiltersState,
  type ContentTemplateOption,
} from "@/app/components/content/contentLibrary";
import StoryElementQuizPicker, {
  type QuizStoryElementOption,
} from "@/app/story-elemente/StoryElementQuizPicker";
import QuizElementSearchResult, {
  quizElementActionClass,
} from "./QuizElementSearchResult";
import { getStoryElementTypeLabel } from "@/app/story-elemente/storyElement";
import { isPollQuestionTemplateId } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { assignContentToQuiz } from "@/app/components/content/actions";

type Props = {
  quizId: number;
  storyElements: QuizStoryElementOption[];
  polls: QuizLivePollOption[];
  questionCategories: ContentFilterOption[];
  questionTemplates: ContentTemplateOption[];
};

export type QuizLivePollOption = {
  id: number;
  prompt: string;
  subtype: string;
  publicationMode: string;
  isUsedInQuiz: boolean;
  canAssign: boolean;
};

const buttonSecondaryClass =
  "rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]";

export default function QuizFragenHinzufuegen({
  quizId,
  storyElements,
  polls,
  questionCategories,
  questionTemplates,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<ContentFiltersState>(() =>
    parseContentFilters(
      new URLSearchParams("contentType=QUESTION"),
      "QUESTION",
      questionTemplates.filter((template) => template.availableForFiltering).map((template) => template.id),
    ),
  );
  const [searchResult, setSearchResult] = useState<{
    items: QuizFrageSuchResult[];
    total: number;
    hasMore: boolean;
    nextOffset: number;
  }>({ items: [], total: 0, hasMore: false, nextOffset: 0 });
  const [meldung, setMeldung] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [includeLinkedStoryElements, setIncludeLinkedStoryElements] = useState(true);
  const [activeTab, setActiveTab] = useState<"QUESTION" | "STORY_ELEMENT" | "POLL">("QUESTION");
  const [newlyAssignedPollIds, setNewlyAssignedPollIds] = useState<number[]>([]);
  const assignedPollIds = [...new Set([
    ...polls.filter((poll) => poll.isUsedInQuiz).map((poll) => poll.id),
    ...newlyAssignedPollIds,
  ])];
  const visibleResults = searchResult.items.filter((question) =>
    activeTab === "QUESTION" && !isPollQuestionTemplateId(question.templateId),
  );
  const normalizedPollQuery = filters.query.trim().toLocaleLowerCase("de-DE");
  const visiblePolls = polls.filter((poll) =>
    !normalizedPollQuery ||
    poll.prompt.toLocaleLowerCase("de-DE").includes(normalizedPollQuery) ||
    poll.subtype.toLocaleLowerCase("de-DE").includes(normalizedPollQuery),
  );

  async function handleSearch(
    nextFilters: ContentFiltersState = filters,
    offset = 0,
    append = false,
  ) {
    setMeldung("");
    setIsLoading(true);
    try {
      const result = await searchFragenForQuiz({ quizId, filters: nextFilters, offset });
      setSearchResult((current) => ({
        ...result,
        items: append ? [...current.items, ...result.items] : result.items,
      }));
    } catch {
      setMeldung("Die Fragen konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAdd(fragenId: number) {
    setMeldung("");
    try {
      const assignment = await addFrageToQuiz({
        quizId,
        fragenId,
        includeLinkedStoryElements,
      });
      setMeldung(
        assignment.coupledQuestionAlreadyInQuiz
          ? "Frage wurde hinzugefügt. Hinweis: Die gekoppelte FaceMorph-/Pixelfrage ist ebenfalls in diesem Quiz."
          : "Frage wurde zum Quiz hinzugefügt.",
      );
      await handleSearch(filters);
      router.refresh();
    } catch (error) {
      setMeldung(error instanceof Error ? error.message : "Frage konnte nicht hinzugefügt werden.");
    }
  }

  async function handleAddPoll(pollId: number) {
    setMeldung("");
    try {
      const result = await assignContentToQuiz({ contentType: "POLL", contentId: pollId, quizId });
      setMeldung(result.message);
      if (result.success) {
        setNewlyAssignedPollIds((current) => current.includes(pollId) ? current : [...current, pollId]);
        router.refresh();
      }
    } catch {
      setMeldung("Die Umfrage konnte diesem Quiz nicht hinzugefügt werden.");
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={quizElementActionClass}
      >
        Quiz-Element hinzufügen
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Quiz-Element hinzufügen</h3>
          <p className="mt-1 text-sm text-slate-500">
            Fragen, Story-Elemente und Umfragen aus der Content-Bibliothek auswählen.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className={buttonSecondaryClass}
        >
          Schließen
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={activeTab === "QUESTION"}
          onClick={() => setActiveTab("QUESTION")}
          className={activeTab === "QUESTION"
            ? "inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            : buttonSecondaryClass}
        >
          Fragen
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "STORY_ELEMENT"}
          onClick={() => setActiveTab("STORY_ELEMENT")}
          className={activeTab === "STORY_ELEMENT"
            ? "inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            : buttonSecondaryClass}
        >
          Story-Elemente
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "POLL"}
          onClick={() => setActiveTab("POLL")}
          className={activeTab === "POLL"
            ? "inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            : buttonSecondaryClass}
        >
          Umfragen
        </button>
      </div>

      {activeTab === "QUESTION" || activeTab === "POLL" ? <>

      {activeTab === "POLL" && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
        <span>Umfragen haben keine richtige Antwort und verändern den Punktestand nicht.</span>
        <Link href="/content/polls/new" className="font-semibold underline">Neue Umfrage erstellen</Link>
      </div>}

      {activeTab === "QUESTION" ? <ContentFilters
        filters={filters}
        categories={questionCategories}
        eventSeries={[]}
        templates={questionTemplates}
        loading={isLoading}
        hideContentType
        onChange={setFilters}
        onTemplateChange={(templateId) => {
          const next = { ...filters, templateId };
          setFilters(next);
          void handleSearch(next);
        }}
        onApply={() => void handleSearch()}
        onReset={() => {
          const next = parseContentFilters(
            new URLSearchParams("contentType=QUESTION"),
            "QUESTION",
            questionTemplates.filter((template) => template.availableForFiltering).map((template) => template.id),
          );
          setFilters(next);
          void handleSearch(next);
        }}
      /> : <ContentSearchControls
        query={filters.query}
        loading={false}
        placeholder="Umfragen durchsuchen …"
        onQueryChange={(query) => setFilters((current) => ({ ...current, query }))}
        onSubmit={() => undefined}
      />}

      {activeTab === "QUESTION" && <label className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
        <input type="checkbox" checked={includeLinkedStoryElements} onChange={(event) => setIncludeLinkedStoryElements(event.target.checked)} className="h-5 w-5 rounded border-slate-300" />
        Verknüpfte Story-Elemente ebenfalls hinzufügen
      </label>}

      {meldung && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800">
          {meldung}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {activeTab === "QUESTION" && visibleResults.map((frage) => (
          <QuizElementSearchResult
            key={frage.fragen_id}
            title={frage.frage}
            description={frage.storyElements.length > 0
              ? frage.storyElements
                  .map((story) => `${getStoryElementTypeLabel(story.type)}: ${story.title}`)
                  .join(" · ")
              : null}
            metadata={<>
                  <span
                    className={`rounded-full px-2 py-1 font-semibold ${
                      frage.ist_verwendbar
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {frage.status_hinweis}
                  </span>
                  <span>Quelle: {frage.quelle ?? "-"}</span>
                  <span>Schwierigkeit: {frage.schwierigkeitslevel ?? "-"}</span>
                  <span>
                    Kategorien:{" "}
                    {frage.kategorien.length > 0
                      ? frage.kategorien.join(", ")
                      : "-"}
                  </span>
                  {frage.storyElements.length > 0 && (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                      Story-Elemente: {frage.storyElements.length}
                    </span>
                  )}
                </>}
            actionLabel={frage.ist_bereits_im_quiz
              ? "Bereits im Quiz"
              : frage.ist_verwendbar
                ? "Hinzufügen"
                : "Noch nicht verwendbar"}
            disabled={frage.ist_bereits_im_quiz || !frage.ist_verwendbar}
            onAction={() => void handleAdd(frage.fragen_id)}
          />
        ))}

        {activeTab === "POLL" && visiblePolls.map((poll) => (
          <QuizElementSearchResult
            key={`poll-${poll.id}`}
            title={poll.prompt}
            description={`${poll.subtype} · Veröffentlichung: ${poll.publicationMode}`}
            metadata={<>
              <span className="rounded-full bg-violet-50 px-2 py-1 font-semibold text-violet-800">Umfrage</span>
              <span>Keine Punkte · keine Lösung</span>
            </>}
            actionLabel={assignedPollIds.includes(poll.id) ? "Bereits im Quiz" : poll.canAssign ? "Hinzufügen" : "Nicht verfügbar"}
            disabled={assignedPollIds.includes(poll.id) || !poll.canAssign}
            onAction={() => void handleAddPoll(poll.id)}
          />
        ))}

        {activeTab === "QUESTION" && visibleResults.length === 0 && !isLoading && (
          <p className="text-sm text-slate-500">
            Noch keine Suchergebnisse. Starte eine Suche, um Fragen auszuwählen.
          </p>
        )}
        {activeTab === "QUESTION" && visibleResults.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm font-semibold text-slate-600">
          <span>{visibleResults.length} von {searchResult.total} Treffern</span>
          {searchResult.hasMore && <button type="button" disabled={isLoading} onClick={() => void handleSearch(filters, searchResult.nextOffset, true)} className={buttonSecondaryClass}>Weitere laden</button>}
        </div>}
        {activeTab === "POLL" && visiblePolls.length === 0 && (
          <p className="text-sm text-slate-500">Keine passenden Umfragen gefunden.</p>
        )}
      </div>
      </> : (
        <StoryElementQuizPicker
          quizId={quizId}
          options={storyElements}
          embedded
        />
      )}
    </div>
  );
}
