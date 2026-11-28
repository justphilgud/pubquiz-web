'use client';
import {useId,type ReactNode} from 'react';
import {DndContext,PointerSensor,KeyboardSensor,closestCenter,useSensor,useSensors} from '@dnd-kit/core';
import {SortableContext,useSortable,verticalListSortingStrategy,sortableKeyboardCoordinates,arrayMove} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

export function SortableRound({id,disabled,children}:{id:string;disabled:boolean;children:(handle:ReactNode)=>ReactNode}) {
  const {attributes,listeners,setNodeRef,transform,transition}=useSortable({id,disabled});
  const handle=<button type="button" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-lg font-semibold text-slate-400 transition hover:bg-white hover:text-slate-800 active:cursor-grabbing" disabled={disabled} {...attributes} {...listeners} aria-label="Runde verschieben" title="Runde verschieben" style={{touchAction:"none",cursor:"grab"}}>⠿</button>;
  return <div ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition}}>{children(handle)}</div>;
}
export default function SortableRounds({ids,disabled,onChange,children}:{ids:string[];disabled:boolean;onChange:(ids:string[])=>void;children:ReactNode}) {
  const id=useId();
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
  return <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={({active,over})=>{if(disabled||!over||active.id===over.id)return;const from=ids.indexOf(String(active.id)),to=ids.indexOf(String(over.id));if(from>=0&&to>=0)onChange(arrayMove(ids,from,to));}}><SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext></DndContext>;
}
