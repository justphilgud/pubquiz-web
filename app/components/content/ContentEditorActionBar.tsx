"use client";

import type { ReactNode } from "react";

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
  return <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
    <div className="mx-auto max-w-4xl">{message}{secondaryOption && <div className="mb-2">{secondaryOption}</div>}<div className="grid gap-2 sm:grid-cols-3">
      <button type="button" onClick={onCancel} disabled={pending || !onCancel} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 font-semibold disabled:opacity-50">Abbrechen</button>
      <button type="button" onClick={onSaveDraft} disabled={pending || !onSaveDraft} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 font-semibold disabled:opacity-50">{draftLabel}</button>
      <button type="button" onClick={onPublish} disabled={pending || !onPublish} className="min-h-12 rounded-xl bg-slate-950 px-4 font-semibold text-white disabled:opacity-50">{publishLabel}</button>
    </div></div>
  </div>;
}
