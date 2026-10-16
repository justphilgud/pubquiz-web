"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveContentQuestion, cloneContent, setContentArchived } from "./actions";
import ContentQuizAssignment from "./ContentQuizAssignment";
import type { ContentQuizOption, ContentSearchItem } from "./contentLibrary";

export default function ContentActions({ item, quizzes, returnTo, onNavigate, onUpdated }: { item: ContentSearchItem; quizzes: ContentQuizOption[]; detailsId: string; returnTo?: string; onNavigate?: () => void; onUpdated?: (item: ContentSearchItem) => void }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function approve() {
    if (!item.updatedAt) return;
    startTransition(async () => {
      try {
        const result = await approveContentQuestion({ questionId: item.id, expectedUpdatedAt: item.updatedAt! });
        setMessage(result.message);
        if (result.success && result.item) onUpdated?.(result.item);
      } catch { setMessage("Freigabe nicht möglich. Bitte aktuellen Stand und Berechtigung prüfen."); }
    });
  }
  function runClone() { startTransition(async () => { const result = await cloneContent(item.contentType, item.id); setMessage(result.message); if (result.success && result.href) router.push(result.href); }); }
  function runArchive() { const reason = item.contentType === "QUESTION" && !item.archived ? window.prompt("Archivierungsgrund") ?? "" : ""; if (item.contentType === "QUESTION" && !item.archived && !reason) return; startTransition(async () => { const result = await setContentArchived(item.contentType, item.id, !item.archived, reason); setMessage(result.message); if (result.success) window.location.reload(); }); }
  return <div className="mt-5 space-y-3">
    <div className="flex flex-wrap gap-2">
      <Link href={returnTo ? `${item.editHref}?returnTo=${encodeURIComponent(returnTo)}` : item.editHref} onClick={onNavigate} className="inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Bearbeiten</Link>
      {item.canApprove && <button type="button" disabled={pending} onClick={approve} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">Freigeben</button>}
      {item.canClone && <button type="button" disabled={pending} onClick={runClone} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold disabled:opacity-50">Klonen</button>}
      {item.canArchive && <button type="button" disabled={pending} onClick={runArchive} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold disabled:opacity-50">{item.archived ? "Reaktivieren" : "Archivieren"}</button>}
    </div>
    <ContentQuizAssignment contentType={item.contentType} contentId={item.id} quizzes={quizzes} assignedQuizIds={item.quizUsages.map((usage) => usage.quizId)} assignableQuizIds={item.assignableQuizIds} disabled={item.archived || pending} />
    {message && <p role="status" className="text-xs font-semibold text-slate-700">{message}</p>}
  </div>;
}
