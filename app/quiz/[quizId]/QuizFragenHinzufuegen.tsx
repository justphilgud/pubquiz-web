"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addFrageToQuiz,
  searchFragenForQuiz,
} from "../actions";
import type { QuizFrageSuchResult } from "../actions";
import ContentSearchControls from "@/app/components/content/ContentSearchControls";
import StoryElementQuizPicker, {
  type QuizStoryElementOption,
} from "@/app/story-elemente/StoryElementQuizPicker";
import QuizElementSearchResult, {
  quizElementActionClass,
} from "./QuizElementSearchResult";
import { getStoryElementTypeLabel } from "@/app/story-elemente/storyElement";

type Props = {
  quizId: number;
  storyElements: QuizStoryElementOption[];
};

const buttonSecondaryClass =
  "rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]";

export default function QuizFragenHinzufuegen({
  quizId,
  storyElements,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [suchtext, setSuchtext] = useState("");
  const [ergebnisse, setErgebnisse] = useState<QuizFrageSuchResult[]>([]);
  const [meldung, setMeldung] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [includeLinkedStoryElements, setIncludeLinkedStoryElements] = useState(true);
  const [activeTab, setActiveTab] = useState<"QUESTION" | "STORY_ELEMENT">("QUESTION");

  async function handleSearch() {
    setMeldung("");
    setIsLoading(true);

    const result = await searchFragenForQuiz({
      quizId,
      suchtext,
    });

    setErgebnisse(result);
    setIsLoading(false);
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
      const result = await searchFragenForQuiz({ quizId, suchtext });
      setErgebnisse(result);
      router.refresh();
    } catch (error) {
      setMeldung(error instanceof Error ? error.message : "Frage konnte nicht hinzugefügt werden.");
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
            Fragen und Story-Elemente aus derselben Content-Suche auswählen.
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
      </div>

      {activeTab === "QUESTION" ? <>

      <ContentSearchControls
        query={suchtext}
        loading={isLoading}
        placeholder="Fragen durchsuchen …"
        onQueryChange={setSuchtext}
        onSubmit={() => void handleSearch()}
      />

      <label className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
        <input type="checkbox" checked={includeLinkedStoryElements} onChange={(event) => setIncludeLinkedStoryElements(event.target.checked)} className="h-5 w-5 rounded border-slate-300" />
        Verknüpfte Story-Elemente ebenfalls hinzufügen
      </label>

      {meldung && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800">
          {meldung}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {ergebnisse.map((frage) => (
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

        {ergebnisse.length === 0 && !isLoading && (
          <p className="text-sm text-slate-500">
            Noch keine Suchergebnisse. Starte eine Suche, um Fragen auszuwählen.
          </p>
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
