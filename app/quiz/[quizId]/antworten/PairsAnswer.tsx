import { useId, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { readPairMatches, type PairOption } from "@/app/fragen/editor/templates/pairsTemplate";

function PairSource({ option, disabled, selected, onSelect }: {
  option: PairOption; disabled: boolean; selected: boolean; onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: option.id, disabled });
  return <button type="button" ref={setNodeRef} {...attributes} {...listeners}
    aria-pressed={selected} disabled={disabled} onClick={onSelect}
    style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
    className={`relative min-h-11 w-full touch-none break-words rounded-lg border p-2 text-left ${isDragging ? "z-10" : ""} ${selected ? "border-current bg-slate-100" : "border-slate-300"}`}>
    {option.text}
  </button>;
}

function PairTarget({ option, matchedText, disabled, onSelect }: {
  option: PairOption; matchedText?: string; disabled: boolean; onSelect: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: option.id, disabled });
  return <button type="button" ref={setNodeRef} disabled={disabled} onClick={onSelect}
    className={`min-h-11 w-full break-words rounded-lg border p-2 text-left ${isOver ? "border-current bg-slate-100" : "border-slate-300"}`}>
    {option.text}
    {matchedText && <span className="block text-xs">Zugeordnet · {matchedText}</span>}
  </button>;
}

export function PairsAnswer({ left, right, value, disabled, onChange }: {
  left: PairOption[]; right: PairOption[]; value?: string | null;
  disabled: boolean; onChange: (value: string) => void;
}) {
  const dndId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const matches = readPairMatches(value, left, right) ?? [];
  function match(leftId: string, rightId: string) {
    const remaining = matches.filter(([source, target]) => source !== leftId && target !== rightId);
    onChange(JSON.stringify([...remaining, [leftId, rightId]]));
    setSelected(null);
  }
  return <div className="mt-4 space-y-2" data-answer-interaction="MATCHING">
    <p className="text-sm">Ziehe einen linken Begriff nach rechts oder wähle beide nacheinander aus. Tippe eine bestehende Zuordnung rechts an, um sie zu lösen.</p>
    <DndContext id={dndId} sensors={sensors} onDragEnd={({ active, over }) => {
      if (!disabled && over) match(String(active.id), String(over.id));
    }}>
      <div className="grid grid-cols-2 items-start gap-2">
        <div className="min-w-0 space-y-2" role="group" aria-label="Linke Begriffe">
          {left.map((option) => <PairSource key={option.id} option={option} disabled={disabled}
            selected={selected === option.id} onSelect={() => setSelected(selected === option.id ? null : option.id)} />)}
        </div>
        <div className="min-w-0 space-y-2" role="group" aria-label="Rechte Begriffe">
          {right.map((option) => <PairTarget key={option.id} option={option} disabled={disabled}
            matchedText={left.find(({ id }) => id === matches.find(([, target]) => target === option.id)?.[0])?.text}
            onSelect={() => {
              if (selected) match(selected, option.id);
              else onChange(JSON.stringify(matches.filter(([, target]) => target !== option.id)));
            }} />)}
        </div>
      </div>
    </DndContext>
  </div>;
}
