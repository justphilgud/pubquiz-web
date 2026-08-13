"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  createQuizAbschnitt,
  updateQuizAbschnitteSortierung,
} from "../actions";
import { isQuestionSection } from "../quizSectionPolicy";

type Abschnitt = {
  quiz_abschnitt_id: number;
  titel: string;
  abschnitt_typ: string;
  sortierung: number;
  dauer_sekunden: number | null;
  qr_code_url: string | null;
  medien_datei: string | null;
  bemerkung: string | null;
};

function SortableBlock({
  abschnitt,
}: {
  abschnitt: Abschnitt;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: abschnitt.quiz_abschnitt_id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold">
            {abschnitt.sortierung}. {abschnitt.titel}
          </div>

          <div className="text-sm text-slate-500">
            Typ: {abschnitt.abschnitt_typ}
          </div>
        </div>

        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab rounded-xl px-3 py-2 text-lg font-bold text-slate-400 transition hover:text-slate-700 active:cursor-grabbing"
        >
          <span className="text-lg leading-none">⋮⋮</span>
        </button>
      </div>
    </div>
  );
}

export default function QuizAbschnitteForm({
  quizId,
  abschnitte,
}: {
  quizId: number;
  abschnitte: Abschnitt[];
}) {
  const [titel, setTitel] = useState("");
  const [meldung, setMeldung] = useState("");
  const [items, setItems] = useState(abschnitte.filter(isQuestionSection));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  async function handleCreate() {
    const result = await createQuizAbschnitt({
      quizId,
      titel: titel.trim(),
      abschnittTyp: "fragenblock",
      bemerkung: "",
      qrCodeUrl: "",
      medienDatei: "",
    });

    if (!result.success) {
      setMeldung(result.message ?? "Fehler beim Anlegen.");
      return;
    }

    setTitel("");
    setMeldung("Block wurde angelegt.");
    setItems((current) =>
      [...current, result.abschnitt].sort(
        (left, right) => left.sortierung - right.sortierung,
      ),
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex(
      (item) => item.quiz_abschnitt_id === active.id
    );

    const newIndex = items.findIndex(
      (item) => item.quiz_abschnitt_id === over.id
    );

    const newItems = arrayMove(items, oldIndex, newIndex).map(
      (item, index) => ({
        ...item,
        sortierung: index + 1,
      })
    );

    setItems(newItems);

    await updateQuizAbschnitteSortierung({
      quizId,
      items: newItems.map((item) => ({
        quizAbschnittId: item.quiz_abschnitt_id,
        sortierung: item.sortierung,
      })),
    });
  }
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h2 className="text-xl font-semibold">Blöcke</h2>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3"
          placeholder="z. B. Block 1"
        />

        <button
          type="button"
          onClick={handleCreate}
          className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          Block hinzufügen
        </button>
      </div>

      {meldung && (
        <p className="mt-3 text-sm text-slate-500">
          {meldung}
        </p>
      )}

      <div className="mt-5">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            Noch keine Blöcke angelegt.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((item) => item.quiz_abschnitt_id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {items.map((abschnitt) => (
                  <SortableBlock
                    key={abschnitt.quiz_abschnitt_id}
                    abschnitt={abschnitt}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </section>
  );
}
