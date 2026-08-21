"use client";

import type { ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  ids: readonly string[];
  disabled?: boolean;
  onReorder: (ids: string[]) => void;
  children: (id: string, index: number, dragHandle: ReactNode) => ReactNode;
};

function SortableItem({
  id,
  index,
  disabled,
  children,
}: {
  id: string;
  index: number;
  disabled: boolean;
  children: Props["children"];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-70" : undefined}
    >
      {children(
        id,
        index,
        <button
          type="button"
          disabled={disabled}
          aria-label={`Position ${index + 1} verschieben`}
          className="sortable-template-drag-handle min-h-11 min-w-11 cursor-grab touch-none rounded-lg border border-slate-300 bg-white px-2 text-xl active:cursor-grabbing disabled:cursor-default"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>,
      )}
    </div>
  );
}

export function SortableTemplateList({
  ids,
  disabled = false,
  onReorder,
  children,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const from = ids.indexOf(String(event.active.id));
    const to = ids.indexOf(String(event.over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove([...ids], from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={[...ids]} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {ids.map((id, index) => (
            <SortableItem
              key={id}
              id={id}
              index={index}
              disabled={disabled}
            >
              {children}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
