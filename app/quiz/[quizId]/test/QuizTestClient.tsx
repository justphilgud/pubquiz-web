"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import {
  resolvePresentationAudienceState,
  resolvePresentationLiveState,
  resolvePresentationSequenceIndex,
  type PresentationLiveState,
  type PresentationQuestionIdentity,
} from "@/app/rendering/presentation/presentationLiveState";
import {
  getQuizSolutionStrategyLabel,
  type QuizSolutionStrategy,
} from "@/app/quiz/flow/quizFlow";
import {
  getPraesentationStatus,
  setPraesentationSlideIndex,
} from "../praesentation/statusActions";

export type QuizTestSlide = {
  key: string;
  label: string;
  slideType: string;
  phase: "QUESTION" | "SOLUTION" | "NON_QUESTION";
  sectionId: number | null;
  questionAssignmentId: number | null;
  questionId: number | null;
  visibleIndex: number | null;
  enabled: boolean;
  solutionStrategy: QuizSolutionStrategy | null;
  sectionTitle: string | null;
};

type Props = {
  quizId: number;
  quizTitle: string;
  templateName: string;
  templateSource: string;
  initialLiveState: PresentationLiveState;
  slides: QuizTestSlide[];
  questionIdentities: PresentationQuestionIdentity[];
};

const quickTargets = [
  ["WELCOME", "Begrüßung"],
  ["QR_CODE", "QR-Code"],
  ["RULES", "Regeln"],
  ["ROUND_INTRO", "Erstes Rundenintro"],
  ["STORY_ELEMENT", "Erstes Story-Element"],
  ["IMAGE", "Erstes Bild"],
  ["QUOTE", "Erstes Zitat"],
  ["AUDIO", "Erstes Audio"],
  ["VIDEO", "Erstes Video"],
  ["QUESTION", "Erste Frage"],
  ["QUESTION_SOLUTION", "Erste Auflösung"],
  ["BREAK", "Pause"],
  ["INTERMEDIATE_STANDINGS", "Zwischenstand"],
  ["FINAL_STANDINGS", "Endstand"],
  ["WINNER", "Gewinner"],
  ["CLOSING", "Abschluss"],
] as const;

export default function QuizTestClient({
  quizId,
  quizTitle,
  templateName,
  templateSource,
  initialLiveState,
  slides,
  questionIdentities,
}: Props) {
  const [liveState, setLiveState] = useState(initialLiveState);
  const [isJumping, setIsJumping] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const visibleSlides = useMemo(
    () => slides
      .filter((slide) => slide.visibleIndex !== null)
      .sort((left, right) =>
        (left.visibleIndex ?? 0) - (right.visibleIndex ?? 0),
      ),
    [slides],
  );
  const visibleKeys = useMemo(
    () => visibleSlides.map((slide) => slide.key),
    [visibleSlides],
  );
  const position = resolvePresentationSequenceIndex(liveState, visibleKeys);
  const currentSlide = position.index >= 0
    ? visibleSlides[position.index]
    : null;
  const audienceState = resolvePresentationAudienceState(
    liveState,
    questionIdentities,
  );

  const refreshStatus = useCallback(async () => {
    const stored = await getPraesentationStatus(quizId);
    setLiveState(resolvePresentationLiveState(stored));
  }, [quizId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshStatus().catch(() => {
        setMessage("Der Präsentationsstatus konnte nicht aktualisiert werden.");
      });
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [refreshStatus]);

  async function jumpTo(slide: QuizTestSlide | null) {
    if (!slide || slide.visibleIndex === null || isJumping) return;
    setIsJumping(true);
    setMessage(null);
    try {
      const stored = await setPraesentationSlideIndex(
        quizId,
        slide.visibleIndex,
        slide.key,
      );
      setLiveState(resolvePresentationLiveState(stored));
    } catch {
      setMessage("Das Ablaufelement konnte nicht aktiviert werden.");
    } finally {
      setIsJumping(false);
    }
  }

  const currentVisibleIndex = currentSlide?.visibleIndex ?? null;
  const previousSlide = currentVisibleIndex === null
    ? null
    : visibleSlides[currentVisibleIndex - 1] ?? null;
  const nextSlide = currentVisibleIndex === null
    ? visibleSlides[0] ?? null
    : visibleSlides[currentVisibleIndex + 1] ?? null;
  const lastQuestion = [...visibleSlides].reverse().find(
    (slide) => slide.phase === "QUESTION",
  ) ?? null;
  const lastSolution = [...visibleSlides].reverse().find(
    (slide) => slide.phase === "SOLUTION",
  ) ?? null;
  const nextBlockQuestion = currentSlide?.sectionId === null || !currentSlide
    ? null
    : visibleSlides.find(
        (slide) =>
          slide.phase === "QUESTION" &&
          slide.sectionId !== null &&
          slide.sectionId !== currentSlide.sectionId &&
          (slide.visibleIndex ?? -1) > (currentVisibleIndex ?? -1),
      ) ?? null;
  const firstSolutionBlock = visibleSlides.find(
    (slide) =>
      slide.phase === "SOLUTION" &&
      slide.solutionStrategy === "END_OF_BLOCK",
  ) ?? null;

  const syncLabel = position.resolution === "SLIDE_KEY"
    ? "Synchron über slide_key"
    : position.resolution === "LEGACY_INDEX"
      ? "Legacy-Index aktiv"
      : "Nicht sicher auflösbar";
  const phase = currentSlide?.phase ?? audienceState.phase;
  const currentQuestionAssignmentId = currentSlide?.questionAssignmentId ??
    (audienceState.kind === "QUESTION"
      ? audienceState.questionAssignmentId
      : null);
  const currentQuestionId = currentSlide?.questionId ??
    (audienceState.kind === "QUESTION" ? audienceState.questionId : null);

  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                Interne Diagnose · nur Administration
              </p>
              <h1 className="mt-2 text-3xl font-black">Quiz testen</h1>
              <p className="mt-2 text-slate-600">{quizTitle}</p>
            </div>
            <a
              href={`/quiz/${quizId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
            >
              Zurück zum Quiz
            </a>
          </div>
        </header>

        {message && (
          <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 font-semibold text-rose-900">
            {message}
          </p>
        )}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <Card className="rounded-3xl p-5 sm:p-6">
            <h2 className="text-xl font-black">Produktoberflächen</h2>
            <p className="mt-1 text-sm text-slate-600">
              Jede Oberfläche öffnet sich erst durch deinen Klick in einem neuen Tab.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["Moderation öffnen", `/quiz/${quizId}/moderation`],
                ["Präsentation öffnen", `/quiz/${quizId}/praesentation`],
                ["Antwortformular öffnen", `/quiz/${quizId}/antworten`],
                ["Auswertung öffnen", `/quiz/${quizId}/auswertung`],
                ["Ablauf öffnen", `/quiz/${quizId}/ablauf`],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold transition hover:border-cyan-500 hover:bg-cyan-50"
                >
                  {label}
                </a>
              ))}
            </div>
          </Card>

          <Card className="rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black">Live-State</h2>
              <Badge variant={position.resolution === "UNRESOLVED" ? "danger" : "success"}>
                {syncLabel}
              </Badge>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold text-slate-500">Template</dt><dd className="mt-1 break-words font-bold">{templateName}</dd></div>
              <div><dt className="font-semibold text-slate-500">Herkunft</dt><dd className="mt-1 font-bold">{templateSource}</dd></div>
              <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">slide_key</dt><dd className="mt-1 break-all font-mono text-xs">{liveState.slideKey ?? "—"}</dd></div>
              <div><dt className="font-semibold text-slate-500">Ablaufelement</dt><dd className="mt-1 font-bold">{currentSlide?.slideType ?? "Unbekannt"}</dd></div>
              <div><dt className="font-semibold text-slate-500">Phase</dt><dd className="mt-1 font-bold">{phase}</dd></div>
              <div><dt className="font-semibold text-slate-500">Block</dt><dd className="mt-1 font-bold">{currentSlide?.sectionTitle ?? "Global"}</dd></div>
              <div><dt className="font-semibold text-slate-500">Auflösungsstrategie</dt><dd className="mt-1 font-bold">{currentSlide?.solutionStrategy ? getQuizSolutionStrategyLabel(currentSlide.solutionStrategy) : "—"}</dd></div>
              <div><dt className="font-semibold text-slate-500">Quizfrage-Zuordnung</dt><dd className="mt-1 font-mono">{currentQuestionAssignmentId ?? "—"}</dd></div>
              <div><dt className="font-semibold text-slate-500">Frage-ID</dt><dd className="mt-1 font-mono">{currentQuestionId ?? "—"}</dd></div>
              <div><dt className="font-semibold text-slate-500">Ablaufelemente</dt><dd className="mt-1 font-bold">{visibleSlides.length} sichtbar · {slides.length} gesamt</dd></div>
              <div><dt className="font-semibold text-slate-500">Position</dt><dd className="mt-1 font-bold">{position.index >= 0 ? `${position.index + 1} / ${visibleSlides.length}` : "—"}</dd></div>
            </dl>
          </Card>
        </section>

        <Card className="rounded-3xl p-5 sm:p-6">
          <h2 className="text-xl font-black">Schnellsprung</h2>
          <p className="mt-1 text-sm text-slate-600">
            Nutzt exakt denselben Präsentationsstatus wie die reguläre Moderation.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <Select
              aria-label="Ablaufelement auswählen"
              value={currentSlide?.key ?? ""}
              disabled={isJumping}
              onChange={(event) => {
                void jumpTo(
                  visibleSlides.find((slide) => slide.key === event.target.value) ?? null,
                );
              }}
              className="min-h-11"
            >
              <option value="" disabled>Ablaufelement auswählen</option>
              {visibleSlides.map((slide) => (
                <option key={slide.key} value={slide.key}>{slide.label}</option>
              ))}
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={!previousSlide || isJumping} onClick={() => void jumpTo(previousSlide)}>Vorheriges</Button>
              <Button variant="primary" disabled={!nextSlide || isJumping} onClick={() => void jumpTo(nextSlide)}>Nächstes</Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {quickTargets.map(([type, label]) => {
              const target = visibleSlides.find((slide) =>
                type === "STORY_ELEMENT"
                  ? ["CHAPTER_INTRO", "IMAGE", "IMAGE_GALLERY", "TEXT", "QUOTE", "PORTRAIT", "MEDIA_SEQUENCE", "AUDIO", "VIDEO", "CUSTOM_MESSAGE"].includes(slide.slideType)
                  : slide.slideType === type,
              ) ?? null;
              return <Button key={type} variant="secondary" disabled={!target || isJumping} onClick={() => void jumpTo(target)}>{label}</Button>;
            })}
            <Button variant="ghost" disabled={!nextBlockQuestion || isJumping} onClick={() => void jumpTo(nextBlockQuestion)}>Erste Frage des nächsten Blocks</Button>
            <Button variant="ghost" disabled={!firstSolutionBlock || isJumping} onClick={() => void jumpTo(firstSolutionBlock)}>Erster Auflösungsblock</Button>
            <Button variant="ghost" disabled={!lastQuestion || isJumping} onClick={() => void jumpTo(lastQuestion)}>Letzte Frage</Button>
            <Button variant="ghost" disabled={!lastSolution || isJumping} onClick={() => void jumpTo(lastSolution)}>Letzte Auflösung</Button>
          </div>
        </Card>

        {slides.some((slide) => !slide.enabled) && (
          <Card className="rounded-3xl border-amber-300 bg-amber-50 p-5 sm:p-6">
            <h2 className="text-lg font-black text-amber-950">Ausgeblendete Elemente</h2>
            <p className="mt-1 text-sm text-amber-900">
              Diese Elemente sind diagnostisch sichtbar, aber nicht anspringbar, weil sie nicht Teil der produktiven Sequenz sind.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-amber-950">
              {slides.filter((slide) => !slide.enabled).map((slide) => (
                <li key={slide.key} className="break-all rounded-xl border border-amber-300 bg-white/70 p-3">
                  <span className="font-bold">{slide.label}</span><br />
                  <span className="font-mono text-xs">{slide.key}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="rounded-3xl p-5 sm:p-6">
          <h2 className="text-xl font-black">Kurztest in zehn Schritten</h2>
          <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {[
              "Moderation öffnen",
              "Präsentation öffnen",
              "Antwortformular als Team öffnen",
              "Zu erster Frage springen",
              "Antwort absenden",
              "Auflösung zeigen",
              "Pause zeigen",
              "Nächste Frage zeigen",
              "Antwortformular neu laden",
              "Auswertung öffnen",
            ].map((step, index) => (
              <li key={step} className="rounded-xl bg-slate-50 p-3">
                <span className="mr-2 font-black text-cyan-700">{index + 1}.</span>{step}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </main>
  );
}
