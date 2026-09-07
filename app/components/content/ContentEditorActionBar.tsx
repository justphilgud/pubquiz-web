"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { observeEditorViewport } from "./contentEditorViewport";

export default function ContentEditorActionBar({ onCancel, onSaveDraft, onPublish, pending = false, draftLabel = "Entwurf speichern", publishLabel = "Speichern und freigeben", message, secondaryOption }: {
  onCancel?: () => void;
  onSaveDraft?: () => void;
  onPublish?: () => void;
  pending?: boolean;
  draftLabel?: string;
  publishLabel?: string;
  message?: ReactNode;
  secondaryOption?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const optionsId = useId();
  useEffect(() => barRef.current ? observeEditorViewport(barRef.current) : undefined, []);
  function run(action: (() => void) | undefined) {
    if (pending || !action) return;
    action();
    setExpanded(false);
  }
  const primaryIsDraft = !onPublish && Boolean(onSaveDraft);
  const buttonClass = "min-h-12 rounded-xl border px-4 font-semibold disabled:opacity-50";
  return <div ref={barRef} className="content-editor-action-bar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur" data-expanded={expanded} aria-busy={pending}>
    <div className="mx-auto max-w-4xl">
      {message && <div className="content-editor-feedback">{message}</div>}
      <div className="content-editor-actions" data-primary-draft={primaryIsDraft}>
        <div id={optionsId} className="content-editor-secondary">
          {secondaryOption && <div className="content-editor-extra">{secondaryOption}</div>}
          <button type="button" onClick={() => run(onCancel)} disabled={pending || !onCancel} className={`${buttonClass} content-editor-cancel border-slate-300 bg-white`}>Abbrechen</button>
          <button type="button" onClick={() => run(primaryIsDraft ? onPublish : onSaveDraft)} disabled={pending || !(primaryIsDraft ? onPublish : onSaveDraft)} className={`${buttonClass} content-editor-alternative border-slate-300 bg-white`}>{primaryIsDraft ? publishLabel : draftLabel}</button>
        </div>
        <button type="button" onClick={() => run(primaryIsDraft ? onSaveDraft : onPublish)} disabled={pending || !(primaryIsDraft ? onSaveDraft : onPublish)} className={`${buttonClass} content-editor-primary border-slate-950 bg-slate-950 text-white`}>{primaryIsDraft ? draftLabel : publishLabel}</button>
        <button type="button" className="content-editor-more min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold disabled:opacity-50" disabled={pending} aria-expanded={expanded} aria-controls={optionsId} onClick={() => setExpanded((value) => !value)}>Weitere Aktionen</button>
      </div>
    </div>
  </div>;
}
