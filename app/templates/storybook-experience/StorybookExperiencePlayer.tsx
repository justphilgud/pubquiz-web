"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import PresentationSlideRenderer, { type PresentationSlideDisplayState } from "@/app/rendering/presentation/PresentationSlideRenderer";
import {
  STORYBOOK_EXPERIENCE_PERSON_COUNTS,
  STORYBOOK_EXPERIENCE_QUESTION_COUNTS,
  STORYBOOK_EXPERIENCE_QUESTION_TYPES,
  type StorybookExperiencePersonCount,
  type StorybookExperienceQuestionCount,
  type StorybookExperienceQuestionType,
  type StorybookStoryBeat,
} from "@/app/rendering/presentationTemplates/storybookExperience";
import {
  buildStorybookExperienceRuntime,
  type StorybookExperienceRuntimeMoment,
} from "@/app/rendering/presentationTemplates/storybookExperienceFixture";
import { Select } from "@/components/ui/Select";

const STAGE_WIDTH = 1600;
const STAGE_HEIGHT = 900;
const AUTOPLAY_INTERVAL_MS = 1800;

const beatLabels: Record<StorybookStoryBeat, string> = {
  INTRO: "Einstieg",
  WARM_UP: "Warm-up",
  CONNECTION: "Verbindung",
  SURPRISE: "Überraschung",
  LAUGHTER: "Lachen",
  NOSTALGIA: "Nostalgie",
  CLIMAX: "Höhepunkt",
  CLOSING: "Abschluss",
};

const compositionLabels = {
  COVER: "Cover",
  CHAPTER: "Kapitel",
  EDITORIAL: "Editorial",
  PORTRAIT: "Porträt",
  SPLIT: "Split",
  SEQUENCE: "Sequenz",
  MEMORY: "Erinnerung",
} as const;

const momentKindLabels = {
  COVER: "Auftakt",
  CHAPTER: "Kapitel",
  QUESTION: "Frage",
  SOLUTION: "Auflösung",
} as const;

const imageIntentLabels = {
  NONE: "Ruhe / Typografie",
  ESTABLISHING: "Eröffnendes Gesamtbild",
  CHARACTER: "Person im Mittelpunkt",
  RELATIONSHIP: "Beziehung im Bild",
  CHRONOLOGY: "Zeitlicher Verlauf",
  REVEAL: "Bild als Auflösung",
} as const;

const questionTypeLabels: Record<StorybookExperienceQuestionType, string> = {
  OPEN: "Offene Frage",
  MULTIPLE_CHOICE: "Multiple Choice",
  TRUE_FALSE: "Wahr / Falsch",
  ESTIMATE: "Schätzfrage",
  ORDERING: "Reihenfolge",
  AUDIO: "Audiofrage",
  IMAGE: "Bildfrage",
  PIXEL_REVEAL: "Pixel-Reveal",
  STRUCTURED_RESPONSE: "Strukturierte Antwort",
};

const baseDisplayState: PresentationSlideDisplayState = {
  renderMode: "DESIGN_PREVIEW",
  templateRevealCount: 1,
  punktestand: [],
  intermediateStandings: [],
  endstandRevealCount: 0,
  now: Date.UTC(2026, 7, 3, 20),
  estimationPhase: "HIDDEN",
  schaetzfrage: null,
  isSchaetzfrageLoading: false,
  remoteCountdownDauerSekunden: null,
  remoteCountdownStartedAt: null,
  remoteCountdownStatus: null,
  mediaOverlayActive: false,
  playbackCommand: null,
  playbackCommandId: 0,
};

function slideLabelFor(moment: StorybookExperienceRuntimeMoment) {
  if (moment.composition === "MEMORY") return "ERINNERUNG";
  if (moment.kind === "CHAPTER") return `KAPITEL ${moment.chapterNumber}`;
  if (moment.kind === "QUESTION") return `FRAGE ${moment.questionNumber}`;
  if (moment.kind === "SOLUTION") return "AUFLÖSUNG";
  return "AUFTAKT";
}

function timelineColor(moment: StorybookExperienceRuntimeMoment, active: boolean) {
  if (active) return "bg-rose-800";
  if (moment.kind === "CHAPTER") return "bg-slate-800";
  if (moment.composition === "MEMORY") return "bg-amber-600";
  if (moment.questionType === "AUDIO") return "bg-violet-600";
  if (moment.questionType === "PIXEL_REVEAL") return "bg-fuchsia-600";
  if (moment.questionType === "MULTIPLE_CHOICE" || moment.questionType === "TRUE_FALSE") return "bg-cyan-600";
  if (moment.questionType === "ESTIMATE" || moment.questionType === "ORDERING") return "bg-blue-600";
  if (moment.questionType === "IMAGE") return "bg-indigo-500";
  if (moment.questionType === "STRUCTURED_RESPONSE") return "bg-teal-600";
  return "bg-slate-400 hover:bg-slate-600";
}

function ScaledExperienceStage({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateScale = () => setScale(container.clientWidth / STAGE_WIDTH);
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative aspect-video min-h-0 w-full overflow-hidden rounded-2xl bg-black shadow-xl">
      <div
        className="absolute left-0 top-0"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function Selector<T extends number>({
  label,
  values,
  value,
  onChange,
  formatValue,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  formatValue: (value: T) => string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={candidate === value}
            onClick={() => onChange(candidate)}
            className={`min-h-11 rounded-xl border px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${candidate === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"}`}
          >
            {formatValue(candidate)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function StorybookExperiencePlayer() {
  const [questionCount, setQuestionCount] = useState<StorybookExperienceQuestionCount>(40);
  const [personCount, setPersonCount] = useState<StorybookExperiencePersonCount>(3);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [questionTypeFilter, setQuestionTypeFilter] = useState<"ALL" | StorybookExperienceQuestionType>("ALL");
  const [pixelRevealStep, setPixelRevealStep] = useState(1);
  const runtime = useMemo(() => buildStorybookExperienceRuntime({ questionCount, personCount }), [questionCount, personCount]);
  const current = runtime.moments[currentIndex] ?? runtime.moments[0];
  const displayState = useMemo(() => ({ ...baseDisplayState, templateRevealCount: pixelRevealStep }), [pixelRevealStep]);
  const comparisonQuestion = current.questionNumber === null
    ? runtime.moments.find((moment) => moment.kind === "QUESTION")
    : runtime.moments.find((moment) => moment.kind === "QUESTION" && moment.questionNumber === current.questionNumber);
  const comparisonSolution = comparisonQuestion
    ? runtime.moments.find((moment) => moment.kind === "SOLUTION" && moment.questionNumber === comparisonQuestion.questionNumber)
    : undefined;
  const comparisonQuestionIndex = comparisonQuestion ? runtime.moments.indexOf(comparisonQuestion) : -1;
  const comparisonSolutionIndex = comparisonSolution ? runtime.moments.indexOf(comparisonSolution) : -1;
  const elapsedSeconds = runtime.moments.slice(0, currentIndex).reduce((total, moment) => total + moment.durationSeconds, 0);
  const totalSeconds = runtime.plan.review.totalSeconds;

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setCurrentIndex((index) => {
        if (index >= runtime.moments.length - 1) {
          setIsPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isPlaying, runtime.moments.length]);

  function changeQuestionCount(next: StorybookExperienceQuestionCount) {
    setQuestionCount(next);
    setCurrentIndex(0);
    setIsPlaying(false);
    setQuestionTypeFilter("ALL");
    setPixelRevealStep(1);
  }

  function changePersonCount(next: StorybookExperiencePersonCount) {
    setPersonCount(next);
    setCurrentIndex(0);
    setIsPlaying(false);
    setQuestionTypeFilter("ALL");
    setPixelRevealStep(1);
  }

  function changeQuestionTypeFilter(next: "ALL" | StorybookExperienceQuestionType) {
    setQuestionTypeFilter(next);
    setIsPlaying(false);
    setPixelRevealStep(1);
    if (next === "ALL") return;
    const nextIndex = runtime.moments.findIndex((moment) => moment.kind === "QUESTION" && moment.questionType === next);
    if (nextIndex >= 0) setCurrentIndex(nextIndex);
  }

  function goTo(index: number) {
    setCurrentIndex(Math.min(runtime.moments.length - 1, Math.max(0, index)));
    setIsPlaying(false);
    setPixelRevealStep(1);
  }

  const slideLabel = slideLabelFor(current);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1fr_auto_auto_minmax(13rem,16rem)] xl:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-800">Interne Simulation · keine Speicherung</p>
          <h2 className="mt-2 text-xl font-bold">Abendkonfiguration</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Die Auswahl verändert ausschließlich die lokale Experience-Simulation. Template und Quizdaten bleiben unverändert.</p>
        </div>
        <Selector label="Länge" values={STORYBOOK_EXPERIENCE_QUESTION_COUNTS} value={questionCount} onChange={changeQuestionCount} formatValue={(candidate) => `${candidate} Fragen`} />
        <Selector label="Perspektiven" values={STORYBOOK_EXPERIENCE_PERSON_COUNTS} value={personCount} onChange={changePersonCount} formatValue={(candidate) => `${candidate} ${candidate === 1 ? "Person" : "Personen"}`} />
        <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Fragentyp
          <Select
            aria-label="Fragentyp auswählen"
            value={questionTypeFilter}
            onChange={(event) => changeQuestionTypeFilter(event.target.value as "ALL" | StorybookExperienceQuestionType)}
            className="mt-2 min-h-11 rounded-xl border-slate-300 font-semibold normal-case tracking-normal text-slate-800"
          >
            <option value="ALL">Alle Fragentypen</option>
            {STORYBOOK_EXPERIENCE_QUESTION_TYPES.map((questionType) => <option key={questionType} value={questionType}>{questionTypeLabels[questionType]}</option>)}
          </Select>
        </label>
      </section>

      <section className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <ScaledExperienceStage>
            <PresentationSlideRenderer
              quiz={runtime.quiz}
              slide={current.slide}
              slides={runtime.slides}
              slideIndex={currentIndex}
              slideLabel={slideLabel}
              theme={runtime.theme}
              displayState={displayState}
              storybookContext={current.storybookContext}
            />
          </ScaledExperienceStage>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} className="min-h-11 rounded-xl border border-slate-300 px-4 font-bold disabled:cursor-not-allowed disabled:opacity-40">Zurück</button>
                <button type="button" onClick={() => setIsPlaying((playing) => !playing)} className="min-h-11 min-w-32 rounded-xl bg-slate-900 px-5 font-bold text-white">{isPlaying ? "Pausieren" : "Abend abspielen"}</button>
                <button type="button" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === runtime.moments.length - 1} className="min-h-11 rounded-xl border border-slate-300 px-4 font-bold disabled:cursor-not-allowed disabled:opacity-40">Weiter</button>
              </div>
              <p className="text-sm font-semibold tabular-nums text-slate-600">{formatDuration(elapsedSeconds)} / {formatDuration(totalSeconds)} · Moment {currentIndex + 1} von {runtime.moments.length}</p>
            </div>
            <label className="mt-4 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500" htmlFor="experience-position">Position im Abend</label>
            <input id="experience-position" type="range" min={0} max={runtime.moments.length - 1} value={currentIndex} onChange={(event) => goTo(Number(event.target.value))} className="mt-2 w-full accent-slate-900" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="font-bold">Rhythmus des Abends</h3><p className="text-xs text-slate-500">Höhe zeigt Intensität; Farbe und Beschriftung ordnen Fragentyp, Beat und Komposition ein.</p></div>
              <span className="text-right text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                {current.questionType ? `${questionTypeLabels[current.questionType]} · ` : ""}{beatLabels[current.beat]} · {compositionLabels[current.composition]}
              </span>
            </div>
            <div className="flex h-20 items-end gap-px overflow-hidden rounded-xl bg-slate-100 p-2" role="list" aria-label="Dramaturgischer Verlauf">
              {runtime.moments.map((moment, index) => (
                <button
                  key={moment.id}
                  type="button"
                  role="listitem"
                  aria-label={`${momentKindLabels[moment.kind]} ${moment.questionNumber ?? moment.chapterNumber ?? ""}, ${moment.questionType ? `${questionTypeLabels[moment.questionType]}, ` : ""}${beatLabels[moment.beat]}, ${compositionLabels[moment.composition]}`}
                  title={`${momentKindLabels[moment.kind]} · ${moment.questionType ? `${questionTypeLabels[moment.questionType]} · ` : ""}${beatLabels[moment.beat]} · ${compositionLabels[moment.composition]}`}
                  onClick={() => goTo(index)}
                  className={`min-w-[3px] flex-1 rounded-sm transition ${timelineColor(moment, index === currentIndex)} ${questionTypeFilter !== "ALL" && moment.questionType !== questionTypeFilter ? "opacity-20" : ""}`}
                  style={{ height: `${moment.intensity * 18}%` }}
                />
              ))}
            </div>
          </div>

          {comparisonQuestion && comparisonSolution && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="experience-comparison-heading">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 id="experience-comparison-heading" className="font-bold">Frage und Auflösung im Direktvergleich</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {comparisonQuestion.questionType ? questionTypeLabels[comparisonQuestion.questionType] : "Frage"} · produktiv automatisch aufgelöste Layouts
                  </p>
                </div>
                {comparisonQuestion.questionType === "PIXEL_REVEAL" && (
                  <fieldset>
                    <legend className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Pixelstufe</legend>
                    <div className="flex gap-2">
                      {[1, 2, 3].map((step) => (
                        <button key={step} type="button" aria-pressed={pixelRevealStep === step} onClick={() => setPixelRevealStep(step)} className={`min-h-11 min-w-11 rounded-xl border font-bold ${pixelRevealStep === step ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}>{step}</button>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <article className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.13em] text-slate-500"><span>Frage</span><span>{comparisonQuestion.slide.typ === "frage" ? comparisonQuestion.slide.frage.presentationLayouts.question.variant : ""}</span></div>
                  <ScaledExperienceStage>
                    <PresentationSlideRenderer quiz={runtime.quiz} slide={comparisonQuestion.slide} slides={runtime.slides} slideIndex={comparisonQuestionIndex} slideLabel={slideLabelFor(comparisonQuestion)} theme={runtime.theme} displayState={displayState} storybookContext={comparisonQuestion.storybookContext} />
                  </ScaledExperienceStage>
                </article>
                <article className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.13em] text-slate-500"><span>Auflösung</span><span>{comparisonSolution.slide.typ === "aufloesung" ? comparisonSolution.slide.frage.presentationLayouts.solution.variant : ""}</span></div>
                  <ScaledExperienceStage>
                    <PresentationSlideRenderer quiz={runtime.quiz} slide={comparisonSolution.slide} slides={runtime.slides} slideIndex={comparisonSolutionIndex} slideLabel={slideLabelFor(comparisonSolution)} theme={runtime.theme} displayState={displayState} storybookContext={comparisonSolution.storybookContext} />
                  </ScaledExperienceStage>
                </article>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4" aria-label="Experience Review">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-800">Aktueller Moment</p>
            <h2 className="mt-2 text-2xl font-bold">{current.title}</h2>
            {current.subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-600">{current.subtitle}</p>}
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Beat</dt><dd className="mt-1 font-bold">{beatLabels[current.beat]}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Komposition</dt><dd className="mt-1 font-bold">{compositionLabels[current.composition]}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Fragentyp</dt><dd className="mt-1 font-bold">{current.questionType ? questionTypeLabels[current.questionType] : "Dramaturgischer Übergang"}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Absicht</dt><dd className="mt-1 font-bold">{imageIntentLabels[current.imageIntent]}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Verweildauer</dt><dd className="mt-1 font-bold">{current.durationSeconds} Sek.</dd></div>
            </dl>
            <div className="mt-5"><span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Intensität</span><div className="mt-2 flex gap-1" aria-label={`${current.intensity} von 5`}>
              {Array.from({ length: 5 }, (_, index) => <span key={index} className={`h-2 flex-1 rounded-full ${index < current.intensity ? "bg-rose-800" : "bg-slate-200"}`} />)}
            </div></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold">Experience Review</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-600">Simulierte Bühnezeit</dt><dd className="font-bold tabular-nums">ca. {Math.round(totalSeconds / 60)} Min.</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-600">Erinnerungen</dt><dd className="font-bold">alle {Math.min(...runtime.plan.review.memoryQuestionGaps)}–{Math.max(...runtime.plan.review.memoryQuestionGaps)} Fragen</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-600">Ruheanteil</dt><dd className="font-bold">{Math.round(runtime.plan.review.quietMomentShare * 100)} %</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-600">Bildmomente</dt><dd className="font-bold">{Math.round(runtime.plan.review.visualMomentShare * 100)} %</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-600">Längste Wiederholung</dt><dd className="font-bold">{runtime.plan.review.longestCompositionRun} Momente</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-600">Gleicher Fragentyp</dt><dd className="font-bold">max. {runtime.plan.review.longestQuestionTypeRun} Frage</dd></div>
            </dl>
            <div className={`mt-5 rounded-xl p-3 text-sm ${runtime.plan.review.issues.length === 0 ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}>
              {runtime.plan.review.issues.length === 0 ? "Alle dramaturgischen Regeln sind erfüllt." : runtime.plan.review.issues.join(" ")}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold">Personenpräsenz</h2>
            <p className="mt-1 text-xs text-slate-500">Gezählt über Cover, Porträt, Split, Sequenz und Erinnerung.</p>
            <div className="mt-4 space-y-3">
              {runtime.plan.review.personExposure.map((exposure, index) => {
                const maximum = Math.max(...runtime.plan.review.personExposure);
                return <div key={index}><div className="flex justify-between text-sm"><span>Person {index + 1}</span><strong>{exposure} Bildmomente</strong></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-rose-800" style={{ width: `${(exposure / maximum) * 100}%` }} /></div></div>;
              })}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
