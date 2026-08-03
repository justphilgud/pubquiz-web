"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createStoryElement,
  deleteUnusedStoryElement,
  duplicateStoryElement,
  setStoryElementArchived,
  updateStoryElement,
  type StoryElementActionResult,
} from "./actions";
import {
  getInitialStoryElementConfig,
  getStoryElementScopeLabel,
  getStoryElementStatusLabel,
  getStoryElementTypeLabel,
  STORY_ELEMENT_STATUSES,
  STORY_ELEMENT_TYPES,
  type StoryElementScopeValue,
  type StoryElementStatusValue,
  type StoryElementType,
} from "./storyElement";
import type { QuizFlowConfig } from "@/app/quiz/flow/quizFlow";
import { linkQuestionStoryElement } from "./questionActions";
import { addStoryElementToQuizBlock } from "@/app/quiz/[quizId]/ablauf/actions";
import type { StoryQuestionRelationshipValue } from "./storyElement";
import { getAvailableStoryElementScopes, getDefaultStoryElementScope } from "./storyElementScopePresentation";

type EditorOptions = {
  eventSeries: { eventreihe_id: number; name: string }[];
  quizzes: {
    quiz_id: number;
    titel: string | null;
    quiz_datum: Date | string | null;
    eventreihe_id: number;
    eventreihe: { name: string };
  }[];
  canUseGlobalScope: boolean;
};

type InitialStory = {
  id: number;
  type: StoryElementType;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  moderatorNote: string | null;
  status: StoryElementStatusValue;
  scope: StoryElementScopeValue;
  eventSeriesId: number | null;
  quizId: number | null;
  config: unknown;
  updatedAt: Date | string;
  usageCount: number;
  questionLinkCount: number;
  revisionNumber: number;
  sourceStoryElementId: number | null;
};

type Props = {
  options: EditorOptions;
  initialStory?: InitialStory;
  canEdit: boolean;
  canArchive: boolean;
  linkQuestionId?: number;
  returnTo?: string;
  quizContext?: { quizId: number; sectionId: number };
  linkRelationship?: StoryQuestionRelationshipValue;
};

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";
const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function asConfig(value: unknown, type: StoryElementType): QuizFlowConfig {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as QuizFlowConfig;
  }
  return getInitialStoryElementConfig(type);
}

function StoryPreview({ type, title, config }: {
  type: StoryElementType;
  title: string;
  config: QuizFlowConfig;
}) {
  const image = config.imageUrl ?? config.images?.[0]?.url;
  return (
    <div className="aspect-video overflow-hidden rounded-2xl bg-slate-950 p-5 text-white shadow-lg sm:p-7">
      <div className="flex h-full min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-slate-900 to-emerald-950 p-5">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
            {getStoryElementTypeLabel(type)}
          </p>
          <h2 className="mt-2 line-clamp-2 break-words text-2xl font-black sm:text-3xl">
            {title || "Unbenanntes Story-Element"}
          </h2>
          {(config.subtitle || config.body || config.description) && (
            <p className="mt-3 line-clamp-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-slate-200 sm:text-base">
              {config.subtitle ?? config.body ?? config.description}
            </p>
          )}
        </div>
        <div className="mt-3 min-h-0 flex-1">
          {image && (
            // Safe repository/blob references are validated again on the server.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={config.altText ?? ""} className="h-full max-h-52 w-full rounded-xl object-cover" />
          )}
          {type === "QUOTE" && config.body && (
            <blockquote className="line-clamp-4 text-xl font-semibold italic">„{config.body}“</blockquote>
          )}
          {type === "AUDIO" && <div className="mt-4 text-5xl" aria-label="Audio">◖)))</div>}
          {type === "VIDEO" && <div className="mt-4 text-5xl" aria-label="Video">▶</div>}
        </div>
      </div>
    </div>
  );
}

export default function StoryElementEditor({
  options,
  initialStory,
  canEdit,
  canArchive,
  linkQuestionId,
  returnTo,
  quizContext,
  linkRelationship = "AFTER_SOLUTION",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initialType = initialStory?.type ?? "ANECDOTE";
  const [type, setType] = useState<StoryElementType>(initialType);
  const [title, setTitle] = useState(initialStory?.title ?? "");
  const [description, setDescription] = useState(initialStory?.description ?? "");
  const [moderatorNote, setModeratorNote] = useState(initialStory?.moderatorNote ?? "");
  const [status, setStatus] = useState<Exclude<StoryElementStatusValue, "ARCHIVED">>(
    initialStory?.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
  );
  const contextQuizId = quizContext?.quizId ?? initialStory?.quizId ?? null;
  const contextQuiz = options.quizzes.find((quiz) => quiz.quiz_id === contextQuizId);
  const allowedScopes = useMemo<StoryElementScopeValue[]>(() => {
    return getAvailableStoryElementScopes({
      canUseGlobalScope: options.canUseGlobalScope,
      hasQuizContext: Boolean(contextQuiz),
    });
  }, [contextQuiz, options.canUseGlobalScope]);
  const [scope, setScope] = useState<StoryElementScopeValue>(
    getDefaultStoryElementScope({
      existingScope: initialStory?.scope,
      canUseGlobalScope: options.canUseGlobalScope,
      hasQuizContext: Boolean(contextQuiz),
    }),
  );
  const [eventSeriesId, setEventSeriesId] = useState(
    String(initialStory?.eventSeriesId ?? contextQuiz?.eventreihe_id ?? options.eventSeries[0]?.eventreihe_id ?? ""),
  );
  const [quizId, setQuizId] = useState(String(initialStory?.quizId ?? contextQuiz?.quiz_id ?? options.quizzes[0]?.quiz_id ?? ""));
  const [config, setConfig] = useState<QuizFlowConfig>(() =>
    asConfig(initialStory?.config, initialType),
  );
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(
    initialStory ? new Date(initialStory.updatedAt).toISOString() : "",
  );
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const relevantQuizzes = useMemo(
    () => scope === "QUIZ"
      ? options.quizzes.filter((quiz) => !eventSeriesId || quiz.eventreihe_id === Number(eventSeriesId))
      : options.quizzes,
    [eventSeriesId, options.quizzes, scope],
  );
  const isGallery = type === "IMAGE_GALLERY" || type === "MEDIA_SEQUENCE";
  const galleryText = config.images
    ?.map((image) => [image.url, image.altText, image.caption ?? ""].join(" | "))
    .join("\n") ?? "";

  function updateConfig(key: keyof QuizFlowConfig, value: string | undefined) {
    setConfig((current) => ({ ...current, [key]: value || undefined }));
  }

  function changeType(nextType: StoryElementType) {
    setType(nextType);
    setConfig(getInitialStoryElementConfig(nextType));
  }

  function submit() {
    setMessage(null);
    const value = {
      type,
      title,
      description,
      // Legacy metadata is deliberately retained but no longer edited through
      // an isolated free-text workflow.
      category: initialStory?.category ?? null,
      tags: initialStory?.tags ?? [],
      moderatorNote,
      status,
      scope,
      eventSeriesId: scope === "EVENT_SERIES" ? eventSeriesId : null,
      quizId: scope === "QUIZ" ? quizId : null,
      config,
    };
    startTransition(async () => {
      const result = initialStory
        ? await updateStoryElement({
            storyElementId: initialStory.id,
            expectedUpdatedAt,
            value,
          })
        : await createStoryElement(value);
      if (!result.success) {
        setMessage({ tone: "error", text: result.message });
        return;
      }
      setExpectedUpdatedAt(result.updatedAt);
      setMessage({ tone: "success", text: result.message });
      if (!initialStory && quizContext) {
        const placement = await addStoryElementToQuizBlock({
          quizId: quizContext.quizId,
          sectionId: quizContext.sectionId,
          storyElementId: result.storyElementId,
        });
        if (!placement.success) {
          setMessage({ tone: "error", text: `${result.message} Die automatische Platzierung ist fehlgeschlagen: ${placement.message}` });
          return;
        }
        router.push(returnTo ?? `/quiz/${quizContext.quizId}/ablauf#block-${quizContext.sectionId}`);
      } else if (!initialStory && linkQuestionId) {
        const linkResult = await linkQuestionStoryElement({
          questionId: linkQuestionId,
          storyElementId: result.storyElementId,
          relationship: linkRelationship,
        });
        if (!linkResult.success) {
          setMessage({
            tone: "error",
            text: `${result.message} Die Fragenverknüpfung konnte nicht gespeichert werden: ${linkResult.message}`,
          });
        } else if (returnTo?.startsWith("/fragen/editor/")) {
          router.push(returnTo);
        }
      } else if (!initialStory) {
        router.push(`/story-elemente/${result.storyElementId}`);
      }
      router.refresh();
    });
  }

  function runLifecycle(action: () => Promise<StoryElementActionResult>, redirectToList = false) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setMessage({ tone: "error", text: result.message });
        return;
      }
      setExpectedUpdatedAt(result.updatedAt);
      if (redirectToList) router.push("/story-elemente");
      else if (result.storyElementId && result.storyElementId !== initialStory?.id) {
        router.push(`/story-elemente/${result.storyElementId}`);
      }
      router.refresh();
    });
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]">
      <section className="min-w-0 space-y-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <strong>Story-Element</strong>
          <p className="mt-1">Ein nicht bewerteter Inhalt wie Bild, Anekdote, Zitat, Audio oder Video. Punkte, Antworten und Bewertungsregeln gehören ausschließlich zu Fragen.</p>
        </div>

        <div className="grid gap-4">
          <label>
            <span className="mb-1 block text-sm font-semibold">Typ</span>
            <select value={type} onChange={(event) => changeType(event.target.value as StoryElementType)} className={inputClass} disabled={!canEdit || pending}>
              {STORY_ELEMENT_TYPES.map((value) => <option key={value} value={value}>{getStoryElementTypeLabel(value)}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold">Titel *</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} className={inputClass} disabled={!canEdit || pending} />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold">Kurze Beschreibung</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} className={`${inputClass} min-h-24 resize-y`} disabled={!canEdit || pending} />
          </label>
        </div>

        <section className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <div>
            <h2 className="font-bold">Inhalt</h2>
            <p className="text-sm text-slate-500">Es werden nur sichere, typgebundene Felder gespeichert – kein HTML oder Embed-Code.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {["CHAPTER_INTRO", "CUSTOM_MESSAGE", "IMAGE", "IMAGE_GALLERY", "MEDIA_SEQUENCE", "PORTRAIT"].includes(type) && (
              <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Untertitel</span><input value={config.subtitle ?? ""} onChange={(event) => updateConfig("subtitle", event.target.value)} maxLength={240} className={inputClass} disabled={!canEdit || pending} /></label>
            )}
            {["TEXT", "ANECDOTE", "QUOTE", "CUSTOM_MESSAGE", "CHAPTER_INTRO"].includes(type) && (
              <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">{type === "QUOTE" ? "Zitat" : "Text"} *</span><textarea value={config.body ?? ""} onChange={(event) => updateConfig("body", event.target.value)} maxLength={2000} className={`${inputClass} min-h-32 resize-y`} disabled={!canEdit || pending} /></label>
            )}
            {["IMAGE", "PORTRAIT", "CHAPTER_INTRO"].includes(type) && (
              <><label><span className="mb-1 block text-sm font-semibold">Bildpfad {type === "CHAPTER_INTRO" ? "(optional)" : "*"}</span><input value={config.imageUrl ?? ""} onChange={(event) => updateConfig("imageUrl", event.target.value)} placeholder="/medien/…" maxLength={2048} className={inputClass} disabled={!canEdit || pending} /></label><label><span className="mb-1 block text-sm font-semibold">Alt-Text {type === "CHAPTER_INTRO" ? "" : "*"}</span><input value={config.altText ?? ""} onChange={(event) => updateConfig("altText", event.target.value)} maxLength={500} className={inputClass} disabled={!canEdit || pending} /></label><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Bildunterschrift</span><input value={config.caption ?? ""} onChange={(event) => updateConfig("caption", event.target.value)} maxLength={800} className={inputClass} disabled={!canEdit || pending} /></label></>
            )}
            {isGallery && (
              <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Bilder in Reihenfolge *</span><textarea value={galleryText} onChange={(event) => setConfig((current) => ({ ...current, images: event.target.value.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => { const [url = "", altText = "", caption = ""] = line.split("|").map((part) => part.trim()); return { id: `image-${index + 1}`, url, altText, ...(caption ? { caption } : {}) }; }) }))} className={`${inputClass} min-h-36 resize-y font-mono text-sm`} placeholder="/medien/bild.jpg | Alt-Text | optionale Bildunterschrift" disabled={!canEdit || pending} /><span className="mt-1 block text-xs text-slate-500">Eine Zeile pro Bild: Pfad | Alt-Text | Bildunterschrift.</span></label>
            )}
            {type === "QUOTE" && (
              <><label><span className="mb-1 block text-sm font-semibold">Quelle / Person</span><input value={config.quoteSource ?? ""} onChange={(event) => updateConfig("quoteSource", event.target.value)} maxLength={240} className={inputClass} disabled={!canEdit || pending} /></label><label><span className="mb-1 block text-sm font-semibold">Kontext / Jahr</span><input value={config.yearOrContext ?? ""} onChange={(event) => updateConfig("yearOrContext", event.target.value)} maxLength={240} className={inputClass} disabled={!canEdit || pending} /></label></>
            )}
            {type === "PORTRAIT" && (
              <><label><span className="mb-1 block text-sm font-semibold">Person / Titel *</span><input value={config.personName ?? ""} onChange={(event) => updateConfig("personName", event.target.value)} maxLength={160} className={inputClass} disabled={!canEdit || pending} /></label><label><span className="mb-1 block text-sm font-semibold">Kurzbeschreibung</span><input value={config.description ?? ""} onChange={(event) => updateConfig("description", event.target.value)} maxLength={1200} className={inputClass} disabled={!canEdit || pending} /></label></>
            )}
            {type === "AUDIO" && (
              <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Sichere Audiodatei *</span><input value={config.audioUrl ?? ""} onChange={(event) => updateConfig("audioUrl", event.target.value)} placeholder="/medien/audio/…" maxLength={2048} className={inputClass} disabled={!canEdit || pending} /></label>
            )}
            {type === "VIDEO" && (
              <><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Sichere Videodatei *</span><input value={config.videoUrl ?? ""} onChange={(event) => updateConfig("videoUrl", event.target.value)} placeholder="/medien/video/…" maxLength={2048} className={inputClass} disabled={!canEdit || pending} /></label><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Posterbild</span><input value={config.posterImageUrl ?? ""} onChange={(event) => updateConfig("posterImageUrl", event.target.value)} maxLength={2048} className={inputClass} disabled={!canEdit || pending} /></label></>
            )}
            {(type === "AUDIO" || type === "VIDEO") && (
              <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Medienbeschreibung</span><textarea value={config.description ?? ""} onChange={(event) => updateConfig("description", event.target.value)} maxLength={1200} className={`${inputClass} min-h-24 resize-y`} disabled={!canEdit || pending} /></label>
            )}
          </div>
        </section>

        <fieldset className="rounded-2xl border border-slate-200 p-4" disabled={!canEdit || pending}>
          <legend className="px-2 font-bold">Geltungsbereich</legend>
          <div className="grid gap-3 md:grid-cols-2">
            {allowedScopes.length > 1 && <label><span className="mb-1 block text-sm font-semibold">Verfügbarkeit</span><select value={scope} onChange={(event) => setScope(event.target.value as StoryElementScopeValue)} className={inputClass}>{allowedScopes.map((value) => <option key={value} value={value}>{getStoryElementScopeLabel(value)}</option>)}</select></label>}
            {scope === "EVENT_SERIES" && (options.eventSeries.length > 1 && !contextQuiz ? <label><span className="mb-1 block text-sm font-semibold">Eventreihe *</span><select value={eventSeriesId} onChange={(event) => setEventSeriesId(event.target.value)} className={inputClass}>{options.eventSeries.map((series) => <option key={series.eventreihe_id} value={series.eventreihe_id}>{series.name}</option>)}</select></label> : <p className="self-end rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950">Eventreihe: <strong>{contextQuiz?.eventreihe.name ?? options.eventSeries.find((series) => series.eventreihe_id === Number(eventSeriesId))?.name}</strong></p>)}
            {scope === "QUIZ" && (contextQuiz ? <p className="self-end rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950">Quiz: <strong>{contextQuiz.titel ?? `Quiz ${contextQuiz.quiz_id}`}</strong></p> : <label><span className="mb-1 block text-sm font-semibold">Quiz *</span><select value={quizId} onChange={(event) => setQuizId(event.target.value)} className={inputClass}>{relevantQuizzes.map((quiz) => <option key={quiz.quiz_id} value={quiz.quiz_id}>{quiz.titel ?? `Quiz ${quiz.quiz_id}`} · {quiz.eventreihe.name}</option>)}</select></label>)}
          </div>
        </fieldset>

        <details className="rounded-2xl border border-slate-200 p-4">
          <summary className="min-h-11 cursor-pointer font-bold">Weitere Angaben</summary>
          <div className="mt-3 grid gap-4">
            <label><span className="mb-1 block text-sm font-semibold">Status</span><select value={initialStory?.status === "ARCHIVED" ? "ARCHIVED" : status} onChange={(event) => setStatus(event.target.value as typeof status)} className={inputClass} disabled={!canEdit || pending || initialStory?.status === "ARCHIVED"}>{STORY_ELEMENT_STATUSES.filter((value) => value !== "ARCHIVED" || initialStory?.status === "ARCHIVED").map((value) => <option key={value} value={value}>{getStoryElementStatusLabel(value)}</option>)}</select></label>
            <label><span className="mb-1 block text-sm font-semibold">Moderationsnotiz (nicht öffentlich)</span><textarea value={moderatorNote} onChange={(event) => setModeratorNote(event.target.value)} maxLength={2000} className={`${inputClass} min-h-24 resize-y`} disabled={!canEdit || pending} /></label>
          </div>
        </details>

        {message && <p role="alert" className={`rounded-xl px-4 py-3 text-sm font-semibold ${message.tone === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>{message.text}</p>}
        <div className="flex flex-wrap gap-3">
          {canEdit && initialStory?.status !== "ARCHIVED" && <button type="button" onClick={submit} disabled={pending} className="min-h-11 rounded-xl bg-slate-950 px-5 py-2 font-bold text-white disabled:opacity-50">{pending ? "Speichert …" : initialStory ? "Neue Revision speichern" : "Story-Element speichern"}</button>}
          {initialStory && <button type="button" onClick={() => runLifecycle(() => duplicateStoryElement(initialStory.id))} disabled={pending} className={secondaryButtonClass}>Duplizieren</button>}
          {initialStory && canArchive && <button type="button" onClick={() => runLifecycle(() => setStoryElementArchived(initialStory.id, initialStory.status !== "ARCHIVED"))} disabled={pending} className={secondaryButtonClass}>{initialStory.status === "ARCHIVED" ? "Als Entwurf reaktivieren" : "Archivieren"}</button>}
          {initialStory && canArchive && initialStory.status === "DRAFT" && initialStory.usageCount === 0 && initialStory.questionLinkCount === 0 && <button type="button" onClick={() => { if (window.confirm("Diesen ungenutzten Entwurf endgültig löschen?")) runLifecycle(() => deleteUnusedStoryElement(initialStory.id), true); }} disabled={pending} className={`${secondaryButtonClass} border-red-200 text-red-700`}>Entwurf löschen</button>}
        </div>
      </section>

      <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Inhaltsvorschau</h2>
        <StoryPreview type={type} title={title} config={config} />
        <p className="mt-3 text-xs leading-relaxed text-slate-500">Die Vorschau prüft Hierarchie und Medien. Im Quiz gestaltet das gewählte Präsentationstemplate denselben validierten Inhalt über den gemeinsamen Renderer.</p>
        {initialStory && <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm"><div><dt className="text-slate-500">Revision</dt><dd className="font-bold">{initialStory.revisionNumber}</dd></div><div><dt className="text-slate-500">Verwendungen</dt><dd className="font-bold">{initialStory.usageCount}</dd></div><div><dt className="text-slate-500">Fragenlinks</dt><dd className="font-bold">{initialStory.questionLinkCount}</dd></div><div><dt className="text-slate-500">Herkunft</dt><dd className="font-bold">{initialStory.sourceStoryElementId ? `Kopie von #${initialStory.sourceStoryElementId}` : "Original"}</dd></div></dl>}
      </aside>
    </div>
  );
}
