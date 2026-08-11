"use client";

import StoryElementEditor, { type StoryElementEditorOptions } from "./StoryElementEditor";
import type { StoryElementScopeValue, StoryElementStatusValue, StoryElementType } from "./storyElement";

export type CreatedStoryElement = { id: number; title: string; description: string | null; type: StoryElementType; status: StoryElementStatusValue; scope: StoryElementScopeValue; eventSeriesId: number | null; eventSeriesName: string | null };

export default function StoryElementCreateDialog({ open, options, onClose, onCreated }: { open: boolean; options: StoryElementEditorOptions; onClose: () => void; onCreated: (story: CreatedStoryElement) => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-2 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="story-create-title">
    <div className="mx-auto min-h-full max-w-4xl rounded-2xl bg-slate-50 p-4 pb-48 shadow-2xl sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 id="story-create-title" className="text-xl font-black">Neues Story-Element</h2><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold">Schließen</button></div>
      <StoryElementEditor options={options} canEdit canArchive={false} onCancel={onClose} onCreated={onCreated} />
    </div>
  </div>;
}
