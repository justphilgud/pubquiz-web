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
  updatePraesentationslayout,
  updateQuizAbschnitteSortierung,
  updateQuizFragePunkteModus,
  updateQuizQuestionFreeAnswerMode,
  updateQuizFragenBlockSortierung,
} from "../actions";

type Abschnitt = {
  quiz_abschnitt_id: number;
  titel: string;
  abschnitt_typ: string;
};

type Gruppe = {
  key: string;
  titel: string;
  containerId: string;
  quizAbschnittId: number | null;
  fragen: QuizQuestion[];
  blockTyp: "intro" | "outro" | "fragenblock" | "kein-block";
};

type Props = {
  quizId: number;
  fragen: QuizQuestion[];
  abschnitte: Abschnitt[];
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

function FixedSlideItem({
  quizId,
  slide,
  typ,
  index,
}: {
  quizId: number;
  slide: readonly [string, string] | readonly [string, string, string];
  typ: "Intro" | "Outro";
  index: number;
}) {
  const [key, titel, beschreibung] = slide;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
      <span className="flex h-9 min-w-9 items-center justify-center self-start rounded-lg bg-slate-100 px-2 text-sm font-black text-slate-600">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900">{titel}</div>
        {beschreibung && (
          <div className="mt-1 text-sm text-slate-500">{beschreibung}</div>
        )}
        <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {typ} · Fixiert
        </div>
      </div>
      <a
        href={`/quiz/${quizId}/slides/${key}`}
        className="inline-flex items-center justify-center self-start rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
      >
        Konfigurieren
      </a>
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
  onDeleteBlock,
  fragenrundenAnzahl,
}: {
  gruppe: Gruppe;
  quizId: number;
  istEingeklappt: boolean;
  onToggleGruppe: (containerId: string) => void;
  settingsActions: QuizQuestionSettingsActions;
  onRemove: (quizFragenId: number) => void;
  onDeleteBlock: (quizAbschnittId: number) => void | Promise<void>;
  fragenrundenAnzahl: number;
}) {
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
      droppable: false,
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

        <button
          type="button"
          onClick={() => onToggleGruppe(gruppe.containerId)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={!istEingeklappt}
        >
          <span className="block font-black text-slate-900">
            {gruppe.titel}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
            {festeSlides === null ? (
              <>
                <span>
                  {gruppe.blockTyp === "fragenblock"
                    ? "Fragenblock"
                    : "Ohne Block"}
                </span>
                <span>
                  {gruppe.fragen.length}{" "}
                  {gruppe.fragen.length === 1 ? "Frage" : "Fragen"}
                </span>
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
          <SortableContext
            items={gruppe.fragen.map((frage) => frage.quiz_fragen_id)}
            strategy={verticalListSortingStrategy}
          >
            {gruppe.blockTyp === "intro" ? (
              introSlides.map((slide, index) => (
                <FixedSlideItem
                  key={slide[0]}
                  quizId={quizId}
                  slide={slide}
                  typ="Intro"
                  index={index}
                />
              ))
            ) : gruppe.blockTyp === "outro" ? (
              outroSlides.map((slide, index) => (
                <FixedSlideItem
                  key={slide[0]}
                  quizId={quizId}
                  slide={slide}
                  typ="Outro"
                  index={index}
                />
              ))
            ) : gruppe.fragen.length === 0 ? (
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
            ) : (
              gruppe.fragen.map((frage, index) => (
                <QuizQuestionItem
                  key={frage.quiz_fragen_id}
                  frage={frage}
                  index={index}
                  quizId={quizId}
                  containerId={gruppe.containerId}
                  settingsActions={settingsActions}
                  onRemove={onRemove}
                />
              ))
            )}
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
}: Props) {
  const [items, setItems] = useState<QuizQuestion[]>(fragen);
  const [blockItems, setBlockItems] = useState(abschnitte);
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [meldung, setMeldung] = useState("");
  const [eingeklappteGruppen, setEingeklappteGruppen] = useState<string[]>([]);

  function handleRemoveFrage(quizFragenId: number) {
    setItems((current) =>
      current.filter((item) => item.quiz_fragen_id !== quizFragenId),
    );
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
    ...fragenrundeBlocks.map((abschnitt, index) => ({
      key: `block-${abschnitt.quiz_abschnitt_id}`,
      titel: abschnitt.titel || `Block ${index + 1}`,
      containerId: getContainerId(abschnitt.quiz_abschnitt_id),
      quizAbschnittId: abschnitt.quiz_abschnitt_id,
      blockTyp: "fragenblock" as const,
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
      fragen: items
        .filter((frage) => frage.quiz_abschnitt_id == null)
        .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0)),
    },
  ];

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

    const activeId = Number(active.id);
    const activeItem = findItem(activeId);
    if (!activeItem) {
      return;
    }

    const overItem =
      typeof over.id === "number" ? findItem(Number(over.id)) : undefined;
    const zielContainerId = overItem
      ? getContainerId(overItem.quiz_abschnitt_id)
      : String(over.id);

    if (!zielContainerId.startsWith("block-")) {
      return;
    }

    const zielAbschnittId = getAbschnittIdFromContainer(zielContainerId);
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

      const neueFragenrunden = arrayMove(
        fragenrundeBlocks,
        oldIndex,
        newIndex,
      );
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
        items: neueBlockItems.map((block) => ({
          quizAbschnittId: block.quiz_abschnitt_id,
          sortierung: block.sortierung,
        })),
      });
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

  async function handleLayoutChange(
    quizFragenId: number,
    praesentationslayout: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.quiz_fragen_id === quizFragenId
          ? { ...item, praesentationslayout }
          : item,
      ),
    );
    await updatePraesentationslayout({
      quizFragenId,
      praesentationslayout,
      quizId,
    });
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

  const settingsActions: QuizQuestionSettingsActions = {
    onLayoutChange: handleLayoutChange,
    onPunkteModusChange: handlePunkteModusChange,
    onFreeAnswerChange: handleFreeAnswerChange,
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
    setBlockItems((current) =>
      current.filter((block) => block.quiz_abschnitt_id !== quizAbschnittId),
    );
    setItems((current) =>
      current.map((item) =>
        item.quiz_abschnitt_id === quizAbschnittId
          ? { ...item, quiz_abschnitt_id: null }
          : item,
      ),
    );
  }

  async function handleCreateBlock() {
    if (isCreatingBlock) {
      return;
    }

    const titel = `Block ${fragenrundeBlocks.length + 1}`;
    setIsCreatingBlock(true);
    const result = await createQuizAbschnitt({
      quizId,
      titel,
      abschnittTyp: "fragenblock",
    });
    setIsCreatingBlock(false);

    if (!result.success) {
      setMeldung(result.message ?? "Block konnte nicht angelegt werden.");
      return;
    }

    setMeldung("Block wurde angelegt.");
    window.location.reload();
  }

  return (
    <>
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCreateBlock}
            disabled={isCreatingBlock}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isCreatingBlock ? "Wird angelegt..." : "Block hinzufügen"}
          </button>
        </div>
        {meldung && (
          <div className="mt-3 text-sm font-medium text-slate-500">
            {meldung}
          </div>
        )}
      </div>

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
          <div className="space-y-3">
            {gruppen.map((gruppe) => (
              <DroppableBlock
                key={gruppe.key}
                gruppe={gruppe}
                quizId={quizId}
                istEingeklappt={eingeklappteGruppen.includes(
                  gruppe.containerId,
                )}
                onToggleGruppe={toggleGruppe}
                settingsActions={settingsActions}
                onRemove={handleRemoveFrage}
                onDeleteBlock={handleDeleteBlock}
                fragenrundenAnzahl={fragenrundeBlocks.length}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}
