"use client";

import type { CSSProperties, HTMLAttributes } from "react";
import { useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import QuizQuestionItem, {
  type QuizQuestion,
} from "./QuizQuestionItem";
import type { QuizQuestionSettingsActions } from "./QuizQuestionSettings";
import {
  isIntroSection,
  isOutroSection,
  isQuestionSection,
} from "../quizSectionPolicy";
import {
  createQuizAbschnitt,
  deleteQuizAbschnitt,
  updateQuizAbschnitteSortierung,
  updateQuizFragePunkteModus,
  updateQuizAbschnittTitel,
  updateQuizQuestionFreeAnswerMode,
  updateQuizQuestionResultDisplayMode,
  updateQuizFragenBlockSortierung,
} from "../actions";
import { synchronizeAutomaticBlockTitles } from "../quizStructure";
import {
  moveStandaloneLivePollToSection,
  moveStandaloneStoryElementToSection,
  removeStandaloneLivePollFromQuiz,
  updateQuizStoryPlacementOverride,
} from "./quizStructureActions";
import {
  getStoryElementTypeLabel,
  type StoryElementType,
} from "@/app/story-elemente/storyElement";
import type { StoryPlacementOverride } from "@/app/story-elemente/storyPlacement";
import {
  getLivePollTypeLabel,
  type LivePollPublicationMode,
  type LivePollStatus,
  type LivePollType,
} from "@/app/umfragen/livePoll";

type Abschnitt = {
  quiz_abschnitt_id: number;
  titel: string;
  abschnitt_typ: string;
  sortierung: number;
};

type Gruppe = {
  key: string;
  titel: string;
  containerId: string;
  quizAbschnittId: number | null;
  fragen: QuizQuestion[];
  stories: QuizStandaloneStory[];
  polls: QuizStandalonePoll[];
  blockTyp: "intro" | "outro" | "fragenblock" | "kein-block";
};

type Props = {
  quizId: number;
  fragen: QuizQuestion[];
  abschnitte: Abschnitt[];
  standaloneStories: QuizStandaloneStory[];
  standalonePolls: QuizStandalonePoll[];
};

export type QuizStandaloneStory = {
  placementId: number;
  storyElementId: number;
  title: string;
  type: StoryElementType;
  quiz_abschnitt_id: number | null;
  sortierung: number;
};

export type QuizStandalonePoll = {
  placementId: number;
  pollId: number;
  title: string;
  type: LivePollType;
  publicationMode: LivePollPublicationMode;
  status: LivePollStatus;
  quiz_abschnitt_id: number | null;
  sortierung: number;
};

const introSlides = [
  ["vor-dem-start", "Wartebildschirm"],
  ["startsequenz", "Countdown bis zum Start"],
  ["begruessung", "Begrüßung", "Quizname und Willkommensgruß"],
  ["regeln", "Regeln", "Quizregeln und Ablauf"],
  ["preise", "Preise", "Preise für Platz 1 bis 3"],
] as const;

const outroSlides = [
  [
    "bekanntmachungen",
    "Bekanntmachungen",
    "Hinweise, nächste Termine und Abschlussinfos",
  ],
  [
    "calendar",
    "PubQuiz-Kalender",
    "Allgemeinen öffentlichen Kalender abonnieren",
  ],
] as const;

const numberFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 2,
});

function getContainerId(quizAbschnittId: number | null) {
  return quizAbschnittId === null
    ? "block-kein-block"
    : `block-${quizAbschnittId}`;
}

function getAbschnittIdFromContainer(containerId: string) {
  if (containerId === "block-kein-block") {
    return null;
  }

  return Number(containerId.replace("block-", ""));
}

function FixedSlidesCard({
  quizId,
  typ,
  count,
  description,
}: {
  quizId: number;
  typ: "Intro" | "Outro";
  count: number;
  description: string;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="font-bold text-slate-900">
          {typ} konfigurieren
        </div>
        <div className="mt-1 text-sm text-slate-500">{description}</div>
        <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {count} {count === 1 ? "feste Slide" : "feste Slides"} · Fixiert
        </div>
      </div>
      <a
        href={`/quiz/${quizId}/slides/${typ === "Intro" ? "intro" : "outro"}`}
        className="inline-flex items-center justify-center self-start rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
      >
        {typ} konfigurieren
      </a>
    </article>
  );
}

function StandaloneStoryItem({ story, containerId }: {
  story: QuizStandaloneStory;
  containerId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `story-${story.placementId}`,
    data: { type: "story", containerId },
  });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-2 rounded-xl border bg-white p-3 shadow-sm ${isDragging ? "border-emerald-300 opacity-80 shadow-lg" : "border-slate-200"}`}
    >
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg text-lg font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-800 active:cursor-grabbing"
        title="Story-Element zum Sortieren ziehen"
        aria-label={`${story.title} zum Sortieren ziehen`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">
        <strong className="block break-words text-sm text-slate-900">{story.title}</strong>
        <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-800">Story-Element</span>
          <span>{getStoryElementTypeLabel(story.type)}</span>
          {story.quiz_abschnitt_id === null && <span className="text-amber-700">Nicht zugeordnet</span>}
        </div>
      </div>
    </article>
  );
}

function StandalonePollItem({ poll, containerId, onRemove }: {
  poll: QuizStandalonePoll;
  containerId: string;
  onRemove: (placementId: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `poll-${poll.placementId}`,
    data: { type: "poll", containerId },
  });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-2 rounded-xl border bg-white p-3 shadow-sm ${isDragging ? "border-violet-300 opacity-80 shadow-lg" : "border-slate-200"}`}
    >
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg text-lg font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-800 active:cursor-grabbing"
        title="Umfrage zum Sortieren ziehen"
        aria-label={`${poll.title} zum Sortieren ziehen`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">
        <strong className="block break-words text-sm text-slate-900">{poll.title}</strong>
        <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-800">Umfrage</span>
          <span>{getLivePollTypeLabel(poll.type)}</span>
          <span>{poll.publicationMode === "AUTOMATIC" ? "Automatisch" : "Moderiert"}</span>
          <span>{poll.status === "ACTIVE" ? "Freigegeben" : poll.status === "ARCHIVED" ? "Archiviert" : "Entwurf"}</span>
          {poll.quiz_abschnitt_id === null && <span className="text-amber-700">Nicht zugeordnet</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <a href={`/content/polls/${poll.pollId}`} className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700">Öffnen</a>
        <button type="button" onClick={() => onRemove(poll.placementId)} className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700">Aus Quiz entfernen</button>
      </div>
    </article>
  );
}

function BlockDragHandle({
  titel,
  attributes,
  listeners,
}: {
  titel: string;
  attributes: HTMLAttributes<HTMLButtonElement>;
  listeners: HTMLAttributes<HTMLButtonElement> | undefined;
}) {
  return (
    <button
      type="button"
      className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg text-lg font-semibold text-slate-400 transition hover:bg-white hover:text-slate-800 active:cursor-grabbing"
      title="Block zum Sortieren ziehen"
      aria-label={`${titel} zum Sortieren ziehen`}
      {...attributes}
      {...listeners}
    >
      ⠿
    </button>
  );
}

function DroppableBlock({
  gruppe,
  quizId,
  istEingeklappt,
  onToggleGruppe,
  settingsActions,
  onRemove,
  onRemovePoll,
  onDeleteBlock,
  onRenameBlock,
  fragenrundenAnzahl,
}: {
  gruppe: Gruppe;
  quizId: number;
  istEingeklappt: boolean;
  onToggleGruppe: (containerId: string) => void;
  settingsActions: QuizQuestionSettingsActions;
  onRemove: (quizFragenId: number) => void;
  onRemovePoll: (placementId: number) => void;
  onDeleteBlock: (quizAbschnittId: number) => void | Promise<void>;
  onRenameBlock: (quizAbschnittId: number, currentTitle: string) => void | Promise<void>;
  fragenrundenAnzahl: number;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(gruppe.titel);
  const istFragenrunde = gruppe.blockTyp === "fragenblock";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: gruppe.containerId,
    disabled: {
      draggable: !istFragenrunde,
      droppable:
        !istFragenrunde && gruppe.blockTyp !== "kein-block",
    },
    data: {
      type: istFragenrunde ? "block" : "block-container",
    },
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const gesamtpunkte = gruppe.fragen.reduce(
    (summe, frage) => summe + frage.punkte_basis,
    0,
  );
  const unklareAntwortmodi = gruppe.fragen.filter(
    (frage) => frage.effektiver_antwortmodus === "UNCLASSIFIED",
  ).length;
  const dynamischePunkte = gruppe.fragen.some(
    (frage) =>
      Boolean(frage.punkte_modus) && frage.punkte_modus !== "standard",
  );
  const festeSlides =
    gruppe.blockTyp === "intro"
      ? introSlides.length
      : gruppe.blockTyp === "outro"
        ? outroSlides.length
        : null;
  const farben =
    gruppe.blockTyp === "intro"
      ? "border-sky-200 bg-sky-50/70"
      : gruppe.blockTyp === "outro"
        ? "border-violet-200 bg-violet-50/70"
        : gruppe.blockTyp === "kein-block"
          ? "border-amber-200 bg-amber-50/70"
          : "border-slate-200 bg-slate-50";

  return (
    <section
      id={gruppe.containerId}
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border shadow-sm transition ${farben} ${
        isDragging ? "z-10 opacity-80 shadow-xl" : ""
      } ${isOver ? "ring-2 ring-cyan-300" : ""}`}
    >
      <header className="flex items-start gap-2 p-3 sm:items-center">
        {istFragenrunde ? (
          <BlockDragHandle
            titel={gruppe.titel}
            attributes={attributes}
            listeners={listeners}
          />
        ) : (
          <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-white/80 px-2 text-xs font-black uppercase text-slate-500">
            {gruppe.blockTyp === "intro"
              ? "IN"
              : gruppe.blockTyp === "outro"
                ? "OUT"
                : "!"}
          </span>
        )}

        <button type="button" onClick={() => onToggleGruppe(gruppe.containerId)} className="min-w-0 flex-1 text-left" aria-expanded={!istEingeklappt}>
          <span className="block font-black text-slate-900">
            {gruppe.titel}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
            {festeSlides === null ? (
              <>
                <span>
                  {gruppe.blockTyp === "fragenblock"
                    ? "Block"
                    : "Ohne Block"}
                </span>
                <span>
                  {gruppe.fragen.length}{" "}
                  {gruppe.fragen.length === 1 ? "Frage" : "Fragen"}
                </span>
                {gruppe.stories.length > 0 && (
                  <span>
                    {gruppe.stories.length}{" "}
                    {gruppe.stories.length === 1 ? "Story-Element" : "Story-Elemente"}
                  </span>
                )}
                {gruppe.polls.length > 0 && (
                  <span>
                    {gruppe.polls.length} {gruppe.polls.length === 1 ? "Umfrage" : "Umfragen"}
                  </span>
                )}
                <span>
                  {numberFormatter.format(gesamtpunkte)} Basispunkte
                </span>
              </>
            ) : (
              <>
                <span>{festeSlides} feste Slides</span>
                <span>{gruppe.blockTyp === "intro" ? "Intro" : "Outro"}</span>
              </>
            )}
            {gruppe.blockTyp === "kein-block" &&
              gruppe.fragen.length > 0 && (
                <span className="text-amber-700">Nicht zugeordnet</span>
              )}
            {dynamischePunkte && (
              <span className="text-amber-700">Dynamische Punkte</span>
            )}
            {unklareAntwortmodi > 0 && (
              <span className="text-amber-700">
                {unklareAntwortmodi}{" "}
                {unklareAntwortmodi === 1 ? "Warnung" : "Warnungen"}
              </span>
            )}
          </span>
        </button>

        {istFragenrunde &&
          fragenrundenAnzahl > 1 &&
          gruppe.quizAbschnittId !== null && (
            <details className="relative">
              <summary
                className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-300 bg-white text-xl font-bold leading-none text-slate-600 shadow-sm transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
                aria-label={`Weitere Aktionen für ${gruppe.titel}`}
              >
                …
              </summary>
              <div className="absolute right-0 z-20 mt-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setDraftTitle(gruppe.titel);
                    setIsRenaming(true);
                  }}
                  className="mb-1 block w-full whitespace-nowrap rounded-xl px-4 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Block umbenennen
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onDeleteBlock(gruppe.quizAbschnittId as number)
                  }
                  className="whitespace-nowrap rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Block löschen
                </button>
              </div>
            </details>
          )}

        <button
          type="button"
          onClick={() => onToggleGruppe(gruppe.containerId)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-900"
          aria-label={istEingeklappt ? "Block aufklappen" : "Block einklappen"}
        >
          <span
            className={`text-lg leading-none transition-transform ${
              istEingeklappt ? "" : "rotate-180"
            }`}
          >
            ⌄
          </span>
        </button>
      </header>

      {!istEingeklappt && (
        <div className="space-y-2 border-t border-inherit p-3">
          {isRenaming && gruppe.quizAbschnittId !== null && (
            <form
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                const title = draftTitle.trim();
                if (!title) return;
                void Promise.resolve(
                  onRenameBlock(gruppe.quizAbschnittId as number, title),
                ).then(() => setIsRenaming(false));
              }}
            >
              <label className="min-w-0 flex-1 space-y-1">
                <span className="block text-xs font-bold text-slate-600">Blocktitel</span>
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  maxLength={200}
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  aria-label="Blocktitel"
                />
              </label>
              <div className="flex gap-2">
                <button type="submit" className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">Speichern</button>
                <button type="button" onClick={() => setIsRenaming(false)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">Abbrechen</button>
              </div>
            </form>
          )}
          <SortableContext
            items={[
              ...gruppe.fragen.map((frage) => frage.quiz_fragen_id),
              ...gruppe.stories.map((story) => `story-${story.placementId}`),
              ...gruppe.polls.map((poll) => `poll-${poll.placementId}`),
            ]}
            strategy={verticalListSortingStrategy}
          >
            {gruppe.blockTyp === "intro" ? (
              <FixedSlidesCard
                quizId={quizId}
                typ="Intro"
                count={introSlides.length}
                description="Wartebildschirm, Countdown, Begrüßung, Regeln und Preise"
              />
            ) : gruppe.blockTyp === "outro" ? (
              <FixedSlidesCard
                quizId={quizId}
                typ="Outro"
                count={outroSlides.length}
                description="Bekanntmachungen und PubQuiz-Kalender"
              />
            ) : gruppe.fragen.length === 0 && gruppe.stories.length === 0 && gruppe.polls.length === 0 ? (
              gruppe.blockTyp === "fragenblock" ? (
                <div
                  className={`rounded-xl border border-dashed px-4 py-6 text-center text-sm font-medium transition ${
                    isOver
                      ? "border-cyan-400 bg-cyan-50 text-cyan-700"
                      : "border-slate-300 bg-white text-slate-400"
                  }`}
                >
                  Frage hier ablegen
                </div>
              ) : null
            ) : (<>
              {gruppe.fragen.map((frage, index) => (
                <QuizQuestionItem
                  key={frage.quiz_fragen_id}
                  frage={frage}
                  index={index}
                  quizId={quizId}
                  containerId={gruppe.containerId}
                  settingsActions={settingsActions}
                  onRemove={onRemove}
                />
              ))}
              {gruppe.stories.map((story) => (
                <StandaloneStoryItem
                  key={story.placementId}
                  story={story}
                  containerId={gruppe.containerId}
                />
              ))}
              {gruppe.polls.map((poll) => (
                <StandalonePollItem
                  key={poll.placementId}
                  poll={poll}
                  containerId={gruppe.containerId}
                  onRemove={onRemovePoll}
                />
              ))}
            </>)}
          </SortableContext>
        </div>
      )}
    </section>
  );
}

export default function QuizFragenSortableTable({
  quizId,
  fragen,
  abschnitte,
  standaloneStories,
  standalonePolls,
}: Props) {
  const [items, setItems] = useState<QuizQuestion[]>(fragen);
  const [storyItems, setStoryItems] = useState<QuizStandaloneStory[]>(standaloneStories);
  const [pollItems, setPollItems] = useState<QuizStandalonePoll[]>(standalonePolls);
  const [blockItems, setBlockItems] = useState(() =>
    synchronizeAutomaticBlockTitles(abschnitte),
  );
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [meldung, setMeldung] = useState("");
  const [eingeklappteGruppen, setEingeklappteGruppen] = useState<string[]>([]);

  function handleRemoveFrage(quizFragenId: number) {
    setItems((current) =>
      current.filter((item) => item.quiz_fragen_id !== quizFragenId),
    );
  }

  async function handleRemovePoll(placementId: number) {
    if (!window.confirm("Umfrage aus diesem Quiz entfernen? Die Umfrage selbst bleibt in der Content-Bibliothek erhalten.")) return;
    const result = await removeStandaloneLivePollFromQuiz({ quizId, placementId });
    if (!result.success) {
      setMeldung(result.message);
      return;
    }
    setPollItems((current) => current.filter((poll) => poll.placementId !== placementId));
    setMeldung("Umfrage wurde aus dem Quiz entfernt.");
  }

  function toggleGruppe(containerId: string) {
    setEingeklappteGruppen((current) =>
      current.includes(containerId)
        ? current.filter((id) => id !== containerId)
        : [...current, containerId],
    );
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const introBlock = blockItems.find(isIntroSection) ?? null;
  const outroBlock = blockItems.find(isOutroSection) ?? null;
  const fragenrundeBlocks = blockItems.filter(isQuestionSection);
  const gruppen: Gruppe[] = [
    ...(introBlock
      ? [
          {
            key: `block-${introBlock.quiz_abschnitt_id}`,
            titel: introBlock.titel,
            containerId: getContainerId(introBlock.quiz_abschnitt_id),
            quizAbschnittId: introBlock.quiz_abschnitt_id,
            blockTyp: "intro" as const,
            stories: [],
            polls: [],
            fragen: items
              .filter(
                (frage) =>
                  Number(frage.quiz_abschnitt_id) ===
                  Number(introBlock.quiz_abschnitt_id),
              )
              .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0)),
          },
        ]
      : []),
    ...fragenrundeBlocks.map((abschnitt) => ({
      key: `block-${abschnitt.quiz_abschnitt_id}`,
      titel: abschnitt.titel || "Block",
      containerId: getContainerId(abschnitt.quiz_abschnitt_id),
      quizAbschnittId: abschnitt.quiz_abschnitt_id,
      blockTyp: "fragenblock" as const,
      stories: storyItems
        .filter((story) => story.quiz_abschnitt_id === abschnitt.quiz_abschnitt_id)
        .sort((a, b) => a.sortierung - b.sortierung),
      polls: pollItems
        .filter((poll) => poll.quiz_abschnitt_id === abschnitt.quiz_abschnitt_id)
        .sort((a, b) => a.sortierung - b.sortierung),
      fragen: items
        .filter(
          (frage) =>
            Number(frage.quiz_abschnitt_id) ===
            Number(abschnitt.quiz_abschnitt_id),
        )
        .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0)),
    })),
    ...(outroBlock
      ? [
          {
            key: `block-${outroBlock.quiz_abschnitt_id}`,
            titel: outroBlock.titel,
            containerId: getContainerId(outroBlock.quiz_abschnitt_id),
            quizAbschnittId: outroBlock.quiz_abschnitt_id,
            blockTyp: "outro" as const,
            stories: [],
            polls: [],
            fragen: items
              .filter(
                (frage) =>
                  Number(frage.quiz_abschnitt_id) ===
                  Number(outroBlock.quiz_abschnitt_id),
              )
              .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0)),
          },
        ]
      : []),
    {
      key: "kein-block",
      titel: "Kein Block",
      containerId: getContainerId(null),
      quizAbschnittId: null,
      blockTyp: "kein-block",
      stories: storyItems
        .filter((story) => story.quiz_abschnitt_id === null)
        .sort((a, b) => a.sortierung - b.sortierung),
      polls: pollItems
        .filter((poll) => poll.quiz_abschnitt_id === null)
        .sort((a, b) => a.sortierung - b.sortierung),
      fragen: items
        .filter((frage) => frage.quiz_abschnitt_id == null)
        .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0)),
    },
  ];
  const introGruppe = gruppen.find((gruppe) => gruppe.blockTyp === "intro");
  const fragenGruppen = gruppen.filter((gruppe) => gruppe.blockTyp === "fragenblock");
  const keinBlockGruppe = gruppen.find((gruppe) => gruppe.blockTyp === "kein-block");
  const outroGruppe = gruppen.find((gruppe) => gruppe.blockTyp === "outro");

  function findItem(id: number) {
    return items.find((item) => item.quiz_fragen_id === id);
  }

  function saveBlockSortierung(newItems: QuizQuestion[]) {
    return updateQuizFragenBlockSortierung({
      quizId,
      items: newItems.map((item, index) => ({
        quizFragenId: item.quiz_fragen_id,
        quizAbschnittId: item.quiz_abschnitt_id,
        sortierung: index + 1,
      })),
    });
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id || active.data.current?.type === "block") {
      return;
    }

    if (active.data.current?.type === "poll") {
      const placementId = Number(String(active.id).replace("poll-", ""));
      const zielContainerId = typeof over.data.current?.containerId === "string"
        ? over.data.current.containerId
        : String(over.id);
      if (!zielContainerId.startsWith("block-")) return;
      const zielAbschnittId = getAbschnittIdFromContainer(zielContainerId);
      const zielAbschnitt = blockItems.find((block) => block.quiz_abschnitt_id === zielAbschnittId);
      if (zielAbschnittId !== null && (!zielAbschnitt || !isQuestionSection(zielAbschnitt))) return;
      setPollItems((current) => current.map((poll) =>
        poll.placementId === placementId ? { ...poll, quiz_abschnitt_id: zielAbschnittId } : poll,
      ));
      return;
    }

    if (active.data.current?.type === "story") {
      const placementId = Number(String(active.id).replace("story-", ""));
      const zielContainerId = typeof over.data.current?.containerId === "string"
        ? over.data.current.containerId
        : String(over.id);
      if (!zielContainerId.startsWith("block-")) return;
      const zielAbschnittId = getAbschnittIdFromContainer(zielContainerId);
      const zielAbschnitt = blockItems.find(
        (block) => block.quiz_abschnitt_id === zielAbschnittId,
      );
      if (zielAbschnittId !== null && (!zielAbschnitt || !isQuestionSection(zielAbschnitt))) return;
      setStoryItems((current) => current.map((story) =>
        story.placementId === placementId
          ? { ...story, quiz_abschnitt_id: zielAbschnittId }
          : story,
      ));
      return;
    }

    const activeId = Number(active.id);
    const activeItem = findItem(activeId);
    if (!activeItem) {
      return;
    }

    const overItem =
      typeof over.id === "number" ? findItem(Number(over.id)) : undefined;
    const zielContainerId = overItem
      ? getContainerId(overItem.quiz_abschnitt_id)
      : typeof over.data.current?.containerId === "string"
        ? over.data.current.containerId
        : String(over.id);

    if (!zielContainerId.startsWith("block-")) {
      return;
    }

    const zielAbschnittId = getAbschnittIdFromContainer(zielContainerId);
    const zielAbschnitt = blockItems.find(
      (block) => block.quiz_abschnitt_id === zielAbschnittId,
    );
    if (zielAbschnittId !== null && !zielAbschnitt) return;
    if (zielAbschnitt && !isQuestionSection(zielAbschnitt)) return;
    if (activeItem.quiz_abschnitt_id === zielAbschnittId) {
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.quiz_fragen_id === activeId
          ? { ...item, quiz_abschnitt_id: zielAbschnittId }
          : item,
      ),
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.data.current?.type === "block") {
      if (!over || active.id === over.id) {
        return;
      }

      const overFrage = items.find(
        (item) => item.quiz_fragen_id === Number(over.id),
      );
      const zielBlockId = overFrage
        ? getContainerId(overFrage.quiz_abschnitt_id)
        : typeof over.data.current?.containerId === "string"
          ? over.data.current.containerId
          : String(over.id);
      const oldIndex = fragenrundeBlocks.findIndex(
        (block) => getContainerId(block.quiz_abschnitt_id) === active.id,
      );
      const newIndex = fragenrundeBlocks.findIndex(
        (block) => getContainerId(block.quiz_abschnitt_id) === zielBlockId,
      );

      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      const neueFragenrunden = synchronizeAutomaticBlockTitles(arrayMove(
        fragenrundeBlocks,
        oldIndex,
        newIndex,
      ));
      const neueBlockItems = [
        ...(introBlock ? [introBlock] : []),
        ...neueFragenrunden,
        ...(outroBlock ? [outroBlock] : []),
      ].map((block, index) => ({
        ...block,
        sortierung: index + 1,
      }));

      setBlockItems(neueBlockItems);
      await updateQuizAbschnitteSortierung({
        quizId,
        items: neueFragenrunden.map((block, index) => ({
          quizAbschnittId: block.quiz_abschnitt_id,
          sortierung: index + 2,
        })),
      });
      return;
    }

    if (active.data.current?.type === "poll") {
      if (!over) return;
      const placementId = Number(String(active.id).replace("poll-", ""));
      const zielContainerId = typeof over.data.current?.containerId === "string"
        ? over.data.current.containerId
        : String(over.id);
      if (!zielContainerId.startsWith("block-")) return;
      const sectionId = getAbschnittIdFromContainer(zielContainerId);
      const result = await moveStandaloneLivePollToSection({
        quizId,
        placementId,
        sectionId,
      });
      if (!result.success) {
        setMeldung(result.message);
        return;
      }
      setPollItems((current) => current.map((poll) =>
        poll.placementId === placementId
          ? { ...poll, quiz_abschnitt_id: sectionId }
          : poll,
      ));
      setMeldung(sectionId === null
        ? "Umfrage wurde unter Kein Block abgelegt."
        : "Umfrage wurde dem Block zugeordnet.");
      return;
    }

    if (active.data.current?.type === "story") {
      if (!over) return;
      const placementId = Number(String(active.id).replace("story-", ""));
      const zielContainerId = typeof over.data.current?.containerId === "string"
        ? over.data.current.containerId
        : String(over.id);
      if (!zielContainerId.startsWith("block-")) return;
      const sectionId = getAbschnittIdFromContainer(zielContainerId);
      const result = await moveStandaloneStoryElementToSection({
        quizId,
        placementId,
        sectionId,
      });
      if (!result.success) {
        setMeldung(result.message);
        return;
      }
      setStoryItems((current) => current.map((story) =>
        story.placementId === placementId
          ? { ...story, quiz_abschnitt_id: sectionId }
          : story,
      ));
      setMeldung(sectionId === null
        ? "Story-Element wurde unter Kein Block abgelegt."
        : "Story-Element wurde dem Block zugeordnet.");
      return;
    }

    if (!over) {
      return;
    }

    const activeId = Number(active.id);
    const activeItem = findItem(activeId);
    if (!activeItem) {
      return;
    }

    const overItem =
      typeof over.id === "number" ? findItem(Number(over.id)) : undefined;
    let newItems = [...items];

    if (overItem) {
      const oldIndex = newItems.findIndex(
        (item) => item.quiz_fragen_id === activeId,
      );
      const newIndex = newItems.findIndex(
        (item) => item.quiz_fragen_id === overItem.quiz_fragen_id,
      );
      if (oldIndex >= 0 && newIndex >= 0) {
        newItems = arrayMove(newItems, oldIndex, newIndex);
      }
    }

    newItems = newItems.map((item, index) => ({
      ...item,
      sortierung: index + 1,
    }));
    setItems(newItems);
    await saveBlockSortierung(newItems);
  }

  async function handlePunkteModusChange(
    quizFragenId: number,
    punkteModus: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.quiz_fragen_id === quizFragenId
          ? { ...item, punkte_modus: punkteModus }
          : item,
      ),
    );
    await updateQuizFragePunkteModus({
      quizId,
      quizFragenId,
      punkteModus,
    });
  }

  async function handleFreeAnswerChange(
    quizFragenId: number,
    freieAntwortErlaubt: boolean,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.quiz_fragen_id === quizFragenId
          ? {
              ...item,
              freie_antwort_erlaubt: freieAntwortErlaubt,
              effektiver_antwortmodus:
                item.kann_freie_antwort_aktivieren
                  ? freieAntwortErlaubt
                    ? "OPEN"
                    : "CLOSED"
                  : item.effektiver_antwortmodus,
            }
          : item,
      ),
    );
    await updateQuizQuestionFreeAnswerMode({
      quizId,
      quizFragenId,
      freieAntwortErlaubt,
    });
  }

  async function handleStoryPlacementOverrideChange(
    quizFragenId: number,
    storyElementId: number,
    placementOverride: StoryPlacementOverride,
  ) {
    const result = await updateQuizStoryPlacementOverride({
      quizId,
      quizFragenId,
      storyElementId,
      placementOverride,
    });
    if (!result.success) {
      setMeldung(result.message);
      return;
    }

    setItems((current) => current.map((item) =>
      item.quiz_fragen_id === quizFragenId
        ? {
            ...item,
            storyElements: item.storyElements.map((story) =>
              story.id === storyElementId
                ? { ...story, placementOverride }
                : story,
            ),
          }
        : item,
    ));
    setMeldung("Story-Position wurde gespeichert.");
  }

  async function handleResultDisplayModeChange(
    quizFragenId: number,
    mode: "STANDARD" | "LIVE",
  ) {
    try {
      await updateQuizQuestionResultDisplayMode({ quizId, quizFragenId, mode });
      setItems((current) => current.map((item) =>
        item.quiz_fragen_id === quizFragenId
          ? { ...item, ergebnisdarstellung: mode }
          : item,
      ));
      setMeldung(
        mode === "LIVE"
          ? "Live-Ergebnisse wurden aktiviert."
          : "Standard-Ergebnisse wurden aktiviert.",
      );
    } catch (error) {
      setMeldung(
        error instanceof Error
          ? error.message
          : "Die Ergebnisdarstellung konnte nicht gespeichert werden.",
      );
    }
  }

  const settingsActions: QuizQuestionSettingsActions = {
    onPunkteModusChange: handlePunkteModusChange,
    onFreeAnswerChange: handleFreeAnswerChange,
    onResultDisplayModeChange: handleResultDisplayModeChange,
    onStoryPlacementOverrideChange: handleStoryPlacementOverrideChange,
  };

  async function handleDeleteBlock(quizAbschnittId: number) {
    if (fragenrundeBlocks.length <= 1) {
      setMeldung("Mindestens ein Block muss bestehen bleiben.");
      return;
    }

    const ok = window.confirm(
      "Block wirklich löschen? Zugeordnete Fragen bleiben erhalten, sind danach aber ohne Block.",
    );
    if (!ok) {
      return;
    }

    await deleteQuizAbschnitt({ quizId, quizAbschnittId });
    setBlockItems((current) => synchronizeAutomaticBlockTitles(
      current.filter((block) => block.quiz_abschnitt_id !== quizAbschnittId),
    ));
    setItems((current) =>
      current.map((item) =>
        item.quiz_abschnitt_id === quizAbschnittId
          ? { ...item, quiz_abschnitt_id: null }
          : item,
      ),
    );
  }

  async function handleRenameBlock(quizAbschnittId: number, title: string) {
    const result = await updateQuizAbschnittTitel({
      quizId,
      quizAbschnittId,
      titel: title,
    });
    if (!result.success) {
      setMeldung(result.message);
      return;
    }
    setBlockItems((current) => current.map((block) =>
      block.quiz_abschnitt_id === quizAbschnittId
        ? { ...block, titel: result.titel }
        : block,
    ));
    setMeldung("Blocktitel wurde gespeichert.");
  }

  async function handleCreateBlock() {
    if (isCreatingBlock) {
      return;
    }

    setIsCreatingBlock(true);
    const result = await createQuizAbschnitt({
      quizId,
      titel: "",
      abschnittTyp: "fragenblock",
    });
    setIsCreatingBlock(false);

    if (!result.success) {
      setMeldung(result.message ?? "Block konnte nicht angelegt werden.");
      return;
    }

    setMeldung("Block wurde angelegt.");
    setBlockItems((current) => synchronizeAutomaticBlockTitles(
      [...current, result.abschnitt].sort(
        (left, right) => left.sortierung - right.sortierung,
      ),
    ));
  }

  function renderGroup(gruppe: Gruppe) {
    return (
      <DroppableBlock
        key={gruppe.key}
        gruppe={gruppe}
        quizId={quizId}
        istEingeklappt={eingeklappteGruppen.includes(gruppe.containerId)}
        onToggleGruppe={toggleGruppe}
        settingsActions={settingsActions}
        onRemove={handleRemoveFrage}
        onRemovePoll={handleRemovePoll}
        onDeleteBlock={handleDeleteBlock}
        onRenameBlock={handleRenameBlock}
        fragenrundenAnzahl={fragenrundeBlocks.length}
      />
    );
  }

  return (
    <>
      <DndContext
        id={`quiz-structure-${quizId}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fragenrundeBlocks.map((block) =>
            getContainerId(block.quiz_abschnitt_id),
          )}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {introGruppe && renderGroup(introGruppe)}

            <section className="rounded-3xl border border-slate-300 bg-white p-3 shadow-sm sm:p-4" aria-label="Fragenblöcke">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-slate-900">Fragenblöcke</h2>
                  <p className="mt-1 text-xs text-slate-500">Fragen, Auflösungen und Story-Elemente gemeinsam strukturieren.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateBlock}
                  disabled={isCreatingBlock}
                  className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingBlock ? "Wird angelegt …" : "+ Block hinzufügen"}
                </button>
              </div>
              <div className="space-y-3">
                {fragenGruppen.map(renderGroup)}
              </div>
              {meldung && <p role="status" className="mt-3 text-sm font-medium text-slate-600">{meldung}</p>}
            </section>

            {keinBlockGruppe && renderGroup(keinBlockGruppe)}
            {outroGruppe && renderGroup(outroGruppe)}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}
