"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeSlashIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import PresentationSlideRenderer from "@/app/rendering/presentation/PresentationSlideRenderer";
import { getPresentationSlideTitle } from "@/app/rendering/presentation/presentationSlideMetadata";
import type { ResolvedQuizTheme } from "@/app/rendering/theme/quizTheme";
import type { QuizPraesentationResult } from "../../actions";
import { isQuestionSection } from "../../quizSectionPolicy";
import {
  buildPraesentationSlides,
  getPresentationSlideKey,
  type Slide,
} from "../praesentation/buildPraesentationSlides";
import {
  getQuizFlowTypeLabel,
  getQuizSolutionStrategyLabel,
  getEffectiveQuizSolutionStrategy,
  QUIZ_GLOBAL_FLOW_ITEM_TYPES,
  QUIZ_STANDARD_SOLUTION_STRATEGIES,
  type QuizFlowConfig,
  type QuizFlowItem,
  type QuizSolutionStrategy,
} from "../../flow/quizFlow";
import {
  addQuizFlowItem,
  assignUnassignedStoryElementToBlock,
  deleteQuizFlowItem,
  moveQuizFlowItem,
  moveQuizBlockSequenceItem,
  resetQuizFlow,
  toggleQuizFlowItem,
  updateQuizFlowItem,
  updateQuizBlockEditorialDetails,
  updateQuizDefaultSolutionStrategy,
} from "./actions";
import StoryElementQuizPicker, { type QuizStoryElementOption } from "@/app/story-elemente/StoryElementQuizPicker";

type SelectableStoryElement = QuizStoryElementOption;

type Props = {
  quiz: QuizPraesentationResult;
  theme: ResolvedQuizTheme;
  canEdit: boolean;
  storyElements: SelectableStoryElement[];
};

function UnassignedStoryCard({ quizId, item, sections, canEdit }: { quizId: number; item: QuizFlowItem; sections: Array<{ quiz_abschnitt_id: number; titel: string }>; canEdit: boolean }) {
  const router = useRouter();
  const [sectionId, setSectionId] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const placementId = item.persistentId;
  function assign() {
    if (!placementId || !sectionId) return;
    startTransition(async () => {
      const result = await assignUnassignedStoryElementToBlock({ quizId, placementId, sectionId: Number(sectionId) });
      if (!result.success) setMessage(result.message);
      else router.refresh();
    });
  }
  return <article className="rounded-2xl border border-amber-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Story · Kein Block</p><h3 className="mt-1 font-bold text-slate-950">{item.label || item.config.title || getQuizFlowTypeLabel(item.type)}</h3>{canEdit && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><select aria-label="Zielblock auswählen" value={sectionId} onChange={(event) => setSectionId(event.target.value)} className={inputClass}><option value="">Block auswählen</option>{sections.map((section) => <option key={section.quiz_abschnitt_id} value={section.quiz_abschnitt_id}>{section.titel}</option>)}</select><button type="button" disabled={pending || !sectionId} onClick={assign} className="min-h-11 rounded-xl bg-amber-700 px-4 font-semibold text-white disabled:opacity-50">Block zuordnen</button></div>}{message && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{message}</p>}</article>;
}

const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45";
const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200";

function PreviewViewport({ children }: { children: React.ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setScale(host.clientWidth / 1280);
    const observer = new ResizeObserver(update);
    observer.observe(host);
    update();
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      <div style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

function FlowItemCard({
  quizId,
  item,
  canEdit,
  onPreview,
}: {
  quizId: number;
  item: QuizFlowItem;
  canEdit: boolean;
  onPreview: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [label, setLabel] = useState(item.label ?? "");
  const [config, setConfig] = useState<QuizFlowConfig>(item.config);

  function run(action: () => Promise<{ success: boolean; message?: string }>) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setMessage(result.message ?? "Änderung konnte nicht gespeichert werden.");
        return;
      }
      router.refresh();
    });
  }

  function updateText(key: keyof Pick<QuizFlowConfig, "title" | "subtitle" | "body" | "moderatorNote" | "imageUrl" | "teamHint" | "contact" | "altText" | "caption" | "quoteSource" | "yearOrContext" | "personName" | "description" | "audioUrl" | "videoUrl" | "posterImageUrl">, value: string) {
    setConfig((current) => ({ ...current, [key]: value || undefined }));
  }

  function move(direction: -1 | 1) {
    if (item.anchorType === "BLOCK" && item.sectionId !== null) {
      return moveQuizBlockSequenceItem({
        quizId,
        sectionId: item.sectionId,
        itemKey:
          item.persistentId === null
            ? item.id
            : item.storyElementRevisionId
              ? `story-placement:${item.persistentId}`
              : `block-item:${item.persistentId}`,
        direction,
      });
    }
    return moveQuizFlowItem({ quizId, itemId: item.id, direction });
  }

  const rulesText = config.rules?.map((rule) => rule.text).join("\n") ?? "";
  const isRanking = ["INTERMEDIATE_STANDINGS", "FINAL_STANDINGS", "WINNER"].includes(item.type);
  const isTimed = item.type === "BREAK" || item.type === "COUNTDOWN";
  const isImage = item.type === "IMAGE" || item.type === "PORTRAIT";
  const isGallery = item.type === "IMAGE_GALLERY" || item.type === "MEDIA_SEQUENCE";
  const imagesText = config.images
    ?.map((image) => [image.url, image.altText, image.caption ?? ""].join(" | "))
    .join("\n") ?? "";

  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm ${item.enabled ? "border-slate-200" : "border-dashed border-slate-300 opacity-65"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            {getQuizFlowTypeLabel(item.type)}
          </div>
          <h3 className="mt-1 break-words text-lg font-bold text-slate-950">
            {item.label || item.config.title || getQuizFlowTypeLabel(item.type)}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {item.enabled ? "Wird gezeigt" : "Ausgeblendet"} · {item.storyElementRevisionId ? "Story-Bibliothek" : item.isStandard ? "Standard" : "Eingebetteter Altinhalt"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onPreview} className={buttonClass} title="Vorschau anzeigen">
            <EyeIcon className="h-4 w-4" /> Vorschau
          </button>
          {canEdit && (
            <>
              <button type="button" disabled={pending} onClick={() => run(() => move(-1))} className={buttonClass} title="Nach oben">
                <ArrowUpIcon className="h-4 w-4" />
              </button>
              <button type="button" disabled={pending} onClick={() => run(() => move(1))} className={buttonClass} title="Nach unten">
                <ArrowDownIcon className="h-4 w-4" />
              </button>
              <button type="button" disabled={pending} onClick={() => run(() => toggleQuizFlowItem({ quizId, itemId: item.id, enabled: !item.enabled }))} className={buttonClass}>
                {item.enabled ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                {item.enabled ? "Ausblenden" : "Einblenden"}
              </button>
              {item.storyElementId && <Link href={`/story-elemente/${item.storyElementId}`} className={buttonClass}>In Bibliothek öffnen</Link>}
              {!item.isStandard && (
                <button type="button" disabled={pending} onClick={() => run(() => deleteQuizFlowItem({ quizId, itemId: item.id }))} className={`${buttonClass} border-red-200 text-red-700`}>
                  <TrashIcon className="h-4 w-4" /> Löschen
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {canEdit && !item.storyElementRevisionId && (
        <details className="mt-4 rounded-xl bg-slate-50 p-3">
          <summary className="cursor-pointer font-semibold text-slate-800">Inhalt bearbeiten</summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Interne Bezeichnung</span>
              <input value={label} maxLength={160} onChange={(event) => setLabel(event.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Titel</span>
              <input value={config.title ?? ""} maxLength={160} onChange={(event) => updateText("title", event.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Untertitel</span>
              <input value={config.subtitle ?? ""} maxLength={240} onChange={(event) => updateText("subtitle", event.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Bildpfad (optional)</span>
              <input value={config.imageUrl ?? ""} maxLength={2048} placeholder="/medien/…" onChange={(event) => updateText("imageUrl", event.target.value)} className={inputClass} />
            </label>
            {isImage && (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Alt-Text *</span>
                  <input value={config.altText ?? ""} maxLength={500} onChange={(event) => updateText("altText", event.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Bildunterschrift</span>
                  <input value={config.caption ?? ""} maxLength={800} onChange={(event) => updateText("caption", event.target.value)} className={inputClass} />
                </label>
              </>
            )}
            {item.type === "PORTRAIT" && (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Person / Titel *</span>
                  <input value={config.personName ?? ""} maxLength={160} onChange={(event) => updateText("personName", event.target.value)} className={inputClass} />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-semibold">Kurzbeschreibung</span>
                  <textarea value={config.description ?? ""} maxLength={1200} onChange={(event) => updateText("description", event.target.value)} className={`${inputClass} min-h-20 resize-y`} />
                </label>
              </>
            )}
            {isGallery && (
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Bilder in fester Reihenfolge *</span>
                <textarea
                  value={imagesText}
                  onChange={(event) => setConfig((current) => ({
                    ...current,
                    images: event.target.value.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
                      const [url = "", altText = "", caption = ""] = line.split("|").map((part) => part.trim());
                      return { id: `image-${index + 1}`, url, altText, ...(caption ? { caption } : {}) };
                    }),
                  }))}
                  className={`${inputClass} min-h-32 resize-y font-mono text-sm`}
                  placeholder="/medien/bild.jpg | Alt-Text | Bildunterschrift"
                />
                <span className="mt-1 block text-xs text-slate-500">Eine Zeile pro Bild: Pfad | Alt-Text | optionale Bildunterschrift.</span>
              </label>
            )}
            {item.type === "QUOTE" && (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Quelle / Person</span>
                  <input value={config.quoteSource ?? ""} maxLength={240} onChange={(event) => updateText("quoteSource", event.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Jahr / Kontext</span>
                  <input value={config.yearOrContext ?? ""} maxLength={240} onChange={(event) => updateText("yearOrContext", event.target.value)} className={inputClass} />
                </label>
              </>
            )}
            {item.type === "AUDIO" && (
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Audiodatei *</span>
                <input value={config.audioUrl ?? ""} maxLength={2048} onChange={(event) => updateText("audioUrl", event.target.value)} className={inputClass} />
              </label>
            )}
            {item.type === "VIDEO" && (
              <>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-semibold">Videodatei *</span>
                  <input value={config.videoUrl ?? ""} maxLength={2048} onChange={(event) => updateText("videoUrl", event.target.value)} className={inputClass} />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-semibold">Posterbild</span>
                  <input value={config.posterImageUrl ?? ""} maxLength={2048} onChange={(event) => updateText("posterImageUrl", event.target.value)} className={inputClass} />
                </label>
              </>
            )}
            {(item.type === "AUDIO" || item.type === "VIDEO") && (
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Beschreibung</span>
                <textarea value={config.description ?? ""} maxLength={1200} onChange={(event) => updateText("description", event.target.value)} className={`${inputClass} min-h-20 resize-y`} />
              </label>
            )}
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-semibold">Öffentlicher Text</span>
              <textarea value={config.body ?? ""} maxLength={2000} onChange={(event) => updateText("body", event.target.value)} className={`${inputClass} min-h-24 resize-y`} />
            </label>
            {item.type === "QR_CODE" && (
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Hinweis zur Teamanmeldung</span>
                <textarea value={config.teamHint ?? ""} maxLength={500} onChange={(event) => updateText("teamHint", event.target.value)} className={`${inputClass} min-h-20 resize-y`} />
              </label>
            )}
            {item.type === "RULES" && (
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Regeln (eine pro Zeile)</span>
                <textarea
                  value={rulesText}
                  onChange={(event) => setConfig((current) => ({
                    ...current,
                    rules: event.target.value.split(/\r?\n/).map((text, index) => ({ id: `rule-${index + 1}`, text, enabled: true })),
                  }))}
                  className={`${inputClass} min-h-36 resize-y`}
                />
              </label>
            )}
            {isTimed && (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Dauer in Sekunden</span>
                  <input type="number" min={0} max={7200} value={config.durationSeconds ?? 300} onChange={(event) => setConfig((current) => ({ ...current, durationSeconds: Number(event.target.value) }))} className={inputClass} />
                </label>
                <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <input type="checkbox" checked={config.showCountdown !== false} onChange={(event) => setConfig((current) => ({ ...current, showCountdown: event.target.checked }))} /> Countdown zeigen
                </label>
              </>
            )}
            {isRanking && (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Rangliste</span>
                  <select value={config.standingsSize ?? "TOP_5"} onChange={(event) => setConfig((current) => ({ ...current, standingsSize: event.target.value as QuizFlowConfig["standingsSize"] }))} className={inputClass}>
                    <option value="TOP_3">Top 3</option>
                    <option value="TOP_5">Top 5</option>
                    <option value="ALL">Alle Teams</option>
                    <option value="HIDDEN">Nur Berechnungshinweis</option>
                  </select>
                </label>
                <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <input type="checkbox" checked={config.showPoints !== false} onChange={(event) => setConfig((current) => ({ ...current, showPoints: event.target.checked }))} /> Punkte anzeigen
                </label>
              </>
            )}
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-semibold">Moderationsnotiz (nicht öffentlich)</span>
              <textarea value={config.moderatorNote ?? ""} maxLength={2000} onChange={(event) => updateText("moderatorNote", event.target.value)} className={`${inputClass} min-h-24 resize-y`} />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" disabled={pending} onClick={() => run(() => updateQuizFlowItem({ quizId, itemId: item.id, label: label || null, config }))} className="min-h-11 rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white disabled:opacity-50">
              {pending ? "Speichert …" : "Speichern"}
            </button>
            {message && <p role="alert" className="text-sm font-semibold text-red-700">{message}</p>}
          </div>
        </details>
      )}
    </article>
  );
}

function QuestionSequenceCard({
  quizId,
  slide,
  canEdit,
  onPreview,
}: {
  quizId: number;
  slide: Extract<Slide, { typ: "frage" | "aufloesung" }>;
  canEdit: boolean;
  onPreview: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const canMove =
    slide.typ === "frage" || slide.solutionStrategy === "MANUAL";

  function move(direction: -1 | 1) {
    if (!slide.abschnitt || !canMove) return;
    setMessage("");
    startTransition(async () => {
      const result = await moveQuizBlockSequenceItem({
        quizId,
        sectionId: slide.abschnitt!.quiz_abschnitt_id,
        itemKey: getPresentationSlideKey(slide),
        direction,
      });
      if (!result.success) setMessage(result.message);
      else router.refresh();
    });
  }

  return (
    <article className={`rounded-2xl border px-4 py-3 ${slide.typ === "frage" ? "border-cyan-200 bg-cyan-50" : "border-violet-200 bg-violet-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onPreview} className="min-w-0 flex-1 text-left">
          <span className="block text-xs font-black uppercase tracking-[0.16em] text-slate-600">
            {slide.typ === "frage" ? "Frage" : "Auflösung"} · Frage {slide.frageIndexImBlock}
          </span>
          <strong className="mt-1 block truncate text-slate-950">{slide.frage.frage}</strong>
          <span className="mt-1 block text-xs text-slate-500">
            {slide.typ === "aufloesung" && slide.solutionStrategy !== "MANUAL"
              ? `Automatisch · ${getQuizSolutionStrategyLabel(slide.solutionStrategy ?? "AFTER_EACH_QUESTION")}`
              : "Mit der bestehenden Quizfrage verknüpft"}
          </span>
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onPreview} className={buttonClass}><EyeIcon className="h-4 w-4" /> Vorschau</button>
          {canEdit && canMove && (
            <>
              <button type="button" disabled={pending} onClick={() => move(-1)} className={buttonClass} aria-label="Nach oben"><ArrowUpIcon className="h-4 w-4" /></button>
              <button type="button" disabled={pending} onClick={() => move(1)} className={buttonClass} aria-label="Nach unten"><ArrowDownIcon className="h-4 w-4" /></button>
            </>
          )}
        </div>
      </div>
      {message && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{message}</p>}
    </article>
  );
}

function BlockEditorSection({
  quiz,
  section,
  slides,
  canEdit,
  onPreview,
  storyElements,
}: {
  quiz: QuizPraesentationResult;
  section: QuizPraesentationResult["abschnitte"][number];
  slides: Slide[];
  canEdit: boolean;
  onPreview: (key: string) => void;
  storyElements: SelectableStoryElement[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState(section.titel);
  const [note, setNote] = useState(section.bemerkung ?? "");
  const effectiveStrategy = getEffectiveQuizSolutionStrategy(
    quiz.aufloesungsstrategie,
    section.aufloesungsstrategie,
  );

  function run(action: () => Promise<{ success: boolean; message?: string }>) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) setMessage(result.message ?? "Änderung konnte nicht gespeichert werden.");
      else router.refresh();
    });
  }

  return (
    <section id={`block-${section.quiz_abschnitt_id}`} className="scroll-mt-4 rounded-3xl border border-slate-300 bg-slate-100 p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Redaktioneller Block</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">{section.titel}</h2>
          <p className="mt-1 text-sm text-slate-600">Auflösungen: {getQuizSolutionStrategyLabel(effectiveStrategy)}</p>
        </div>
        {section.aufloesungsstrategie && <div className="max-w-md rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"><strong>Legacy-Blockwert bleibt geschützt.</strong><p className="mt-1">{getQuizSolutionStrategyLabel(effectiveStrategy)} wird technisch weiter berücksichtigt, aber nicht mehr als Block-Override bearbeitet.</p></div>}
      </div>

      {canEdit && (
        <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">Blocktitel und Notiz bearbeiten</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label><span className="mb-1 block text-sm font-semibold">Blocktitel</span><input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} className={inputClass} /></label>
            <label><span className="mb-1 block text-sm font-semibold">Interne Blocknotiz</span><textarea value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} className={`${inputClass} min-h-20 resize-y`} /></label>
          </div>
          <button type="button" disabled={pending} onClick={() => run(() => updateQuizBlockEditorialDetails({ quizId: quiz.quiz_id, sectionId: section.quiz_abschnitt_id, title, note }))} className="mt-3 min-h-11 rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white disabled:opacity-50">Block speichern</button>
        </details>
      )}

      {canEdit && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-end gap-3"><div className="text-right"><h3 className="font-bold">Quiz-Element hinzufügen</h3><p className="mt-1 text-sm text-slate-500">Fragen und Story-Elemente folgen getrennten, vertrauten Auswahlwegen.</p></div></div>
          <div className="mt-3 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3"><strong>Frage hinzufügen</strong><p className="mt-1 text-sm text-slate-600">Bewertbare Frage mit Antwort und Punkten auswählen.</p><Link href={`/quiz/${quiz.quiz_id}#fragen-hinzufuegen`} className={`${buttonClass} mt-3`}>Frage hinzufügen</Link></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><strong>Story-Element hinzufügen</strong><p className="mt-1 text-sm text-slate-600">Nicht bewerteten Inhalt wie Bild, Anekdote, Zitat, Audio oder Video auswählen.</p><StoryElementQuizPicker quizId={quiz.quiz_id} sectionId={section.quiz_abschnitt_id} options={storyElements} /></div></div>
        </div>
      )}

      <div className="mt-4 space-y-3" aria-label={`Elemente in ${section.titel}`}>
        {slides.map((slide) => {
          const key = getPresentationSlideKey(slide);
          if (slide.typ === "ablauf") {
            return <FlowItemCard key={key} quizId={quiz.quiz_id} item={slide.element} canEdit={canEdit} onPreview={() => onPreview(key)} />;
          }
          if (slide.typ === "frage" || slide.typ === "aufloesung") {
            return <QuestionSequenceCard key={key} quizId={quiz.quiz_id} slide={slide} canEdit={canEdit} onPreview={() => onPreview(key)} />;
          }
          return null;
        })}
      </div>
      {message && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{message}</p>}
    </section>
  );
}

export default function AblaufEditor({ quiz, theme, canEdit, storyElements }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const slides = useMemo(
    () => buildPraesentationSlides(quiz, { includeDisabledFlowItems: true }),
    [quiz],
  );
  const [selectedKey, setSelectedKey] = useState(() =>
    slides[0] ? getPresentationSlideKey(slides[0]) : "",
  );
  const selectedIndex = Math.max(
    0,
    slides.findIndex((slide) => getPresentationSlideKey(slide) === selectedKey),
  );
  const selectedSlide = slides[selectedIndex];
  const [newType, setNewType] = useState("CUSTOM_MESSAGE");
  const [newAnchor, setNewAnchor] = useState("AFTER_QUIZ:QUIZ");
  const [message, setMessage] = useState("");
  const questionSections = quiz.abschnitte.filter(isQuestionSection);
  const unassignedStories = slides.filter(
    (slide): slide is Extract<Slide, { typ: "ablauf" }> => slide.typ === "ablauf" && slide.element.anchorType === "BEFORE_QUIZ" && slide.element.anchorKey === "UNASSIGNED",
  );
  const globalSlides = slides.filter(
    (slide) => slide.typ === "ablauf" && slide.abschnitt === null && !(slide.element.anchorType === "BEFORE_QUIZ" && slide.element.anchorKey === "UNASSIGNED"),
  );

  const anchorOptions = [
    { value: "BEFORE_QUIZ:QUIZ", label: "Vor dem Quiz" },
    ...questionSections
      .flatMap((section) => [
        { value: `ROUND_START:${section.quiz_abschnitt_id}`, label: `Vor ${section.titel}` },
        { value: `ROUND_END:${section.quiz_abschnitt_id}`, label: `Nach ${section.titel}` },
      ]),
    { value: "AFTER_QUIZ:QUIZ", label: "Nach dem Quiz" },
  ];

  function addItem() {
    const [anchorType, anchorKey] = newAnchor.split(":");
    startTransition(async () => {
      const result = await addQuizFlowItem({
        quizId: quiz.quiz_id,
        type: newType,
        anchorType,
        sectionId: anchorKey === "QUIZ" ? null : Number(anchorKey),
      });
      if (!result.success) setMessage(result.message);
      else {
        setMessage("");
        router.refresh();
      }
    });
  }

  function reset() {
    if (!window.confirm("Den globalen Ablauf auf den sicheren Standard zurücksetzen? Redaktionelle Blockelemente bleiben erhalten.")) return;
    startTransition(async () => {
      const result = await resetQuizFlow(quiz.quiz_id);
      if (!result.success) setMessage(result.message);
      else router.refresh();
    });
  }

  function changeDefaultStrategy(strategy: QuizSolutionStrategy) {
    if (
      strategy !== quiz.aufloesungsstrategie &&
      !window.confirm(
        strategy === "MANUAL"
          ? "Die aktuell sichtbaren Folgen der Blöcke ohne Override werden materialisiert. Fortfahren?"
          : "Gespeicherte manuelle Positionen bleiben erhalten, werden in automatisch gesteuerten Blöcken aber vorübergehend übersteuert. Fortfahren?",
      )
    ) return;
    startTransition(async () => {
      const result = await updateQuizDefaultSolutionStrategy({
        quizId: quiz.quiz_id,
        strategy,
      });
      if (!result.success) setMessage(result.message);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
      <section className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Quizstandard für Auflösungen</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,24rem)_1fr] md:items-center">
            <select
              aria-label="Quizstandard für Auflösungen"
              value={quiz.aufloesungsstrategie ?? "AFTER_EACH_QUESTION"}
              onChange={(event) => changeDefaultStrategy(event.target.value as QuizSolutionStrategy)}
              className={inputClass}
              disabled={!canEdit || pending}
            >
              {quiz.aufloesungsstrategie === "MANUAL" && <option value="MANUAL" disabled>Legacy: Manuell im Ablauf</option>}
              {QUIZ_STANDARD_SOLUTION_STRATEGIES.map((strategy) => <option key={strategy} value={strategy}>{getQuizSolutionStrategyLabel(strategy)}</option>)}
            </select>
            <p className="text-sm text-slate-600">Dieser Quizstandard gilt für alle neuen und regulär gepflegten Blöcke. Vorhandene technische Legacy-Overrides bleiben sicher erhalten.</p>
          </div>
        </div>
        {canEdit && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Ablaufelement hinzufügen</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <select value={newType} onChange={(event) => setNewType(event.target.value)} className={inputClass} aria-label="Elementtyp">
                {QUIZ_GLOBAL_FLOW_ITEM_TYPES.filter((type) => !["WAITING", "START_SEQUENCE", "PRIZES"].includes(type)).map((type) => (
                  <option key={type} value={type}>{getQuizFlowTypeLabel(type)}</option>
                ))}
              </select>
              <select value={newAnchor} onChange={(event) => setNewAnchor(event.target.value)} className={inputClass} aria-label="Position im Ablauf">
                {anchorOptions.map((anchor) => <option key={anchor.value} value={anchor.value}>{anchor.label}</option>)}
              </select>
              <button type="button" disabled={pending} onClick={addItem} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white disabled:opacity-50">
                <PlusIcon className="h-5 w-5" /> Hinzufügen
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">Fragen und Auflösungen werden automatisch aus den Quizrunden abgeleitet.</p>
              <button type="button" disabled={pending} onClick={reset} className={buttonClass}>Standard wiederherstellen</button>
            </div>
            {message && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{message}</p>}
          </div>
        )}

        {unassignedStories.length > 0 && <section className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50 p-4" aria-label="Inhalte ohne Block"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Kein Block</p><h2 className="mt-1 text-xl font-black">Offene Story-Zuordnungen</h2><p className="mt-1 text-sm text-slate-600">Diese Inhalte wurden aus der Bibliothek hinzugefügt und sind bis zur Blockzuordnung nicht sichtbar.</p></div>{unassignedStories.map((slide) => <UnassignedStoryCard key={getPresentationSlideKey(slide)} quizId={quiz.quiz_id} item={slide.element} sections={questionSections} canEdit={canEdit} />)}</section>}

        <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4" aria-label="Globale Ablaufelemente">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Globaler Ablauf</p>
            <h2 className="mt-1 text-xl font-black">Vor und nach den Quizblöcken</h2>
          </div>
          {globalSlides.map((slide) => {
            const key = getPresentationSlideKey(slide);
            return slide.typ === "ablauf"
              ? <FlowItemCard key={key} quizId={quiz.quiz_id} item={slide.element} canEdit={canEdit} onPreview={() => setSelectedKey(key)} />
              : null;
          })}
        </section>

        {questionSections.map((section) => (
          <BlockEditorSection
            key={section.quiz_abschnitt_id}
            quiz={quiz}
            section={section}
            slides={slides.filter(
              (slide) =>
                "abschnitt" in slide &&
                slide.abschnitt?.quiz_abschnitt_id === section.quiz_abschnitt_id,
            )}
            canEdit={canEdit}
            onPreview={setSelectedKey}
            storyElements={storyElements}
          />
        ))}
      </section>

      <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white shadow-lg">
          <div className="mb-3 text-sm font-semibold text-slate-300">
            Vorschau · {getPresentationSlideTitle(selectedSlide, slides)}
          </div>
          <PreviewViewport>
              <PresentationSlideRenderer
                quiz={quiz}
                slide={selectedSlide}
                slides={slides}
                slideIndex={selectedIndex}
                slideLabel={getPresentationSlideTitle(selectedSlide, slides)}
                theme={theme}
                displayState={{
                  renderMode: "DESIGN_PREVIEW",
                  templateRevealCount: 5,
                  punktestand: [
                    { teamname: "Quizfreunde", punkte: 24 },
                    { teamname: "Die Erinnerer", punkte: 22 },
                    { teamname: "Team Konfetti", punkte: 19 },
                  ],
                  endstandRevealCount: 5,
                  now: 0,
                  estimationPhase: "HIDDEN",
                  schaetzfrage: null,
                  isSchaetzfrageLoading: false,
                  remoteCountdownDauerSekunden: null,
                  remoteCountdownStartedAt: null,
                  remoteCountdownStatus: "idle",
                  mediaOverlayActive: false,
                  playbackCommand: null,
                  playbackCommandId: 0,
                }}
              />
          </PreviewViewport>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">Die Vorschau verwendet denselben Renderer und dasselbe aufgelöste Template wie die Präsentation.</p>
        </div>
      </aside>
    </div>
  );
}
