"use client";

import React, { useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  closestCenter,
  useDroppable,
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
import QuizFrageEntfernenButton from "./QuizFrageEntfernenButton";
import QuizFrageVorschauButton from "./QuizFrageVorschauButton";
import {
  createQuizAbschnitt,
  deleteQuizAbschnitt,
  updatePraesentationslayout,
  updateQuizAbschnitteSortierung,
  updateQuizFragePunkteModus,
  updateQuizFragenBlockSortierung,
} from "../actions";

type QuizFrage = {
  quiz_fragen_id: number;
  sortierung: number | null;
  quiz_abschnitt_id: number | null;
  fragen_id: number;
  frage: string;
  schwierigkeitslevel: string | null;
  praesentationslayout: string | null;
  punkte_modus: string | null;
  kategorien: string[];
};

type Abschnitt = {
  quiz_abschnitt_id: number;
  titel: string;
};

type Gruppe = {
  key: string;
  titel: string;
  containerId: string;
  quizAbschnittId: number | null;
  fragen: QuizFrage[];
  blockTyp: "intro" | "outro" | "fragenrunde" | "kein-block";
};

type Props = {
  quizId: number;
  fragen: QuizFrage[];
  abschnitte: Abschnitt[];
  passwort: string;
};

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

function getBlockTyp(titel: string): Gruppe["blockTyp"] {
  const normalisiert = titel.trim().toLowerCase();

  if (normalisiert === "intro") return "intro";
  if (normalisiert === "outro") return "outro";

  return "fragenrunde";
}

function DragHandle({
  attributes,
  listeners,
}: {
  attributes: React.HTMLAttributes<HTMLButtonElement>;
  listeners: React.HTMLAttributes<HTMLButtonElement> | undefined;
}) {
  return (
    <button
      type="button"
      className="flex h-8 w-8 cursor-grab items-center justify-center rounded-full text-base font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 active:cursor-grabbing active:scale-95"
      title="Zum Sortieren ziehen"
      aria-label="Zum Sortieren ziehen"
      {...attributes}
      {...listeners}
    >
      ⋮⋮
    </button>
  );
}

function SortableRow({
  frage,
  index,
  quizId,
  onLayoutChange,
  onPunkteModusChange,
}: {
  frage: QuizFrage;
  index: number;
  quizId: number;
  onLayoutChange: (
    quizFragenId: number,
    praesentationslayout: string
  ) => void | Promise<void>;
  onPunkteModusChange: (
    quizFragenId: number,
    punkteModus: string
  ) => void | Promise<void>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: frage.quiz_fragen_id,
    data: {
      type: "frage",
      containerId: getContainerId(frage.quiz_abschnitt_id),
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-slate-50 ${isDragging ? "bg-slate-100" : ""}`}
    >
      <td className="px-4 py-3">{index + 1}</td>

      <td className="px-4 py-3">
        <DragHandle attributes={attributes} listeners={listeners} />
      </td>

      <td className="px-4 py-3 font-medium">{frage.frage}</td>

      <td className="px-4 py-3">
        {frage.kategorien.length > 0 ? frage.kategorien.join(", ") : "-"}
      </td>

      <td className="px-4 py-3">{frage.schwierigkeitslevel ?? "-"}</td>

      <td className="px-4 py-3">
        <select
          value={frage.praesentationslayout ?? "standard"}
          onChange={(e) =>
            onLayoutChange(frage.quiz_fragen_id, e.target.value)
          }
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
        >
          <option value="standard">Standard</option>
          <option value="bild_fokus">Bild-Fokus</option>
          <option value="antworten_fokus">Antworten-Fokus</option>
          <option value="audio_fokus">Audio-Fokus</option>
          <option value="text_fokus">Text-Fokus</option>
          <option value="hinweis_fokus">Hinweis-Fokus</option>
        </select>
      </td>

      <td className="px-4 py-3">
        <select
          value={frage.punkte_modus ?? "standard"}
          onChange={(e) =>
            onPunkteModusChange(frage.quiz_fragen_id, e.target.value)
          }
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
        >
          <option value="standard">Standard</option>
          <option value="expertenbonus">Expertenbonus</option>
          <option value="risikofrage">Risikofrage</option>
        </select>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <QuizFrageVorschauButton fragenId={frage.fragen_id} />

          <QuizFrageEntfernenButton
            quizId={quizId}
            quizFragenId={frage.quiz_fragen_id}
          />
        </div>
      </td>
    </tr>
  );
}

function SortableBlockHeader({
  gruppe,
  istEingeklappt,
  onToggleGruppe,
  onDeleteBlock,
  fragenrundenAnzahl,
}: {
  gruppe: Gruppe;
  istEingeklappt: boolean;
  onToggleGruppe: (containerId: string) => void;
  onDeleteBlock: (quizAbschnittId: number) => void | Promise<void>;
  fragenrundenAnzahl: number;
}) {
  const istFragenrunde = gruppe.blockTyp === "fragenrunde";

  return (
    <tr className="bg-slate-100">
      <td colSpan={8} className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-slate-700">
              {gruppe.titel}
              {istFragenrunde && ` · ${gruppe.fragen.length} Fragen`}
            </div>

            {!istFragenrunde && (
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Feste Slides
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleGruppe(gruppe.containerId)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
            >
              <span
                className={`text-xl leading-none transition-transform duration-200 ${istEingeklappt ? "rotate-0" : "rotate-180"
                  }`}
              >
                ⌄
              </span>
            </button>

            {istFragenrunde && fragenrundenAnzahl > 1 && gruppe.quizAbschnittId && (
              <button
                type="button"
                onClick={() => onDeleteBlock(gruppe.quizAbschnittId!)}
                className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50"
              >
                Block löschen
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function DroppableBlock({
  gruppe,
  quizId,
  passwort,
  istEingeklappt,
  onToggleGruppe,
  onLayoutChange,
  onPunkteModusChange,
  onDeleteBlock,
  fragenrundenAnzahl,
}: {
  gruppe: Gruppe;
  quizId: number;
  passwort: string;
  istEingeklappt: boolean;
  onToggleGruppe: (containerId: string) => void;
  onLayoutChange: (
    quizFragenId: number,
    praesentationslayout: string
  ) => void | Promise<void>;
  onPunkteModusChange: (
    quizFragenId: number,
    punkteModus: string
  ) => void | Promise<void>;
  onDeleteBlock: (quizAbschnittId: number) => void | Promise<void>;
  fragenrundenAnzahl: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: gruppe.containerId,
  });

  const introSlides = [
    ["vor-dem-start", "Wartebildschirm"],
    ["startsequenz", "Countdown bis zum Start"],
    ["begruessung", "Begrüßung", "Quizname und Willkommensgruß"],
    ["regeln", "Regeln", "Quizregeln und Ablauf"],
    ["preise", "Preise", "Preise für Platz 1 bis 3"],
  ];

  const outroSlides = [
    ["bekanntmachungen", "Bekanntmachungen", "Hinweise, nächste Termine und Abschlussinfos"],
  ];

  return (
    <React.Fragment>
      <SortableBlockHeader
        gruppe={gruppe}
        istEingeklappt={istEingeklappt}
        onToggleGruppe={onToggleGruppe}
        onDeleteBlock={onDeleteBlock}
        fragenrundenAnzahl={fragenrundenAnzahl}
      />

      {!istEingeklappt && (
        <SortableContext
          items={gruppe.fragen.map((frage) => frage.quiz_fragen_id)}
          strategy={verticalListSortingStrategy}
        >
          {gruppe.blockTyp === "intro" ? (
            <>
              {introSlides.map(([key, titel, beschreibung], index) => (
                <tr key={key} className="bg-white hover:bg-slate-50">
                  <td className="px-4 py-5 text-center font-semibold text-slate-400">
                    {index + 1}
                  </td>

                  <td className="px-4 py-5 text-slate-300">—</td>

                  <td className="px-4 py-5">
                    <div className="font-semibold text-slate-900">
                      {titel}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {beschreibung}
                    </div>
                  </td>

                  <td className="px-4 py-5 text-sm text-slate-400">
                    Intro
                  </td>

                  <td className="px-4 py-5 text-slate-300">—</td>

                  <td className="px-4 py-5 text-slate-300">Fixiert</td>

                  <td className="px-4 py-5 text-slate-300">—</td>

                  <td className="px-4 py-5">
                    <a
                      href={`/quiz/${quizId}/slides/${key}?passwort=${passwort}`}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                    >
                      Konfigurieren
                    </a>
                  </td>
                </tr>
              ))}
            </>
          ) : gruppe.blockTyp === "outro" ? (
            <>
              {outroSlides.map(([key, titel, beschreibung], index) => (
                <tr key={key} className="bg-white hover:bg-slate-50">
                  <td className="px-4 py-5 text-center font-semibold text-slate-400">
                    {index + 1}
                  </td>

                  <td className="px-4 py-5 text-slate-300">—</td>

                  <td className="px-4 py-5">
                    <div className="font-semibold text-slate-900">
                      {titel}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {beschreibung}
                    </div>
                  </td>

                  <td className="px-4 py-5 text-sm text-slate-400">
                    Outro
                  </td>

                  <td className="px-4 py-5 text-slate-300">—</td>

                  <td className="px-4 py-5 text-slate-300">Fixiert</td>

                  <td className="px-4 py-5 text-slate-300">—</td>

                  <td className="px-4 py-5">
                    <a
                      href={`/quiz/${quizId}/slides/${key}?passwort=${passwort}`}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                    >
                      Konfigurieren
                    </a>
                  </td>
                </tr>
              ))}
            </>
          ) : gruppe.fragen.length === 0 ? (
            gruppe.blockTyp === "fragenrunde" ? (
              <tr ref={setNodeRef}>
                <td
                  colSpan={8}
                  className={`px-4 py-6 text-sm font-medium transition ${isOver
                      ? "bg-cyan-50 text-cyan-700"
                      : "bg-white text-slate-400"
                    }`}
                >
                  Frage hier ablegen
                </td>
              </tr>
            ) : null
          ) : (
            gruppe.fragen.map((frage, index) => (
              <SortableRow
                key={frage.quiz_fragen_id}
                frage={frage}
                index={index}
                quizId={quizId}
                onLayoutChange={onLayoutChange}
                onPunkteModusChange={onPunkteModusChange}
              />
            ))
          )}
        </SortableContext>
      )}
    </React.Fragment>
  );
}

export default function QuizFragenSortableTable({
  quizId,
  fragen,
  abschnitte,
  passwort,
}: Props) {
  const [items, setItems] = useState<QuizFrage[]>(fragen);
  const [blockItems, setBlockItems] = useState(abschnitte);
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [meldung, setMeldung] = useState("");
  const [mounted, setMounted] = useState(false);
  const [eingeklappteGruppen, setEingeklappteGruppen] = useState<string[]>([]);

  function toggleGruppe(containerId: string) {
    setEingeklappteGruppen((current) =>
      current.includes(containerId)
        ? current.filter((id) => id !== containerId)
        : [...current, containerId]
    );
  }

  useEffect(() => {
    setBlockItems(abschnitte);
  }, [abschnitte]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const introBlock =
    blockItems.find((block) => getBlockTyp(block.titel) === "intro") ?? null;

  const outroBlock =
    blockItems.find((block) => getBlockTyp(block.titel) === "outro") ?? null;

  const fragenrundeBlocks = blockItems.filter(
    (block) => getBlockTyp(block.titel) === "fragenrunde"
  );

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
                Number(introBlock.quiz_abschnitt_id)
            )
            .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0)),
        },
      ]
      : []),

    ...fragenrundeBlocks.map((abschnitt, index) => ({
      key: `block-${abschnitt.quiz_abschnitt_id}`,
      titel: `Block ${index + 1}`,
      containerId: getContainerId(abschnitt.quiz_abschnitt_id),
      quizAbschnittId: abschnitt.quiz_abschnitt_id,
      blockTyp: "fragenrunde" as const,
      fragen: items
        .filter(
          (frage) =>
            Number(frage.quiz_abschnitt_id) ===
            Number(abschnitt.quiz_abschnitt_id)
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
                Number(outroBlock.quiz_abschnitt_id)
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

  function saveBlockSortierung(newItems: QuizFrage[]) {
    return updateQuizFragenBlockSortierung({
      quizId,
      items: newItems.map((item, index) => ({
        quizFragenId: item.quiz_fragen_id,
        quizAbschnittId: item.quiz_abschnitt_id,
        sortierung: index + 1,
      })),
    });
  }

  async function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    if (active.data.current?.type === "block") {
      return;
    }

    const activeId = Number(active.id);
    const activeItem = findItem(activeId);

    if (!activeItem) {
      return;
    }

    const overId = String(over.id);

    const overItem =
      typeof over.id === "number" ? findItem(Number(over.id)) : undefined;

    const zielContainerId = overItem
      ? getContainerId(overItem.quiz_abschnitt_id)
      : overId;

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
          ? {
            ...item,
            quiz_abschnitt_id: zielAbschnittId,
          }
          : item
      )
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.data.current?.type === "block") {
      if (!over || active.id === over.id) {
        return;
      }

      let zielBlockId = String(over.id);

      const overFrage = items.find(
        (item) => item.quiz_fragen_id === Number(over.id)
      );

      if (overFrage) {
        zielBlockId = getContainerId(overFrage.quiz_abschnitt_id);
      }

      const oldIndex = fragenrundeBlocks.findIndex(
        (block) => getContainerId(block.quiz_abschnitt_id) === active.id
      );

      const newIndex = fragenrundeBlocks.findIndex(
        (block) => getContainerId(block.quiz_abschnitt_id) === zielBlockId
      );

      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      const neueFragenrunden = arrayMove(
        fragenrundeBlocks,
        oldIndex,
        newIndex
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
        (item) => item.quiz_fragen_id === activeId
      );
      const newIndex = newItems.findIndex(
        (item) => item.quiz_fragen_id === overItem.quiz_fragen_id
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
    praesentationslayout: string
  ) {
    setItems((current) =>
      current.map((item) =>
        item.quiz_fragen_id === quizFragenId
          ? {
            ...item,
            praesentationslayout,
          }
          : item
      )
    );

    await updatePraesentationslayout({
      quizFragenId,
      praesentationslayout,
      quizId,
    });
  }

  async function handlePunkteModusChange(
    quizFragenId: number,
    punkteModus: string
  ) {
    setItems((current) =>
      current.map((item) =>
        item.quiz_fragen_id === quizFragenId
          ? {
            ...item,
            punkte_modus: punkteModus,
          }
          : item
      )
    );

    await updateQuizFragePunkteModus({
      quizId,
      quizFragenId,
      punkteModus,
    });
  }

  async function handleDeleteBlock(quizAbschnittId: number) {
    if (fragenrundeBlocks.length <= 1) {
      setMeldung("Mindestens ein Block muss bestehen bleiben.");
      return;
    }

    const ok = window.confirm(
      "Block wirklich löschen? Zugeordnete Fragen bleiben erhalten, sind danach aber ohne Block."
    );

    if (!ok) return;

    await deleteQuizAbschnitt({
      quizId,
      quizAbschnittId,
    });

    setBlockItems((current) =>
      current.filter((block) => block.quiz_abschnitt_id !== quizAbschnittId)
    );

    setItems((current) =>
      current.map((item) =>
        item.quiz_abschnitt_id === quizAbschnittId
          ? {
            ...item,
            quiz_abschnitt_id: null,
          }
          : item
      )
    );
  }

  async function handleCreateBlock() {
    if (isCreatingBlock) return;

    const titel = `Block ${fragenrundeBlocks.length + 1}`;

    setIsCreatingBlock(true);

    const result = await createQuizAbschnitt({
      quizId,
      titel,
      abschnittTyp: "fragenrunde",
    });

    setIsCreatingBlock(false);

    if (!result.success || !result.abschnitt) {
      setMeldung(result.message ?? "Block konnte nicht angelegt werden.");
      return;
    }

    setMeldung("Block wurde angelegt.");
    window.location.reload();
  }

  if (!mounted) {
    return null;
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

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full border-collapse bg-white text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nr.</th>
                <th className="px-4 py-3">Sort.</th>
                <th className="px-4 py-3">Frage</th>
                <th className="px-4 py-3">Kategorien</th>
                <th className="px-4 py-3">Schwierigkeit</th>
                <th className="px-4 py-3">Layout</th>
                <th className="px-4 py-3">Punkte</th>
                <th className="px-4 py-3">Aktionen</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              <SortableContext
                items={fragenrundeBlocks.map((block) =>
                  getContainerId(block.quiz_abschnitt_id)
                )}
                strategy={verticalListSortingStrategy}
              >
                {gruppen.map((gruppe) => (
                  <DroppableBlock
                    key={gruppe.key}
                    gruppe={gruppe}
                    quizId={quizId}
                    passwort={passwort}
                    istEingeklappt={eingeklappteGruppen.includes(gruppe.containerId)}
                    onToggleGruppe={toggleGruppe}
                    onLayoutChange={handleLayoutChange}
                    onPunkteModusChange={handlePunkteModusChange}
                    onDeleteBlock={handleDeleteBlock}
                    fragenrundenAnzahl={fragenrundeBlocks.length}
                  />
                ))}
              </SortableContext>
            </tbody>
          </table>
        </DndContext>
      </div>
    </>
  );
}