"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ContentEditorActionBar from "@/app/components/content/ContentEditorActionBar";
import {
  attachLivePollToQuiz,
  createLivePoll,
  deleteUnusedLivePoll,
  duplicateLivePoll,
  setLivePollArchived,
  updateLivePoll,
} from "./actions";
import type {
  LivePollOption,
  LivePollPublicationMode,
  LivePollScope,
  LivePollStatus,
  LivePollType,
} from "./livePoll";
import type { LivePollRecord } from "./livePollRepository.server";

type EditorOptions = Awaited<ReturnType<typeof import("./livePollRepository.server").getLivePollEditorOptions>>;

type Props = {
  options: EditorOptions;
  initialPoll?: LivePollRecord;
  canEdit: boolean;
  canArchive: boolean;
};

const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100 disabled:text-slate-500";
const panelClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

function newOption(index: number): LivePollOption {
  return { id: `option-${index + 1}`, label: "" };
}

export default function LivePollEditor({ options, initialPoll, canEdit, canArchive }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<LivePollType>(initialPoll?.type ?? "SINGLE_CHOICE");
  const [prompt, setPrompt] = useState(initialPoll?.prompt ?? "");
  const [publicationMode, setPublicationMode] = useState<LivePollPublicationMode>(initialPoll?.publicationMode ?? "AUTOMATIC");
  const [pollOptions, setPollOptions] = useState<LivePollOption[]>(initialPoll?.options.length ? initialPoll.options : [newOption(0), newOption(1)]);
  const [moderatorNote, setModeratorNote] = useState(initialPoll?.moderatorNote ?? "");
  const [status, setStatus] = useState<Exclude<LivePollStatus, "ARCHIVED">>(initialPoll?.status === "ACTIVE" ? "ACTIVE" : "DRAFT");
  const [scope, setScope] = useState<LivePollScope>(initialPoll?.scope ?? (options.eventSeries.length ? "EVENT_SERIES" : "QUIZ"));
  const [eventSeriesId, setEventSeriesId] = useState(String(initialPoll?.eventSeriesId ?? options.eventSeries[0]?.eventreihe_id ?? ""));
  const [quizId, setQuizId] = useState(String(initialPoll?.quizId ?? options.quizzes[0]?.quiz_id ?? ""));
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(initialPoll ? new Date(initialPoll.updatedAt).toISOString() : "");
  const [attachQuizId, setAttachQuizId] = useState(String(initialPoll?.quizId ?? options.quizzes[0]?.quiz_id ?? ""));
  const selectedAttachQuiz = options.quizzes.find((quiz) => quiz.quiz_id === Number(attachQuizId));
  const [sectionId, setSectionId] = useState(String(selectedAttachQuiz?.quiz_abschnitte[0]?.quiz_abschnitt_id ?? ""));
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const scopeLocked = Boolean(initialPoll && initialPoll.usageCount > 0);
  const allowedScopes = useMemo(() => options.canUseGlobalScope ? ["GLOBAL", "EVENT_SERIES", "QUIZ"] as const : ["EVENT_SERIES", "QUIZ"] as const, [options.canUseGlobalScope]);

  function value(targetStatus: "DRAFT" | "ACTIVE") {
    return {
      type,
      prompt,
      publicationMode: type === "FREE_TEXT" ? publicationMode : "AUTOMATIC",
      options: type === "SINGLE_CHOICE" ? pollOptions : [],
      moderatorNote,
      status: targetStatus,
      scope,
      eventSeriesId: scope === "EVENT_SERIES" ? eventSeriesId : null,
      quizId: scope === "QUIZ" ? quizId : null,
    };
  }

  function save(targetStatus: "DRAFT" | "ACTIVE") {
    setMessage(null);
    startTransition(async () => {
      const result = initialPoll
        ? await updateLivePoll({ pollId: initialPoll.id, expectedUpdatedAt, value: value(targetStatus) })
        : await createLivePoll(value(targetStatus));
      if (!result.success) return setMessage({ tone: "error", text: result.message });
      setStatus(targetStatus);
      setExpectedUpdatedAt(result.updatedAt);
      setMessage({ tone: "success", text: result.message });
      if (!initialPoll) router.push(`/content/polls/${result.pollId}`);
      router.refresh();
    });
  }

  function run(action: () => Promise<{ success: boolean; message: string; pollId?: number }>, redirectTo?: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage({ tone: result.success ? "success" : "error", text: result.message });
      if (result.success && result.pollId && redirectTo === "duplicate") router.push(`/content/polls/${result.pollId}`);
      else if (result.success && redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }

  return <div className="space-y-5">
    <section className={panelClass}>
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-950">Umfrage</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{status === "ACTIVE" ? "Freigegeben" : "Entwurf"}</span></div>
      <p className="mt-1 text-sm text-slate-600">Eigenständiger Live-Inhalt ohne Punkte, Lösung oder Auswertung.</p>
      <fieldset className="mt-4 grid gap-3 md:grid-cols-2" disabled={!canEdit || pending}>
        <legend className="sr-only">Umfragetyp</legend>
        {(["SINGLE_CHOICE", "FREE_TEXT"] as const).map((item) => <label key={item} className={`cursor-pointer rounded-xl border p-4 ${type === item ? "border-cyan-600 bg-cyan-50" : "border-slate-200"}`}>
          <input className="mr-2" type="radio" checked={type === item} onChange={() => setType(item)} />
          <strong>{item === "SINGLE_CHOICE" ? "Auswahl" : "Freitext-Wall"}</strong>
          <span className="mt-1 block text-sm text-slate-600">{item === "SINGLE_CHOICE" ? "Teams können ihre Auswahl bis zum Schließen ändern." : "Kurze Beiträge erscheinen automatisch oder nach Freigabe."}</span>
        </label>)}
      </fieldset>
      <label className="mt-4 block text-sm font-semibold text-slate-800">Prompt<textarea className={`${inputClass} mt-1 min-h-24`} value={prompt} maxLength={300} disabled={!canEdit || pending} onChange={(event) => setPrompt(event.target.value)} /></label>
      {type === "SINGLE_CHOICE" ? <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between"><strong className="text-sm text-slate-800">Optionen (2–6)</strong><button type="button" className="text-sm font-semibold text-cyan-800 disabled:opacity-40" disabled={!canEdit || pending || pollOptions.length >= 6} onClick={() => setPollOptions((current) => [...current, newOption(current.length)])}>+ Option</button></div>
        {pollOptions.map((option, index) => <div className="flex gap-2" key={option.id}>
          <input className={inputClass} value={option.label} maxLength={160} disabled={!canEdit || pending} aria-label={`Option ${index + 1}`} onChange={(event) => setPollOptions((current) => current.map((item, optionIndex) => optionIndex === index ? { ...item, label: event.target.value } : item))} />
          <button type="button" className="rounded-xl border border-slate-300 px-3 text-slate-700 disabled:opacity-40" disabled={!canEdit || pending || pollOptions.length <= 2} onClick={() => setPollOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))}>Entfernen</button>
        </div>)}
      </div> : <fieldset className="mt-4" disabled={!canEdit || pending}>
        <legend className="text-sm font-semibold text-slate-800">Veröffentlichung</legend>
        <div className="mt-2 flex flex-wrap gap-3">{(["AUTOMATIC", "MODERATED"] as const).map((mode) => <label key={mode} className={`rounded-xl border px-4 py-3 ${publicationMode === mode ? "border-cyan-600 bg-cyan-50" : "border-slate-200"}`}><input className="mr-2" type="radio" checked={publicationMode === mode} onChange={() => setPublicationMode(mode)} />{mode === "AUTOMATIC" ? "Automatisch bereinigt" : "Nach Moderationsfreigabe"}</label>)}</div>
      </fieldset>}
      <label className="mt-4 block text-sm font-semibold text-slate-800">Interne Moderationsnotiz<textarea className={`${inputClass} mt-1 min-h-20`} value={moderatorNote} maxLength={2000} disabled={!canEdit || pending} onChange={(event) => setModeratorNote(event.target.value)} /></label>
    </section>

    <section className={panelClass}>
      <h2 className="text-lg font-semibold text-slate-950">Geltungsbereich</h2>
      {scopeLocked ? <p className="mt-1 text-sm text-amber-800">Bereits verwendete Umfragen behalten ihren Geltungsbereich.</p> : null}
      <div className="mt-3 grid gap-3 md:grid-cols-3">{allowedScopes.map((item) => <label key={item} className={`rounded-xl border p-3 ${scope === item ? "border-cyan-600 bg-cyan-50" : "border-slate-200"}`}><input className="mr-2" type="radio" checked={scope === item} disabled={!canEdit || pending || scopeLocked} onChange={() => setScope(item)} />{item === "GLOBAL" ? "Global" : item === "EVENT_SERIES" ? "Eventreihe" : "Quiz"}</label>)}</div>
      {scope === "EVENT_SERIES" ? <label className="mt-3 block text-sm font-semibold">Eventreihe<select className={`${inputClass} mt-1`} value={eventSeriesId} disabled={!canEdit || pending || scopeLocked} onChange={(event) => setEventSeriesId(event.target.value)}>{options.eventSeries.map((series) => <option key={series.eventreihe_id} value={series.eventreihe_id}>{series.name}</option>)}</select></label> : null}
      {scope === "QUIZ" ? <label className="mt-3 block text-sm font-semibold">Quiz<select className={`${inputClass} mt-1`} value={quizId} disabled={!canEdit || pending || scopeLocked} onChange={(event) => setQuizId(event.target.value)}>{options.quizzes.map((quiz) => <option key={quiz.quiz_id} value={quiz.quiz_id}>{quiz.eventreihe.name} · {quiz.titel ?? `Quiz #${quiz.quiz_id}`}</option>)}</select></label> : null}
    </section>

    {initialPoll ? <section className={panelClass}>
      <h2 className="text-lg font-semibold text-slate-950">In Quizblock einfügen</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <select className={inputClass} value={attachQuizId} disabled={pending} onChange={(event) => { const next = event.target.value; setAttachQuizId(next); const quiz = options.quizzes.find((item) => item.quiz_id === Number(next)); setSectionId(String(quiz?.quiz_abschnitte[0]?.quiz_abschnitt_id ?? "")); }}>{options.quizzes.map((quiz) => <option key={quiz.quiz_id} value={quiz.quiz_id}>{quiz.eventreihe.name} · {quiz.titel ?? `Quiz #${quiz.quiz_id}`}</option>)}</select>
        <select className={inputClass} value={sectionId} disabled={pending} onChange={(event) => setSectionId(event.target.value)}>{selectedAttachQuiz?.quiz_abschnitte.map((section) => <option key={section.quiz_abschnitt_id} value={section.quiz_abschnitt_id}>{section.titel ?? `Block #${section.quiz_abschnitt_id}`}</option>)}</select>
        <button type="button" className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={pending || !sectionId} onClick={() => run(() => attachLivePollToQuiz({ pollId: initialPoll.id, quizId: Number(attachQuizId), sectionId: Number(sectionId) }))}>Einfügen</button>
      </div>
    </section> : null}

    {message ? <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${message.tone === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{message.text}</p> : null}

    <ContentEditorActionBar
      pending={pending}
      onSaveDraft={canEdit ? () => save("DRAFT") : undefined}
      onPublish={canEdit ? () => save("ACTIVE") : undefined}
      onCancel={() => router.push("/content/polls")}
    />
    {initialPoll ? <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
      <button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold" disabled={pending} onClick={() => run(() => duplicateLivePoll(initialPoll.id), "duplicate")}>Duplizieren</button>
      {canArchive ? <button type="button" className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900" disabled={pending} onClick={() => run(() => setLivePollArchived(initialPoll.id, initialPoll.status !== "ARCHIVED"))}>{initialPoll.status === "ARCHIVED" ? "Reaktivieren" : "Archivieren"}</button> : null}
      {initialPoll.usageCount === 0 ? <button type="button" className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-800" disabled={pending} onClick={() => { if (window.confirm("Unbenutzte Umfrage endgültig löschen?")) run(() => deleteUnusedLivePoll(initialPoll.id), "/content/polls"); }}>Löschen</button> : null}
    </div> : null}
  </div>;
}
