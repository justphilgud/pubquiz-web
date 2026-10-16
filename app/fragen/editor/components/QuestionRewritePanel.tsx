"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { QuestionEditorMessages } from "@/app/i18n/messageTypes";
import {
  isQuestionRewriteErrorCode,
  isQuestionRewriteSuccessResponse,
  QUESTION_REWRITE_MAX_LENGTH,
  type QuestionRewriteHistoryEntry,
} from "../questionRewrite";
import { QuestionRewriteController, QuestionRewriteRequestError } from "../questionRewriteController";
import { diffQuestionText, type QuestionTextDiffPart } from "../questionTextDiff";
import { CharacterCount } from "./CharacterCount";

type QuestionRewritePanelProps = {
  questionText: string;
  inputRevision?: number;
  disabled: boolean;
  messages: QuestionEditorMessages["question"]["rewrite"];
  onAccept: (questionText: string) => void;
};

function DiffText({
  parts,
  side,
}: {
  parts: QuestionTextDiffPart[];
  side: "original" | "proposal";
}) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
      {parts.flatMap((part, index) => {
        if (part.kind === "added" && side === "original") return [];
        if (part.kind === "removed" && side === "proposal") return [];
        if (part.kind === "same") return [<span key={index}>{part.text}</span>];
        return [
          <mark
            key={index}
            className={part.kind === "added"
              ? "rounded bg-emerald-100 text-emerald-950"
              : "rounded bg-rose-100 text-rose-950 line-through"}
          >
            {part.text}
          </mark>,
        ];
      })}
    </p>
  );
}

function formatTokens(usage: QuestionRewriteHistoryEntry["usage"]) {
  return usage
    ? `${usage.promptTokens} + ${usage.completionTokens} = ${usage.totalTokens}`
    : "–";
}

function formatCost(cost: QuestionRewriteHistoryEntry["cost"]) {
  if (!cost) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(cost.amountUsd);
}

async function requestProposal(questionText: string, signal: AbortSignal) {
  try {
    const response = await fetch("/api/question-rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionText }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(14_000)]),
    });
    let payload: unknown;
    try { payload = await response.json(); }
    catch { throw new QuestionRewriteRequestError("PROVIDER_RESPONSE_INVALID"); }
    if (response.ok && isQuestionRewriteSuccessResponse(payload)) return payload;
    const code = payload && typeof payload === "object" && "code" in payload ? payload.code : null;
    throw new QuestionRewriteRequestError(isQuestionRewriteErrorCode(code) ? code : "PROVIDER_RESPONSE_INVALID");
  } catch (error) {
    if (error instanceof QuestionRewriteRequestError) throw error;
    throw new QuestionRewriteRequestError(error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name) ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE");
  }
}

export function QuestionRewritePanel({
  questionText,
  inputRevision = 0,
  disabled,
  messages,
  onAccept,
}: QuestionRewritePanelProps) {
  const [controller] = useState(() => new QuestionRewriteController(requestProposal));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.setInput(questionText, inputRevision); }, [controller, questionText, inputRevision]);
  useEffect(() => () => controller.dispose(), [controller]);
  const { pending: isPending, session } = state;
  const error = state.error ? messages.errors[state.error] : null;
  const notice = state.notice === "stale" ? messages.staleProposal : state.notice === "accepted" ? messages.acceptedNotice : null;
  const { active, history, cumulativeUsage } = session;
  const diff = useMemo(
    () => active ? diffQuestionText(active.original, active.proposal) : [],
    [active],
  );

  const requestRewrite = () => controller.request(questionText, inputRevision, disabled);

  function acceptProposal() {
    const proposal = controller.accept(questionText, inputRevision, disabled);
    if (!proposal) return;
    onAccept(proposal);
  }

  function discardProposal() {
    controller.discard();
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-4" data-question-rewrite>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void requestRewrite()}
          disabled={disabled || isPending || questionText.trim().length === 0}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? messages.requesting : messages.request}
        </button>
        <p className="text-xs text-slate-600">{messages.help}</p>
      </div>

      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm font-medium text-emerald-700">{notice}</p>}

      {active && (
        <div className="mt-4 space-y-4">
          {questionText !== active.original && <p role="status">{messages.staleProposal}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-950">{messages.original}</h3>
              <div className="mt-2"><DiffText parts={diff} side="original" /></div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-slate-950">{messages.proposal}</h3>
              <div className="mt-2 rounded-lg bg-slate-50 p-2">
                <DiffText parts={diff} side="proposal" />
              </div>
              <label htmlFor="questionRewriteProposal" className="mt-3 block text-xs font-semibold text-slate-700">
                {messages.editProposal}
              </label>
              <textarea
                id="questionRewriteProposal"
                value={active.proposal}
                maxLength={QUESTION_REWRITE_MAX_LENGTH}
                rows={4}
                disabled={disabled || isPending}
                onChange={(event) => {
                  const proposal = event.target.value;
                  controller.edit(proposal);
                }}
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
              />
              <CharacterCount current={active.proposal.length} maximum={QUESTION_REWRITE_MAX_LENGTH} warningAt={260} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={acceptProposal} disabled={disabled || isPending || !active.proposal.trim() || questionText !== active.original}
              className="min-h-11 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {messages.accept}
            </button>
            <button type="button" onClick={discardProposal} disabled={disabled || isPending}
              className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {messages.discard}
            </button>
            <button type="button" onClick={() => void requestRewrite()} disabled={disabled || isPending}
              className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {messages.retry}
            </button>
          </div>

          <dl className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
            <div><dt className="inline font-semibold">{messages.requestTokens}: </dt><dd className="inline">{formatTokens(active.usage)}</dd></div>
            <div><dt className="inline font-semibold">{messages.sessionTokens}: </dt><dd className="inline">{cumulativeUsage.totalTokens}</dd></div>
            <div><dt className="inline font-semibold">{messages.cost}: </dt><dd className="inline">{formatCost(active.cost) ?? messages.costUnavailable}</dd></div>
          </dl>
        </div>
      )}

      {history.length > 0 && (
        <details className="mt-4 rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-950">
            {messages.history} ({history.length})
          </summary>
          <ol className="mt-3 space-y-3">
            {history.map((entry, index) => (
              <li key={entry.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
                <p className="font-semibold">#{history.length - index}</p>
                <p className="mt-1">{entry.proposal}</p>
                <p className="mt-1 text-xs text-slate-600">{messages.requestTokens}: {formatTokens(entry.usage)}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
