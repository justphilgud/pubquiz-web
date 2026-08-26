"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import type {
  PresentationLayoutReason,
  ResolvedPresentationLayout,
} from "@/app/rendering/presentation/presentationLayoutResolver";
import {
  getStoryElementTypeLabel,
  type StoryElementType,
} from "@/app/story-elemente/storyElement";
import type { StoryPlacementOverride } from "@/app/story-elemente/storyPlacement";
import type { QuizResultDisplayMode } from "@/app/quiz/liveResults/liveResultMode";

export type QuizQuestionSettingsActions = {
  onPunkteModusChange: (
    quizFragenId: number,
    punkteModus: string,
  ) => void | Promise<void>;
  onFreeAnswerChange: (
    quizFragenId: number,
    freieAntwortErlaubt: boolean,
  ) => void | Promise<void>;
  onResultDisplayModeChange: (
    quizFragenId: number,
    mode: QuizResultDisplayMode,
  ) => void | Promise<void>;
  onStoryPlacementOverrideChange: (
    quizFragenId: number,
    storyElementId: number,
    placementOverride: StoryPlacementOverride,
  ) => void | Promise<void>;
};

type StoryElementSetting = {
  id: number;
  title: string;
  type: StoryElementType;
  defaultPlacement: "BEFORE_QUESTION" | "AFTER_SOLUTION";
  placementOverride: StoryPlacementOverride;
};

type Props = {
  quizFragenId: number;
  resolvedPresentationLayout: ResolvedPresentationLayout;
  punkteModus: string | null;
  freieAntwortErlaubt: boolean;
  ergebnisdarstellung: QuizResultDisplayMode;
  liveErgebnisUnterstuetzt: boolean;
  kannFreieAntwortAktivieren: boolean;
  istPixelbild: boolean;
  istUmfrage: boolean;
  teilpunkteFaehig: boolean;
  storyElements: StoryElementSetting[];
  actions: QuizQuestionSettingsActions;
};

const layoutLabels: Record<ResolvedPresentationLayout["variant"], string> = {
  CONTENT_CENTERED: "Textfokus",
  CONTENT_SPLIT: "Geteilte Darstellung",
  MEDIA_FOCUS: "Medienfokus",
  AUDIO_FOCUS: "Audiofokus",
  CHOICE_GRID: "Antwortauswahl",
  TRUE_FALSE: "Wahr oder falsch",
  ORDERING: "Sortierung",
  REVEAL_SEQUENCE: "Schrittweise Enthüllung",
  STRUCTURED_RESPONSE: "Strukturierte Antwort",
  SOLUTION_FOCUS: "Auflösungsfokus",
  MEDIA_LEFT: "Medium links",
  MEDIA_RIGHT: "Medium rechts",
  MEDIA_TOP: "Medium oben",
  FULLSCREEN_MEDIA: "Vollbildmedium",
  CARD_GRID: "Kartenraster",
  RANKING_STAGE: "Ranglistenbühne",
  RANKING_TABLE: "Ranglistentabelle",
  RANKING_CARDS: "Ranglistenkarten",
  HERO: "Hervorgehobene Darstellung",
};

const reasonLabels: Record<PresentationLayoutReason, string> = {
  LEGACY_COMPATIBLE: "Bestehende kompatible Vorgabe",
  SOLUTION_PHASE: "Für die Auflösung optimiert",
  PIXEL_REVEAL: "Passend zur Pixelenthüllung",
  GOOGLE_REVIEW_REVEAL: "Passend zur schrittweisen Rezension",
  TRUE_FALSE_TEMPLATE: "Durch die Wahr-oder-falsch-Vorlage",
  ORDERING_TEMPLATE: "Durch die Sortiervorlage",
  MULTIPLE_CHOICE_TEMPLATE: "Durch die Multiple-Choice-Vorlage",
  AUDIO_TEMPLATE: "Durch die Audiovorlage",
  FACE_MORPH_TEMPLATE: "Durch die Bildvorlage",
  STRUCTURED_RESPONSE: "Durch die strukturierten Antwortfelder",
  AUDIO_MEDIUM: "Durch das vorhandene Audiomedium",
  VISUAL_MEDIUM: "Durch das vorhandene Bild- oder Videomedium",
  CHOICE_OPTIONS: "Durch die vorhandenen Antwortoptionen",
  TEXT_ONLY: "Für eine textbasierte Frage",
  CONTRACT_FALLBACK: "Durch den Templatevertrag vorgegeben",
};

function StoryPlacementSelect({
  quizFragenId,
  story,
  onChange,
  compact,
}: {
  quizFragenId: number;
  story: StoryElementSetting;
  onChange: QuizQuestionSettingsActions["onStoryPlacementOverrideChange"];
  compact: boolean;
}) {
  const defaultLabel = story.defaultPlacement === "BEFORE_QUESTION"
    ? "Vor der Frage"
    : "Nach der Auflösung";

  return (
    <label
      className={compact
        ? "space-y-2"
        : "grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(15rem,20rem)] sm:items-center"}
    >
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
          {compact ? "Story-Position" : getStoryElementTypeLabel(story.type)}
        </span>
        <span className="mt-1 block break-words text-sm font-semibold text-slate-900">
          {compact
            ? `${getStoryElementTypeLabel(story.type)}: ${story.title}`
            : story.title}
        </span>
      </span>
      <Select
        aria-label={`Story-Position für ${story.title}`}
        value={story.placementOverride ?? "DEFAULT"}
        onChange={(event) => {
          const value = event.target.value;
          void onChange(
            quizFragenId,
            story.id,
            value === "DEFAULT"
              ? null
              : value as Exclude<StoryPlacementOverride, null>,
          );
        }}
        className="min-h-11 rounded-xl font-semibold"
      >
        <option value="DEFAULT">Standard: {defaultLabel}</option>
        <option value="BEFORE_QUESTION">Vor der Frage</option>
        <option value="AFTER_SOLUTION">Nach der Auflösung</option>
        <option value="HIDDEN">Story-Element nicht anzeigen</option>
      </Select>
    </label>
  );
}

export default function QuizQuestionSettings({
  quizFragenId,
  resolvedPresentationLayout,
  punkteModus,
  freieAntwortErlaubt,
  ergebnisdarstellung,
  liveErgebnisUnterstuetzt,
  kannFreieAntwortAktivieren,
  istPixelbild,
  istUmfrage,
  teilpunkteFaehig,
  storyElements,
  actions,
}: Props) {
  return (
    <div className="grid gap-5 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2">
        <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
          Präsentationslayout
        </span>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">
            {resolvedPresentationLayout.source === "AUTO"
              ? "Automatisch"
              : "Bestehende Vorgabe"}
            : {layoutLabels[resolvedPresentationLayout.variant]}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {reasonLabels[resolvedPresentationLayout.reason]}
          </div>
        </div>
      </div>

      <label className="space-y-2">
        <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
          Punktemodus
        </span>
        <Select
          value={punkteModus ?? "standard"}
          disabled={istUmfrage}
          onChange={(event) =>
            void actions.onPunkteModusChange(quizFragenId, event.target.value)
          }
          className="min-h-11 rounded-xl font-semibold"
        >
          <option value="standard">Standard</option>
          <option value="expertenbonus" disabled={istPixelbild}>
            Expertenbonus{istPixelbild ? " (für Pixelbild nicht erlaubt)" : ""}
          </option>
          <option value="risikofrage" disabled={istPixelbild || teilpunkteFaehig}>
            Risikofrage
            {istPixelbild || teilpunkteFaehig
              ? " (nur ohne Teilpunkte möglich)"
              : ""}
          </option>
        </Select>
        <span className="block text-xs text-slate-500">
          {istUmfrage
            ? "Umfragen vergeben keine Punkte."
            : "Risikofragen sind nur bei Fragen ohne Teilpunkte möglich."}
        </span>
      </label>

      {storyElements.length === 1 && (
        <StoryPlacementSelect
          quizFragenId={quizFragenId}
          story={storyElements[0]}
          onChange={actions.onStoryPlacementOverrideChange}
          compact
        />
      )}

      {kannFreieAntwortAktivieren && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Antwortmodus
            </span>
            <details className="relative">
              <summary
                className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-black text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 [&::-webkit-details-marker]:hidden"
                aria-label="Information zum offenen Antwortmodus"
              >
                i
              </summary>
              <p className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-xl bg-slate-900 p-3 text-xs leading-5 text-white shadow-xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-auto sm:mt-2 sm:w-72 sm:translate-y-0">
                Teams sehen keine Antwortmöglichkeiten und geben ihre Antwort
                als Freitext ein. Die ursprünglichen Lösungen bleiben für
                Auflösung und Bewertung erhalten.
              </p>
            </details>
          </div>
          <Checkbox
            variant="card"
            checked={freieAntwortErlaubt}
            onChange={(event) =>
              void actions.onFreeAnswerChange(
                quizFragenId,
                event.target.checked,
              )
            }
            label="Als offene Frage stellen"
          />
        </div>
      )}

      {liveErgebnisUnterstuetzt && (
        <label className="space-y-2">
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            Ergebnisdarstellung
          </span>
          <Select
            value={ergebnisdarstellung}
            onChange={(event) =>
              void actions.onResultDisplayModeChange(
                quizFragenId,
                event.target.value as QuizResultDisplayMode,
              )
            }
            className="min-h-11 rounded-xl font-semibold"
          >
            <option value="STANDARD">Standard</option>
            <option value="LIVE">Live</option>
          </Select>
          <span className="block text-xs text-slate-500">
            Live steuert nur die öffentliche Ergebnisanzeige. Lösung und Bewertung bleiben unverändert.
          </span>
        </label>
      )}

      {storyElements.length > 1 && (
        <section className="space-y-3 sm:col-span-2 lg:col-span-3">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Story-Elemente
            </span>
            <p className="mt-1 text-xs text-slate-500">
              Die Quizposition kann je Story vom Standard der Frage abweichen.
            </p>
          </div>
          <div className="space-y-2">
            {storyElements.map((story) => (
              <StoryPlacementSelect
                key={story.id}
                quizFragenId={quizFragenId}
                story={story}
                onChange={actions.onStoryPlacementOverrideChange}
                compact={false}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
