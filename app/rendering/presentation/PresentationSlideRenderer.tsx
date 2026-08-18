"use client";

/* eslint-disable @next/next/no-img-element -- Slides render dynamic quiz media whose URLs and dimensions are not known at build time. */

import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";

import { PUBLIC_CALENDAR_LANDING_PATH } from "@/app/calendar/publicCalendar";
import { buildQuestionTemplateRuntimeModel } from "@/app/fragen/editor/templates/questionTemplateRuntime";
import { parsePrizeSlots } from "@/app/quiz/fixedSlidesPolicy";
import type { QuizPraesentationResult } from "../../quiz/actions";
import { formatQuizPoints } from "../../quiz/formatQuizPoints";
import {
  type Medium,
  type PraesentationQuiz,
  type Slide,
} from "@/app/quiz/[quizId]/praesentation/buildPraesentationSlides";
import { isQuestionSection } from "@/app/quiz/quizSectionPolicy";
import { QuizThemeScope } from "@/app/rendering/theme/QuizThemeScope";
import {
  PresentationDesignBackdrop,
  PresentationDesignFooter,
  PresentationDesignHeader,
  PresentationDesignStage,
} from "./PresentationDesignSystem";
import {
  PresentationStorybookQuestionSlide,
  PresentationStorybookSolutionSlide,
  resolveStorybookQuestionKind,
  type StorybookPresentationMedium,
} from "./PresentationStorybookQuestionTypes";
import type { ResolvedQuizTheme } from "@/app/rendering/theme/quizTheme";
import type { PresentationPlaybackCommand } from "./presentationLiveState";
import { selectDeterministicTemplateImage } from "@/app/rendering/presentationTemplates/deterministicTemplateImage";
import { isSafeTemplateAssetReference } from "@/app/rendering/presentationTemplates/presentationTemplateAssets";
import {
  resolveStorybookComposition,
  type ResolveStorybookCompositionInput,
  type StorybookCompositionVariant,
} from "@/app/rendering/presentationTemplates/storybookComposition";
import type { StorybookMemoryAsset } from "@/app/rendering/templateRegistry";
import {
  pixelRuntimeStageToMediaSlot,
  resolvePixelCountdownSeconds,
  type PixelLiveState,
} from "@/app/quiz/interaction/pixelLiveInteraction";
import type { PollLiveState } from "@/app/quiz/interaction/pollInteraction";
import { isPollQuestionTemplateId } from "@/app/fragen/editor/templates/questionTemplateRegistry";

type ScoreEntry = {
  teamname: string;
  punkte: number;
};

type Abschnitt = QuizPraesentationResult["abschnitte"][number];

export type PresentationSlideDisplayState = {
  renderMode: "PRESENTATION" | "MODERATION_PREVIEW" | "DESIGN_PREVIEW";
  templateRevealCount: number;
  punktestand: ScoreEntry[];
  endstandRevealCount: number;
  now: number;
  estimationPhase: "HIDDEN" | "RUNNING" | "SOLUTION";
  schaetzfrage: {
    fragen_id: number;
    frage: string;
    richtigeAntwort: string | null;
  } | null;
  isSchaetzfrageLoading: boolean;
  remoteCountdownDauerSekunden: number | null;
  remoteCountdownStartedAt: string | null;
  remoteCountdownStatus: string | null;
  mediaOverlayActive: boolean;
  playbackCommand: PresentationPlaybackCommand;
  playbackCommandId: number;
  pixelState?: PixelLiveState | null;
  pollState?: PollLiveState | null;
  teamJoinState?: {
    teamNames: string[];
    totalTeams: number;
    remainingTeams: number;
  } | null;
};

type Props = {
  quiz: QuizPraesentationResult;
  slide: Slide | undefined;
  slides: Slide[];
  slideIndex: number;
  slideLabel: string;
  theme: ResolvedQuizTheme;
  displayState: PresentationSlideDisplayState;
  storybookContext?: {
    personIds?: readonly string[];
    contentKind?: ResolveStorybookCompositionInput["contentKind"];
    composition?: StorybookCompositionVariant;
    preferredAssetRoles?: readonly StorybookMemoryAsset["role"][];
  };
};

function SynchronizedMedia({
  kind,
  src,
  command,
  commandId,
  renderMode,
  className,
  activationClassName,
  poster,
  loop = false,
}: {
  kind: "audio" | "video";
  src: string;
  command: PresentationPlaybackCommand;
  commandId: number;
  renderMode: PresentationSlideDisplayState["renderMode"];
  className?: string;
  activationClassName?: string;
  poster?: string;
  loop?: boolean;
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const handledCommandIdRef = useRef<number | null>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  async function play() {
    try {
      await mediaRef.current?.play();
      setPlaybackBlocked(false);
    } catch {
      setPlaybackBlocked(true);
    }
  }

  useEffect(() => {
    if (renderMode !== "PRESENTATION") return;
    const media = mediaRef.current;
    if (!media) return;
    if (command === null) {
      media.pause();
      handledCommandIdRef.current = null;
      return;
    }
    if (handledCommandIdRef.current === commandId) return;
    handledCommandIdRef.current = commandId;

    if (command === "play") {
      void media
        .play()
        .then(() => setPlaybackBlocked(false))
        .catch(() => setPlaybackBlocked(true));
    } else if (command === "pause") {
      media.pause();
    } else if (command === "stop") {
      media.pause();
      media.currentTime = 0;
    }
  }, [command, commandId, renderMode]);

  const media =
    kind === "audio" ? (
      <audio
        ref={(element) => {
          mediaRef.current = element;
        }}
        src={src}
        loop={loop}
        preload="metadata"
      />
    ) : (
      <video
        ref={(element) => {
          mediaRef.current = element;
        }}
        src={src}
        poster={poster}
        loop={loop}
        muted={renderMode !== "PRESENTATION"}
        playsInline
        className={className}
        preload="metadata"
      />
    );

  return (
    <>
      {media}
      {playbackBlocked && renderMode === "PRESENTATION" && (
        <button
          type="button"
          onClick={() => void play()}
          className={activationClassName ?? "rounded-xl border border-white/40 bg-black/80 px-4 py-3 text-sm font-bold text-white"}
        >
          Medienwiedergabe einmalig aktivieren
        </button>
      )}
    </>
  );
}

export default function PresentationSlideRenderer({
  quiz,
  slide,
  slides,
  slideIndex,
  slideLabel,
  theme,
  displayState,
  storybookContext,
}: Props) {
  const praesentationQuiz = quiz as PraesentationQuiz;
  const {
    renderMode,
    templateRevealCount,
    punktestand,
    endstandRevealCount,
    now,
    estimationPhase,
    schaetzfrage,
    isSchaetzfrageLoading,
    remoteCountdownDauerSekunden,
    remoteCountdownStartedAt,
    remoteCountdownStatus,
    mediaOverlayActive,
    playbackCommand,
    playbackCommandId,
    pixelState = null,
    pollState = null,
    teamJoinState = null,
  } = displayState;
  const relativeAnswerUrl = `/quiz/${quiz.quiz_id}/antworten`;
  const relativeCalendarUrl = PUBLIC_CALENDAR_LANDING_PATH;
  const [answerUrl, setAnswerUrl] = useState(relativeAnswerUrl);
  const [calendarUrl, setCalendarUrl] = useState(relativeCalendarUrl);
  useEffect(() => {
    setAnswerUrl(`${window.location.origin}${relativeAnswerUrl}`);
    setCalendarUrl(`${window.location.origin}${relativeCalendarUrl}`);
  }, [relativeAnswerUrl, relativeCalendarUrl]);
  const currentSlideMedia =
    slide?.typ === "frage"
      ? slide.frage.medien
      : slide?.typ === "aufloesung"
        ? [
            ...slide.frage.medien,
            ...slide.frage.antworten.flatMap((answer) => answer.medien),
          ]
        : [];
  const primaryPlaybackMediaId =
    currentSlideMedia.find(
      (medium) => isAudio(medium.datei) || isVideo(medium.datei),
    )?.medien_id ?? null;

function getMediumUrl(datei: string) {
  if (datei.startsWith("http://") || datei.startsWith("https://")) {
    return datei;
  }

  return `/medien/${datei}`;
}

function isBild(datei: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(datei);
}

function isAudio(datei: string) {
  return /\.(mp3|wav|ogg|m4a)$/i.test(datei);
}

function isVideo(datei: string) {
  return /\.(mp4|webm|mov)$/i.test(datei);
}

function toStorybookMedium(medium: Medium | undefined): StorybookPresentationMedium | null {
  if (!medium) return null;
  return {
    id: medium.medien_id,
    kind: isBild(medium.datei)
      ? "IMAGE"
      : isAudio(medium.datei)
        ? "AUDIO"
        : isVideo(medium.datei)
          ? "VIDEO"
          : "FILE",
    src: getMediumUrl(medium.datei),
    alt: medium.bemerkung || medium.datei,
    caption: medium.bemerkung,
  };
}

function sortiereAntworten(frage: QuizPraesentationResult["fragen"][number]) {
  return [...frage.antworten].sort((a, b) => {
    const indexA = frage.antwort_reihenfolge.indexOf(a.antwort_id);
    const indexB = frage.antwort_reihenfolge.indexOf(b.antwort_id);

    if (indexA === -1 && indexB === -1) return a.antwort_id - b.antwort_id;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;

    return indexA - indexB;
  });
}

function zeigtAntwortoptionen(
  frage: QuizPraesentationResult["fragen"][number],
) {
  if (frage.effektiver_antwortmodus === "OPEN") return false;
  if (frage.effektiver_antwortmodus === "CLOSED") return true;
  return frage.antworten.length > 1;
}

function renderMedienKarte(
  medium: Medium,
  variant: "small" | "large" | "overlay",
) {
  const isLarge = variant !== "small";
  const src = getMediumUrl(medium.datei);
  const isPlaybackTarget =
    medium.medien_id === primaryPlaybackMediaId &&
    (mediaOverlayActive ? variant === "overlay" : variant !== "overlay");
  const effectivePlaybackCommand = isPlaybackTarget ? playbackCommand : null;

  return (
    <div
      key={medium.medien_id}
      className={`presentation-media-card flex min-h-0 flex-col justify-center overflow-hidden rounded-[1.5rem] border-4 border-cyan-300 bg-black/65 p-4 shadow-[8px_8px_0_#ff00aa] ${isLarge ? "h-full" : ""
        }`}
    >
      {isBild(medium.datei) ? (
        <img
          src={src}
          alt={medium.bemerkung ?? medium.datei}
          className="h-full max-h-full w-full rounded-2xl object-contain"
        />
      ) : isAudio(medium.datei) ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <div className="text-7xl font-black text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa]">
            ▶
          </div>
          {renderMode === "PRESENTATION" ? <SynchronizedMedia kind="audio" src={src} command={effectivePlaybackCommand} commandId={playbackCommandId} renderMode={renderMode} /> : <PreviewAudioPlayer />}
        </div>
      ) : isVideo(medium.datei) ? (
        <SynchronizedMedia
          kind="video"
          src={src}
          className="h-full max-h-full w-full rounded-2xl object-contain"
          command={effectivePlaybackCommand}
          commandId={playbackCommandId}
          renderMode={renderMode}
        />
      ) : (
        <div className="break-all text-3xl font-black text-yellow-200">
          {medium.datei}
        </div>
      )}

      {medium.bemerkung && (
        <div className="mt-3 text-sm font-bold text-white/70">
          {medium.bemerkung}
        </div>
      )}
    </div>
  );
}

function renderAntwortOptionen(
  frage: QuizPraesentationResult["fragen"][number]
) {
  const antworten = sortiereAntworten(frage);
  const hatAntwortmoeglichkeiten = zeigtAntwortoptionen(frage);

  if (!hatAntwortmoeglichkeiten) {
    return (
      <div className="flex h-full items-center justify-center rounded-[1.5rem] border-4 border-dashed border-yellow-300 bg-black/40 p-8 text-center text-2xl font-black uppercase text-white/40">
        Offene Frage
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 content-center gap-4">
      {antworten.map((antwort, index) => (
        <div
          key={antwort.antwort_id}
          className="presentation-answer-option rounded-3xl border-4 border-yellow-300 bg-black/45 px-6 py-4 text-2xl font-black text-white shadow-[6px_6px_0_#ff00aa] xl:text-3xl"
        >
          <span className="mr-4 text-cyan-300">
            {String.fromCharCode(65 + index)}.
          </span>
          {antwort.antwort}
        </div>
      ))}
    </div>
  );
}

function PreviewAudioPlayer() {
  return (
    <div className="presentation-preview-audio flex w-full max-w-xl items-center gap-4 rounded-2xl border border-white/30 bg-black/35 p-4" data-preview-audio>
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-full border-2 border-current">▶</span>
      <div className="min-w-0 flex-1"><div className="font-black">Beispiel-Audio</div><div className="mt-2 h-2 rounded-full bg-white/20"><div className="h-full w-2/5 rounded-full bg-current" /></div></div>
      <span className="text-sm opacity-70">stumm</span>
    </div>
  );
}

function renderPunkteBadge(punkteModus?: string | null) {
  if (!punkteModus || punkteModus === "standard") return null;

  const label =
    punkteModus === "expertenbonus"
      ? "Expertenbonus"
      : punkteModus === "risikofrage"
        ? "Risikofrage"
        : punkteModus;

  return (
    <span className="presentation-badge rounded-xl border-4 border-yellow-300 bg-yellow-300 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-950 shadow-[4px_4px_0_#ff00aa]">
      {label}
    </span>
  );
}

function renderFrageSlide(slide: Extract<Slide, { typ: "frage" }>) {
  const frage = slide.frage;
  const templateData = frage.templateConfig?.templateData;
  const antworten = sortiereAntworten(frage);
  const hatAntwortmoeglichkeiten = zeigtAntwortoptionen(frage);
  const layoutVariant = frage.presentationLayouts.question.variant;
  const allPixelImageMedia = frage.templateId === "pixelbild" && layoutVariant === "REVEAL_SEQUENCE"
    ? frage.medien.filter((medium) => isBild(medium.datei)).sort((left, right) => left.sortierung - right.sortierung)
    : [];
  const keyedPixelStageMedia = allPixelImageMedia.filter((medium) =>
    medium.slotKey?.startsWith("pixel_stage_"),
  );
  const pixelRevealMedia = keyedPixelStageMedia.length > 0
    ? keyedPixelStageMedia
    : allPixelImageMedia.slice(-3);
  const pixelRevealStep = pixelRevealMedia.length > 0
    ? pixelState?.effectivePixelStage ?? Math.min(pixelRevealMedia.length, Math.max(1, templateRevealCount))
    : null;
  const livePixelMedium = pixelRevealStep === null
    ? null
    : pixelRevealMedia.find(
        (medium) => medium.slotKey === pixelRuntimeStageToMediaSlot(pixelRevealStep as 1 | 2 | 3),
      ) ?? pixelRevealMedia[pixelRevealStep - 1];
  const questionMedia = pixelRevealStep === null
    ? frage.medien
    : livePixelMedium
      ? [livePixelMedium]
      : [];
  const storybookKind = resolveStorybookQuestionKind(frage);

  if (theme.design.stylePreset === "BIRTHDAY" && storybookKind) {
    const audioMedium = frage.medien.find((medium) => isAudio(medium.datei));
    const selectedMedium = storybookKind === "AUDIO" ? audioMedium : questionMedia[0];
    const audioElement = renderMode === "PRESENTATION" && audioMedium ? (
      <SynchronizedMedia
        kind="audio"
        src={getMediumUrl(audioMedium.datei)}
        command={mediaOverlayActive ? null : playbackCommand}
        commandId={playbackCommandId}
        renderMode={renderMode}
        activationClassName="presentation-storybook-media-activation"
      />
    ) : null;
    return (
      <PresentationStorybookQuestionSlide
        question={frage}
        questionNumber={slide.frageIndexImBlock}
        layoutVariant={layoutVariant}
        kind={storybookKind}
        medium={toStorybookMedium(selectedMedium)}
        audioElement={audioElement}
        isPreview={renderMode !== "PRESENTATION"}
        pixelRevealStep={pixelRevealStep}
        pixelRevealTotal={pixelRevealMedia.length}
      />
    );
  }

  if (templateData?.kind === "GOOGLE_REVIEWS") {
    const visibleReviews = templateData.sequentialReveal
      ? templateData.reviews.slice(0, templateRevealCount)
      : templateData.reviews;
    return (
      <div data-presentation-layout={layoutVariant} className="presentation-question-card flex h-full min-h-0 flex-col rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/80 p-8 shadow-[8px_8px_0_#00e5ff]">
        <h2 className="text-4xl font-black text-white">{frage.frage}</h2>
        <div className="mt-6 grid min-h-0 flex-1 gap-4 overflow-auto lg:grid-cols-2">
          {visibleReviews.map((review, index) => (
            <article key={review.id} className="rounded-2xl border-2 border-yellow-300 bg-white/10 p-5 text-xl text-white">
              <div className="mb-3 flex items-center gap-3">
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-cyan-300 font-black text-slate-950">
                  {(review.authorName.trim()[0] || "?").toLocaleUpperCase("de-DE")}
                </span>
                <span className="font-bold">
                  {templateData.hideAuthorUntilSolution
                    ? "Google-Nutzer"
                    : review.authorName || "Google-Nutzer"}
                </span>
              </div>
              <p>„{review.text}“</p>
              {((review.rating && !templateData.hideRatingUntilSolution) || review.publishedLabel) && <p className="mt-3 text-sm text-yellow-200">
                {[review.rating && !templateData.hideRatingUntilSolution ? `${review.rating} ★` : "", review.publishedLabel].filter(Boolean).join(" · ")}
              </p>}
              <p className="mt-2 text-xs uppercase tracking-wide text-white/55">{review.attributionText || "Google Maps"}</p>
              <span className="sr-only">Rezension {index + 1}</span>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (templateData?.kind === "TRUE_FALSE") {
    return (
      <div data-presentation-layout={layoutVariant} className="presentation-question-card flex h-full flex-col justify-center rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/80 p-10 text-center shadow-[8px_8px_0_#00e5ff]">
        <h2 className="text-5xl font-black leading-tight text-white xl:text-7xl">{frage.frage}</h2>
        {hatAntwortmoeglichkeiten && (
          <div className="mt-10 grid grid-cols-2 gap-6 text-4xl font-black">
            <div className="rounded-2xl border-4 border-emerald-300 p-6 text-emerald-200">Wahr</div>
            <div className="rounded-2xl border-4 border-pink-400 p-6 text-pink-200">Falsch</div>
          </div>
        )}
      </div>
    );
  }

  if (templateData?.kind === "ANAGRAM") {
    return (
      <div data-presentation-layout={layoutVariant} className="presentation-question-card flex h-full flex-col items-center justify-center rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/80 p-10 text-center shadow-[8px_8px_0_#00e5ff]">
        <h2 className="text-3xl font-black text-white">{frage.frage}</h2>
        <p className="mt-10 break-words text-7xl font-black uppercase tracking-[0.2em] text-yellow-200 xl:text-9xl">{templateData.selectedSolution}</p>
      </div>
    );
  }

  if (templateData?.kind === "ORDERING") {
    return (
      <div data-presentation-layout={layoutVariant} className="presentation-question-card flex h-full min-h-0 flex-col rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/80 p-8 shadow-[8px_8px_0_#00e5ff]">
        <h2 className="text-4xl font-black text-white">{frage.frage}</h2>
        {hatAntwortmoeglichkeiten && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {antworten.map((answer) => <div key={answer.antwort_id} className="rounded-2xl border-2 border-cyan-300 bg-white/10 p-5 text-2xl font-bold text-white">{answer.antwort}</div>)}
          </div>
        )}
      </div>
    );
  }

  if (templateData?.kind === "ESTIMATE") {
    return (
      <div data-presentation-layout={layoutVariant} className="presentation-question-card flex h-full flex-col items-center justify-center rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/80 p-10 text-center shadow-[8px_8px_0_#00e5ff]">
        <h2 className="text-5xl font-black leading-tight text-white xl:text-7xl">{frage.frage}</h2>
        {templateData.unit && <p className="mt-8 rounded-2xl border-2 border-yellow-300 px-6 py-3 text-3xl font-black text-yellow-200">Antwort in {templateData.unit}</p>}
      </div>
    );
  }

  if (templateData?.kind === "POLL_SCALE") {
    const values = Array.from(
      { length: Math.floor((templateData.max - templateData.min) / templateData.step) + 1 },
      (_, index) => templateData.min + index * templateData.step,
    );
    return (
      <div data-presentation-layout={layoutVariant} className="presentation-question-card flex h-full flex-col items-center justify-center rounded-[1.5rem] border-4 border-cyan-300 bg-slate-950/80 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
        <div className="text-sm font-black uppercase tracking-[0.3em] text-cyan-200">Umfrage</div>
        <h2 className="mt-4 text-5xl font-black leading-tight text-white xl:text-7xl">{frage.frage}</h2>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {values.map((value) => <span key={value} className="grid size-20 place-items-center rounded-2xl border-4 border-yellow-300 text-3xl font-black text-yellow-200">{value.toLocaleString("de-DE")}</span>)}
        </div>
        <div className="mt-4 flex w-full max-w-4xl justify-between gap-6 text-lg font-bold text-white/70"><span>{templateData.minLabel}</span><span className="text-right">{templateData.maxLabel}</span></div>
      </div>
    );
  }

  if (layoutVariant === "STRUCTURED_RESPONSE") {
    return (
      <div data-presentation-layout={layoutVariant} className="grid h-full min-h-0 gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="presentation-question-card flex min-h-0 flex-col justify-center rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/80 p-8 shadow-[8px_8px_0_#00e5ff]">
          <div className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-pink-300">Mehrteilige Antwort</div>
          <h2 className="text-4xl font-black leading-tight text-white xl:text-6xl">{frage.frage}</h2>
        </div>
        <div className="grid min-h-0 content-center gap-4 rounded-[1.5rem] border-4 border-yellow-300 bg-black/45 p-6 shadow-[8px_8px_0_#ff00aa]">
          {frage.antwortfelder.map((field, index) => (
            <div key={field.antwortfeld_id} className="rounded-2xl border-2 border-cyan-300 bg-white/10 p-5 text-white">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Antwortteil {index + 1}</div>
              <div className="mt-2 text-3xl font-black">{field.label}</div>
              {field.ist_pflicht && <div className="mt-2 text-sm font-bold text-white/55">Pflichtangabe</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (templateData?.kind === "TRANSLATION_READ_ALOUD") {
    return (
      <div data-presentation-layout={layoutVariant} className="presentation-question-card flex h-full flex-col items-center justify-center rounded-[1.5rem] border-4 border-cyan-300 bg-slate-950/80 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
        <h2 className="text-5xl font-black leading-tight text-white">{frage.frage}</h2>
        <p className="mt-8 text-2xl font-bold text-cyan-200">
          {new Intl.DisplayNames(["de"], { type: "language" }).of(templateData.sourceLanguage)}
          {" → "}
          {new Intl.DisplayNames(["de"], { type: "language" }).of(templateData.targetLanguage)}
        </p>
        <p className="mt-4 text-lg text-white/60">Audio über den konfigurierten TTS-Ausgabeslot abspielen.</p>
      </div>
    );
  }

  if (
    layoutVariant === "MEDIA_FOCUS" ||
    layoutVariant === "REVEAL_SEQUENCE" ||
    layoutVariant === "FULLSCREEN_MEDIA" ||
    layoutVariant === "MEDIA_LEFT" ||
    layoutVariant === "MEDIA_RIGHT" ||
    layoutVariant === "MEDIA_TOP"
  ) {
    return (
      <div
        data-presentation-layout={layoutVariant}
        data-pixel-reveal-step={pixelRevealStep ?? undefined}
        className="grid h-full min-h-0 gap-4 lg:grid-cols-[0.48fr_1.52fr]"
      >
        <div className="presentation-question-card flex min-h-0 flex-col rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/70 p-5 shadow-[7px_7px_0_#00e5ff]">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex w-fit rotate-[-2deg] rounded-xl bg-pink-500 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-yellow-200 shadow-[4px_4px_0_#facc15]">
              Frage {slide.frageIndexImBlock}
            </div>

            {renderPunkteBadge(frage.punkte_modus)}
          </div>

          <h2 className="text-3xl font-black leading-tight text-white drop-shadow-[3px_3px_0_#ff00aa] xl:text-4xl">
            {frage.frage}
          </h2>

        </div>

        <div className="min-h-0 rounded-[1.5rem] border-4 border-yellow-300 bg-black/45 p-5 shadow-[8px_8px_0_#ff00aa]">
          {questionMedia.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-3xl border-4 border-dashed border-cyan-300 text-3xl font-black uppercase text-white/40">
              Kein Medium
            </div>
          ) : (
            <div className="grid h-full min-h-0 gap-4">
              {questionMedia.slice(0, 1).map((medium) =>
                renderMedienKarte(medium, "large")
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (layoutVariant === "CONTENT_CENTERED") {
    return (
      <div data-presentation-layout={layoutVariant} className="presentation-question-card flex h-full min-h-0 flex-col justify-center rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/70 p-10 shadow-[8px_8px_0_#00e5ff]">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex w-fit rotate-[-2deg] rounded-xl bg-pink-500 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-yellow-200 shadow-[4px_4px_0_#facc15]">
            Frage {slide.frageIndexImBlock}
          </div>

          {renderPunkteBadge(frage.punkte_modus)}
        </div>

        <h2 className="text-5xl font-black leading-tight text-white drop-shadow-[5px_5px_0_#ff00aa] xl:text-7xl">
          {frage.frage}
        </h2>
      </div>
    );
  }

  if (layoutVariant === "AUDIO_FOCUS") {
    const audioMedium = frage.medien[0];

    return (
      <div data-presentation-layout={layoutVariant} className="presentation-question-card flex h-full min-h-0 flex-col rounded-[1.5rem] border-4 border-[#38E8FF] bg-black/70 p-10 shadow-[0_0_24px_#38E8FF]">
        <div className="mb-10 text-center">
          <div className="mb-4 text-sm font-black uppercase tracking-[0.45em] text-[#38E8FF] drop-shadow-[0_0_8px_#38E8FF]">
            Audiofrage
          </div>

          <h2 className="mx-auto max-w-6xl text-6xl font-black leading-tight text-white drop-shadow-[0_0_10px_#FF3BD4]">
            {frage.frage}
          </h2>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="flex h-full max-h-[520px] w-full max-w-5xl flex-col items-center justify-center rounded-[2rem] border-4 border-[#FF3BD4] bg-[radial-gradient(circle_at_center,rgba(255,59,212,0.18),transparent_55%),linear-gradient(135deg,rgba(59,130,255,0.16),rgba(0,0,0,0.95))] p-10 text-center shadow-[0_0_20px_#FF3BD4,0_0_40px_rgba(255,59,212,0.35)]">
            {!audioMedium ? (
              <div className="text-4xl font-black uppercase text-white/40">
                Keine Audiodatei
              </div>
            ) : (
              <>
                {renderMode === "PRESENTATION" ? <SynchronizedMedia kind="audio" src={getMediumUrl(audioMedium.datei)} command={mediaOverlayActive ? null : playbackCommand} commandId={playbackCommandId} renderMode={renderMode} /> : <PreviewAudioPlayer />}

                <div className="mb-10 text-sm font-black uppercase tracking-[0.45em] text-[#FFD83B] drop-shadow-[0_0_8px_#FFD83B]">
                  Wiedergabe durch die Moderation
                </div>

                <div
                  aria-hidden="true"
                  className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-[#FFD83B] bg-black text-7xl font-black text-[#FFD83B] shadow-[0_0_18px_#FFD83B,0_0_42px_rgba(255,216,59,0.55)]"
                >
                  ▶
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-presentation-layout={layoutVariant} className="grid h-full min-h-0 gap-4 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="presentation-question-card flex min-h-0 flex-col rounded-[1.5rem] border-4 border-pink-500 bg-gradient-to-br from-slate-950 to-purple-950 p-6 shadow-[8px_8px_0_#00e5ff]">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex w-fit rotate-[-2deg] rounded-xl bg-pink-500 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-yellow-200 shadow-[4px_4px_0_#facc15]">
            Frage {slide.frageIndexImBlock}
          </div>

          {renderPunkteBadge(frage.punkte_modus)}
        </div>

        <h2 className="text-4xl font-black leading-tight text-white drop-shadow-[4px_4px_0_#ff00aa] xl:text-6xl">
          {frage.frage}
        </h2>

      </div>

      <div className="presentation-answer-panel min-h-0 rounded-[1.5rem] border-4 border-yellow-300 bg-gradient-to-br from-blue-950 to-slate-950 p-5 shadow-[8px_8px_0_#ff00aa]">
        {hatAntwortmoeglichkeiten ? (
          renderAntwortOptionen(frage)
        ) : frage.medien.length > 0 ? (
          <div className="grid h-full min-h-0 gap-3">
            {frage.medien.slice(0, 1).map((medium) =>
              renderMedienKarte(medium, "large")
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-3xl border-4 border-dashed border-cyan-300 bg-black/40 text-center text-xl font-black uppercase text-white/40">
            Keine Antwortmöglichkeiten
          </div>
        )}
      </div>
    </div>
  );
}

function renderRennPferd({
  farbe,
  nummer,
}: {
  farbe: string;
  nummer: number;
}) {
  return (
    <div className="relative h-20 w-32 animate-[pferdGalopp_0.55s_ease-in-out_infinite]">
      <svg
        viewBox="0 0 220 120"
        className="h-full w-full drop-shadow-[4px_4px_0_#000]"
      >
        <g
          fill={farbe}
          stroke="#020617"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse cx="94" cy="62" rx="54" ry="26" />
          <path d="M125 54 L154 24 L174 34 L145 63 Z" />
          <path d="M164 20 L199 29 L190 51 L158 44 Z" />
          <path d="M171 20 L178 5 L185 22 Z" />

          <path className="animate-[schweifWackel_0.45s_ease-in-out_infinite]" d="M42 55 Q8 34 18 78 Q32 66 50 69" />

          <path d="M61 82 L38 108" />
          <path d="M84 86 L74 114" />
          <path d="M116 84 L135 111" />
          <path d="M140 78 L176 101" />
        </g>

        <circle cx="181" cy="34" r="4" fill="#020617" />

        <g>
          <rect
            x="76"
            y="47"
            width="36"
            height="28"
            rx="6"
            fill="#f8fafc"
            stroke="#020617"
            strokeWidth="4"
          />
          <text
            x="94"
            y="68"
            textAnchor="middle"
            fontSize="20"
            fontWeight="900"
            fill="#020617"
          >
            {nummer}
          </text>
        </g>
      </svg>
    </div>
  );
}
function renderZwischenstandSlide() {
  const sortiertePunkte = [...punktestand]
    .sort((a, b) => b.punkte - a.punkte)
    .slice(0, 5);

  const maxPunkte = Math.max(
    ...sortiertePunkte.map((team) => team.punkte),
    1
  );

  const pferdeFarben = [
    "#22d3ee",
    "#fb7185",
    "#84cc16",
    "#60a5fa",
    "#f59e0b",
  ];

  const bahnFarben = [
    "from-cyan-900/80 to-cyan-700/60",
    "from-pink-900/80 to-pink-700/60",
    "from-emerald-900/80 to-emerald-700/60",
    "from-blue-900/80 to-blue-700/60",
    "from-orange-900/80 to-orange-700/60",
    "from-purple-900/80 to-purple-700/60",
  ];

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] border-4 border-yellow-300 bg-[radial-gradient(circle_at_50%_0%,rgba(250,204,21,0.16),transparent_35%),linear-gradient(180deg,rgba(88,28,135,0.45),rgba(2,6,23,0.92))] p-8 shadow-[8px_8px_0_#ff00aa]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="inline-flex w-fit rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
          Zwischenstand
        </div>

        <div className="rounded-2xl border-4 border-yellow-300 bg-black/55 px-5 py-2 text-sm font-black uppercase tracking-[0.25em] text-yellow-200 shadow-[4px_4px_0_#ff00aa]">
          Anonymer Zwischenstand
        </div>
      </div>

      <h2 className="mb-5 text-center text-5xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa] xl:text-6xl">
        So eng ist das Rennen
      </h2>

      <div className="min-h-0 flex-1 rounded-[1.5rem] border-4 border-cyan-300 bg-black/45 p-4 shadow-[6px_6px_0_#ff00aa]">
        <div className="grid h-full gap-3">
          {sortiertePunkte.map((team, index) => {
            const prozent = Math.max(7, (team.punkte / maxPunkte) * 100);
            const pferdLinks = `calc(${prozent}% - 5rem)`;

            return (
              <div
                key={`${team.teamname}-${index}`}
                className="grid grid-cols-[90px_1fr_130px] items-center gap-4"
              >
                <div className="flex h-full items-center justify-center rounded-2xl border-4 border-yellow-300 bg-slate-950/80 text-4xl font-black text-yellow-200 shadow-[4px_4px_0_#ff00aa]">
                  {index + 1}
                </div>

                <div className="relative h-full min-h-[72px] overflow-visible rounded-2xl border-4 border-cyan-300 bg-slate-950/70 shadow-[4px_4px_0_#ff00aa]">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-r-xl bg-gradient-to-r ${bahnFarben[index % bahnFarben.length]
                      }`}
                    style={{
                      width: `${prozent}%`,
                      animation: `bahnWachsen 1.2s ease-out ${index * 0.12}s both`,
                    }}
                  />

                  <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.08)_2px,transparent_2px,transparent_42px)]" />

                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-white drop-shadow-[3px_3px_0_#000]">
                    #{index + 1}
                  </div>

                  <div
                    className="absolute top-1/2 z-30"
                    style={{
                      left: pferdLinks,
                      animation: `pferdEinreiten 1.4s ease-out ${index * 0.12}s both`,
                    }}
                  >

                    {renderRennPferd({
                      farbe: pferdeFarben[index % pferdeFarben.length],
                      nummer: index + 1,
                    })}
                  </div>

                  <div
                    className="absolute top-1/2 z-30 h-4 w-16 -translate-y-1/2 rounded-full bg-yellow-200/40 blur-xl"
                    style={{
                      left: `calc(${prozent}% - 9rem)`,
                    }}
                  />

                  <div
                    className="absolute right-3 top-1/2 z-10 h-[82%] w-6 -translate-y-1/2 rounded-sm border-2 border-white shadow-[0_0_18px_#facc15]"
                    style={{
                      backgroundImage:
                        "conic-gradient(#fff 25%, #000 0 50%, #fff 0 75%, #000 0)",
                      backgroundSize: "12px 12px",
                    }}
                  />
                </div>

                <div className="rounded-2xl border-4 border-yellow-300 bg-black/70 px-4 py-3 text-right text-4xl font-black text-yellow-200 shadow-[4px_4px_0_#ff00aa]">
                  {formatQuizPoints(team.punkte)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function renderEndstandSlide() {
  const topTeams = punktestand.slice(0, 5);
  const maxPunkte = Math.max(...topTeams.map((team) => team.punkte), 1);
  const pferdeFarben = ["#22d3ee", "#fb7185", "#84cc16", "#60a5fa", "#f59e0b"];

  const teamsMitPlatz = topTeams.map((team) => {
    const ersterIndexMitDiesenPunkten = topTeams.findIndex(
      (vergleichsTeam) => vergleichsTeam.punkte === team.punkte
    );

    return {
      ...team,
      platz: ersterIndexMitDiesenPunkten + 1,
    };
  });

  const platzGruppen = Array.from(
    new Set(teamsMitPlatz.map((team) => team.platz))
  ).sort((a, b) => b - a);

  const sichtbarePlaetze = platzGruppen.slice(
    0,
    Math.min(endstandRevealCount, platzGruppen.length)
  );

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] border-4 border-yellow-300 bg-[radial-gradient(circle_at_50%_0%,rgba(250,204,21,0.16),transparent_35%),linear-gradient(180deg,rgba(88,28,135,0.45),rgba(2,6,23,0.92))] p-8 shadow-[8px_8px_0_#ff00aa]">
      <div className="mb-4 inline-flex w-fit rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
        Endstand
      </div>

      <h2 className="mb-5 text-center text-5xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa]">
        Finale Tabelle
      </h2>

      <div className="min-h-0 flex-1 rounded-[1.5rem] border-4 border-cyan-300 bg-black/45 p-4 shadow-[6px_6px_0_#ff00aa]">
        <div className="grid h-full gap-3">
          {teamsMitPlatz.map((team, index) => {
            const prozent = Math.max(8, (team.punkte / maxPunkte) * 100);
            const pferdLinks = `calc(${prozent}% - 5rem)`;
            const istSichtbar = sichtbarePlaetze.includes(team.platz);
            const platz = team.platz;

            const istGewinner =
              team.punkte === topTeams[0].punkte;

            const istTot = !istGewinner;

            return (
              <div
                key={team.teamname}
                className={`grid grid-cols-[90px_1fr_150px] items-center gap-4 transition ${istSichtbar ? "opacity-100" : "opacity-30 blur-sm"
                  }`}
              >
                <div className="flex h-full items-center justify-center rounded-2xl border-4 border-yellow-300 bg-slate-950/80 text-4xl font-black text-yellow-200 shadow-[4px_4px_0_#ff00aa]">
                  #{platz}
                </div>

                <div className="relative h-full min-h-[68px] overflow-visible rounded-2xl border-4 border-cyan-300 bg-slate-950/70 shadow-[4px_4px_0_#ff00aa]">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-r-xl bg-gradient-to-r ${index === 0
                      ? "from-yellow-500/80 to-yellow-300/70"
                      : index === 1
                        ? "from-slate-400/80 to-slate-200/70"
                        : index === 2
                          ? "from-orange-700/80 to-orange-400/70"
                          : "from-cyan-900/80 to-cyan-700/60"
                      }`}
                    style={{
                      width: `${prozent}%`,
                      animation: istSichtbar
                        ? `bahnWachsen 1.2s ease-out ${index * 0.12}s both`
                        : undefined,
                    }}
                  />

                  <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.08)_2px,transparent_2px,transparent_42px)]" />

                  <div className="absolute left-5 top-1/2 z-20 max-w-[45%] -translate-y-1/2 truncate text-2xl font-black text-white drop-shadow-[3px_3px_0_#000]">
                    {istSichtbar ? team.teamname : "???"}
                  </div>

                  {istSichtbar && (
                    <div
                      className={`absolute top-1/2 ${istTot
                        ? "z-30 animate-[pferdEinreitenUndSterben_1.7s_ease-out_both]"
                        : "z-30 animate-[pferdSieger_2.2s_ease-in-out_both]"
                        }`}
                      style={{
                        left: pferdLinks,
                        animationDelay: `${index * 0.12}s`,
                      }}
                    >

                      {renderRennPferd({
                        farbe: pferdeFarben[index % pferdeFarben.length],
                        nummer: index + 1,
                      })}
                    </div>
                  )}

                  <div
                    className="absolute right-3 top-1/2 z-10 h-[82%] w-6 -translate-y-1/2 rounded-sm border-2 border-white shadow-[0_0_18px_#facc15]"
                    style={{
                      backgroundImage:
                        "conic-gradient(#fff 25%, #000 0 50%, #fff 0 75%, #000 0)",
                      backgroundSize: "12px 12px",
                    }}
                  />
                </div>

                <div className="rounded-2xl border-4 border-yellow-300 bg-black/70 px-4 py-3 text-right text-4xl font-black text-yellow-200 shadow-[4px_4px_0_#ff00aa]">
                  {istSichtbar ? formatQuizPoints(team.punkte) : "?"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function renderAufloesungSlide(slide: Extract<Slide, { typ: "aufloesung" }>) {
  const frage = slide.frage;
  const layoutVariant = frage.presentationLayouts.solution.variant;
  const antworten = sortiereAntworten(frage);
  const richtigeAntworten = antworten.filter((antwort) => antwort.ist_richtig);
  const runtime = buildQuestionTemplateRuntimeModel({
    templateId: frage.templateId,
    questionText: frage.frage,
    templateConfig: frage.templateConfig,
    correctAnswers: richtigeAntworten.map((antwort) => ({ text: antwort.antwort })),
  });
  const hatAntwortmoeglichkeiten = antworten.length > 1;
  const richtigeAntwortfeldLoesungen = (frage.antwortfelder ?? []).map((feld) => ({
    label: feld.label,
    loesungen: (feld.loesungen ?? []).filter((loesung) => loesung.ist_akzeptiert),
  }));

  const hatAntwortfelderLoesungen = richtigeAntwortfeldLoesungen.some(
    (feld) => feld.loesungen.length > 0
  );

  if (isPollQuestionTemplateId(frage.templateId)) {
    return (
      <div data-presentation-layout={layoutVariant} className="grid h-full min-h-0 gap-4 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="flex min-h-0 flex-col justify-center rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/80 p-7 shadow-[8px_8px_0_#00e5ff]">
          <div className="text-sm font-black uppercase tracking-[0.3em] text-pink-300">Umfrageergebnis</div>
          <h2 className="mt-4 text-4xl font-black leading-tight text-white xl:text-6xl">{frage.frage}</h2>
          <p className="mt-8 text-xl font-bold text-white/65">{pollState?.finalAnswers ?? 0} von {pollState?.totalTeams ?? 0} Teams abgestimmt</p>
        </div>
        <div className="min-h-0 overflow-hidden rounded-[1.5rem] border-4 border-yellow-300 bg-slate-950/85 p-6 shadow-[8px_8px_0_#ff00aa]">
          {!pollState ? <div className="flex h-full items-center justify-center text-2xl font-black text-white/55">Ergebnisse werden geladen …</div> : pollState.scale ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="text-center text-xl font-bold text-cyan-200">Durchschnitt</div>
              <div className="text-center text-7xl font-black text-yellow-200">{pollState.scale.average?.toLocaleString("de-DE", { maximumFractionDigits: 2 }) ?? "–"}</div>
              <div className="mt-6 grid min-h-0 flex-1 grid-cols-5 items-end gap-3">
                {pollState.scale.values.map((entry) => <div key={entry.value} className="flex h-full min-h-0 flex-col justify-end text-center"><strong className="mb-2 text-white">{entry.count}</strong><div className="min-h-2 rounded-t-xl bg-cyan-300" style={{ height: `${Math.max(6, entry.share)}%` }} /><span className="mt-2 font-black text-white">{entry.value.toLocaleString("de-DE")}</span></div>)}
              </div>
            </div>
          ) : (
            <div className="grid h-full content-center gap-4 overflow-hidden">
              {pollState.options.map((entry) => <div key={entry.id}><div className="mb-1 flex items-end justify-between gap-4 text-white"><strong className="text-xl">{entry.label}</strong><span className="font-black">{entry.count} · {entry.share.toLocaleString("de-DE")} %</span></div><div className="h-8 overflow-hidden rounded-full border-2 border-white/20 bg-black/40"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-pink-400" style={{ width: `${entry.share}%` }} /></div></div>)}
            </div>
          )}
        </div>
      </div>
    );
  }

  const storybookKind = resolveStorybookQuestionKind(frage);
  if (theme.design.stylePreset === "BIRTHDAY" && storybookKind) {
    const imageMedia = frage.medien
      .filter((medium) => isBild(medium.datei))
      .sort((left, right) => left.sortierung - right.sortierung);
    const selectedMedium = storybookKind === "PIXEL_REVEAL"
      ? imageMedia.at(-1)
      : imageMedia[0];
    return (
      <PresentationStorybookSolutionSlide
        question={frage}
        layoutVariant={layoutVariant}
        kind={storybookKind}
        medium={toStorybookMedium(selectedMedium)}
        solutionLines={runtime.solutionLines}
      />
    );
  }

  return (
    <div data-presentation-layout={layoutVariant} className="grid h-full min-h-0 gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="presentation-solution-question flex min-h-0 flex-col rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/80 p-6 shadow-[8px_8px_0_#00e5ff]">
        <div className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-pink-300">
          Frage
        </div>

        <h2 className="text-3xl font-black leading-tight text-white drop-shadow-[3px_3px_0_#ff00aa] xl:text-5xl">
          {frage.frage}
        </h2>

        {frage.quelle && (
          <div className="mt-auto pt-4 text-sm font-bold text-white/50">
            Quelle: {frage.quelle}
          </div>
        )}
      </div>

      <div className="presentation-solution-result flex min-h-0 flex-col rounded-[1.5rem] border-4 border-emerald-300 bg-gradient-to-br from-emerald-950 to-slate-950 p-6 shadow-[8px_8px_0_#facc15]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="inline-flex w-fit rotate-[-2deg] rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black uppercase tracking-[0.25em] text-slate-950 shadow-[4px_4px_0_#ff00aa]">
            {theme.design.stylePreset === "BIRTHDAY" ? "Erinnerung" : "Richtige Antwort"}
          </div>

        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden">
          {hatAntwortmoeglichkeiten && !frage.templateConfig?.templateData &&
            antworten.map((antwort, index) => (
              <div
                key={antwort.antwort_id}
                className={`rounded-3xl border-4 px-6 py-4 text-2xl font-black shadow-[6px_6px_0_#00e5ff] ${antwort.ist_richtig
                  ? "border-emerald-300 bg-emerald-500/25 text-yellow-200"
                  : "border-white/15 bg-black/35 text-white/45"
                  }`}
              >
                <span className="mr-4 text-cyan-300">
                  {String.fromCharCode(65 + index)}.
                </span>
                {antwort.antwort}
              </div>
            ))}

          {frage.templateConfig?.templateData &&
            runtime.solutionLines.map((line, index) => {
              const linkedUrl = line.match(/https:\/\/\S+/)?.[0]?.replace(/\)$/, "") ?? "";
              return (
                <div
                  key={`${index}-${line}`}
                  className="flex min-h-0 items-center rounded-3xl border-4 border-emerald-300 bg-black/45 p-7 shadow-[6px_6px_0_#00e5ff]"
                >
                  <div className="text-4xl font-black leading-tight text-yellow-200 drop-shadow-[4px_4px_0_#16a34a] xl:text-6xl">
                    {linkedUrl ? (
                      <a
                        href={linkedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all underline"
                      >
                        {line}
                      </a>
                    ) : line}
                  </div>
                </div>
              );
            })}

          {!frage.templateConfig?.templateData && !hatAntwortmoeglichkeiten &&
            richtigeAntworten.map((antwort) => (
              <div key={antwort.antwort_id} className="flex min-h-0 items-center rounded-3xl border-4 border-emerald-300 bg-black/45 p-7 shadow-[6px_6px_0_#00e5ff]">
                <div className="text-5xl font-black leading-tight text-yellow-200 drop-shadow-[4px_4px_0_#16a34a] xl:text-7xl">{antwort.antwort}</div>
              </div>
            ))}

          {hatAntwortfelderLoesungen &&
            richtigeAntwortfeldLoesungen.map((feld) => (
              <div
                key={feld.label}
                className="rounded-3xl border-4 border-emerald-300 bg-black/45 p-6 shadow-[6px_6px_0_#00e5ff]"
              >
                <div className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
                  {feld.label}
                </div>

                <div className="text-4xl font-black leading-tight text-yellow-200 drop-shadow-[4px_4px_0_#16a34a] xl:text-6xl">
                  {feld.loesungen.map((loesung) => loesung.loesung_text).join(" / ")}
                </div>
              </div>
            ))}

          {runtime.solutionLines.length === 0 && !hatAntwortfelderLoesungen && (
            <div className="flex flex-1 items-center justify-center text-2xl font-black text-white/50">
              Keine richtige Antwort markiert
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderSchaetzfrageOverlay() {
  return (
    <div className="flex h-full min-h-0 flex-col justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/70 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
      <div className="mx-auto mb-6 inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
        Tie-Breaker
      </div>

      <h2 className="text-6xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa]">
        Schätzfrage
      </h2>

      <div className="mx-auto mt-10 max-w-5xl rounded-3xl border-4 border-cyan-300 bg-slate-950/80 px-8 py-8 text-4xl font-black leading-tight text-white shadow-[6px_6px_0_#ff00aa]">
        {isSchaetzfrageLoading
          ? "Schätzfrage wird geladen..."
          : schaetzfrage?.frage ?? "Keine Schätzfrage gefunden."}
      </div>

      {estimationPhase === "SOLUTION" && (
        <div className="mx-auto mt-6 max-w-4xl rounded-3xl border-4 border-yellow-300 bg-yellow-300 px-8 py-6 text-4xl font-black text-slate-950 shadow-[6px_6px_0_#ff00aa]">
          {schaetzfrage?.richtigeAntwort ?? "Keine Lösung hinterlegt."}
        </div>
      )}
    </div>
  );
}

function createVirtuellenAbschnitt(
  titel: string,
  abschnittTyp: string
): Abschnitt {
  return {
    quiz_abschnitt_id: -1,
    titel,
    abschnitt_typ: abschnittTyp,
    sortierung: 0,
    dauer_sekunden: null,
    qr_code_url: null,
    medien_datei: null,
    bemerkung: null,
  };
}

function renderBekanntmachungenSlide() {
  const bekanntmachungen = (
    praesentationQuiz.outro_bekanntmachungen ??
    "Danke fürs Mitspielen!\nNächster Quizabend: wird noch bekanntgegeben."
  )
    .split("\n")
    .map((zeile) => zeile.trim())
    .filter(Boolean);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] border-4 border-cyan-300 bg-slate-950/90 p-10 shadow-[8px_8px_0_#ff00aa]">
      <div className="mb-8">
        <div className="inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
          Outro
        </div>

        <h2 className="mt-5 text-6xl font-black uppercase leading-none text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa]">
          Bekanntmachungen
        </h2>
      </div>

      <div className="grid flex-1 gap-5">
        {bekanntmachungen.map((punkt, index) => (
          <div
            key={`${punkt}-${index}`}
            className="grid grid-cols-[80px_1fr] items-center gap-6 rounded-3xl border-4 border-cyan-300 bg-black/45 px-8 py-5 shadow-[5px_5px_0_#ff00aa]"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500 text-3xl font-black text-yellow-200">
              {index + 1}
            </div>

            <div className="text-3xl font-black leading-tight text-white">
              {punkt}
            </div>
          </div>
        ))}
      </div>
      {praesentationQuiz.outro_musik_url && (
        <SynchronizedMedia
          kind="audio"
          src={praesentationQuiz.outro_musik_url}
          loop
          command={playbackCommand}
          commandId={playbackCommandId}
          renderMode={renderMode}
        />
      )}
    </div>
  );
}

function renderAnkommenSlide() {
  return (
    <div className="vor-dem-start-player relative h-full min-h-0 w-full overflow-hidden rounded-[1.5rem] bg-black">
      {praesentationQuiz.intro_video_url && (
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-contain"
        >
          <source
            src={praesentationQuiz.intro_video_url}
            type="video/mp4"
          />
        </video>
      )}

      <div className="absolute bottom-8 right-8 z-20 rounded-2xl border-4 border-yellow-300 bg-black/70 px-7 py-4 text-3xl font-black text-yellow-200 shadow-[5px_5px_0_#ff00aa]">
        Beginn: {praesentationQuiz.intro_startzeit ?? "19:30"} Uhr
      </div>
    </div>
  );
}

function renderStartsequenzSlide() {
  return (
    <section className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-[1.5rem] bg-[#050510] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,140,0.2),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(0,245,255,0.18),transparent_40%)]" />
      <div className="relative flex h-full w-full flex-col items-center justify-center rounded-[1.5rem] border-4 border-cyan-400/80 bg-black/50 p-12 text-center shadow-[0_0_45px_rgba(0,240,255,0.9)]">
        <p className="mb-10 max-w-5xl text-5xl font-black leading-tight text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.8)]">
          {praesentationQuiz.intro_startsequenz_text?.trim() ||
            "Ein guter Zeitpunkt, um seine Grundbedürfnisse zu befriedigen."}
        </p>
        <div
          aria-hidden="true"
          className="rounded-3xl border-4 border-pink-500 px-20 py-10 text-[7rem] font-black leading-none text-pink-300 shadow-[0_0_45px_rgba(255,0,150,0.9)]"
        >
          ▶
        </div>
        <SynchronizedMedia
          kind="audio"
          src={
            praesentationQuiz.intro_musik_url?.trim() ||
            "/medien/audio/intro/mexico.mp3"
          }
          command={playbackCommand}
          commandId={playbackCommandId}
          renderMode={renderMode}
        />
      </div>
    </section>
  );
}

function renderFixenSlide(slide: Extract<Slide, { typ: "fixer-slide" }>) {
  if (slide.slideTyp === "vor-dem-start") {
    return renderAnkommenSlide();
  }

  if (slide.slideTyp === "startsequenz") {
    return renderStartsequenzSlide();
  }

  if (slide.slideTyp === "bekanntmachungen") {
    return renderBekanntmachungenSlide();
  }

  if (slide.slideTyp === "begruessung") {
    return renderBlockSlide({
      typ: "block",
      abschnitt: createVirtuellenAbschnitt("Begrüßung", "intro_begruessung"),
    });
  }

  if (slide.slideTyp === "preise") {
    return renderBlockSlide({
      typ: "block",
      abschnitt: createVirtuellenAbschnitt("Preise", "intro_preise"),
    });
  }

  if (slide.slideTyp === "regeln") {
    return renderBlockSlide({
      typ: "block",
      abschnitt: createVirtuellenAbschnitt("Regeln", "intro_regeln"),
    });
  }

  if (slide.slideTyp === "qrcode") {
    return renderBlockSlide({
      typ: "block",
      abschnitt: createVirtuellenAbschnitt("QR-Code", "intro_qrcode"),
    });
  }

  return null;
}

function renderBlockSlide(slide: Extract<Slide, { typ: "block" }>) {
  const abschnitt = slide.abschnitt;

  const zeilen = isQuestionSection(abschnitt)
    ? []
    : abschnitt.bemerkung
        ?.split("\n")
        .map((zeile) => zeile.trim())
        .filter(Boolean) ?? [];

  const regeln =
    quiz.intro_regeln
      ?.split("\n")
      .map((zeile) => zeile.trim())
      .filter(Boolean) ?? [
      "Bildet Teams und gebt euch einen Namen",
      "Scannt den QR-Code",
      "Bestimmt einen Schreiber",
      "Nutzt euren Kopf, nicht das Internet",
      "Der Quizmaster hat immer recht",
    ];

  const preise = parsePrizeSlots(quiz.intro_preise);

  if (abschnitt.abschnitt_typ === "intro_begruessung") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/60 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
        <div className="mb-6 inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
          Willkommen im
        </div>

        <h2 className="text-7xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[6px_6px_0_#ff00aa]">
          {quiz.intro_begruessungstitel ?? quiz.titel}
        </h2>

        <div className="mt-10 max-w-5xl rounded-2xl border-4 border-cyan-300 bg-slate-950/70 px-8 py-5 text-3xl font-black text-white shadow-[5px_5px_0_#ff00aa]">
          {quiz.intro_begruessungstext ??
            "Willkommen zum heutigen Quizabend!"}
        </div>
      </div>
    );
  }

  if (abschnitt.abschnitt_typ === "intro_regeln") {
    return (
      <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] border-4 border-cyan-300 bg-slate-950/90 p-10 shadow-[8px_8px_0_#ff00aa]">
        <div className="mb-8">
          <div className="inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
            Rules are good!
          </div>

          <h2 className="mt-5 text-6xl font-black uppercase leading-none text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa]">
            Rules help
            <br />
            control the fun!*
          </h2>
        </div>

        <div className="grid flex-1 gap-5">
          {regeln.map((regel, index) => (
            <div
              key={`${regel}-${index}`}
              className="grid grid-cols-[80px_1fr] items-center gap-6 rounded-3xl border-4 border-cyan-300 bg-black/45 px-8 py-5 shadow-[5px_5px_0_#ff00aa]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500 text-3xl font-black text-yellow-200">
                {index + 1}
              </div>

              <div className="text-3xl font-black leading-tight text-white">
                {regel}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center text-lg font-bold text-white/50">
          * Monica Geller (schlechte Verliererin)
        </div>
      </div>
    );
  }

  if (abschnitt.abschnitt_typ === "intro_qrcode") {
    return renderQrCodeSlide();
  }

  if (abschnitt.abschnitt_typ === "intro_preise") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/60 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
        <div className="mb-6 inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
          Preise
        </div>

        <h2 className="text-7xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[6px_6px_0_#ff00aa]">
          Heute gibt es was zu gewinnen
        </h2>

        <div className="mt-10 grid gap-4">
          {preise.length > 0 ? (
            preise.map((preis, index) => (
              <div
                key={`${preis}-${index}`}
                className="rounded-2xl border-4 border-cyan-300 bg-slate-950/70 px-8 py-4 text-3xl font-black text-white shadow-[5px_5px_0_#ff00aa]"
              >
                Platz {index + 1}: {preis}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border-4 border-cyan-300 bg-slate-950/70 px-8 py-4 text-3xl font-black text-white shadow-[5px_5px_0_#ff00aa]">
              Die Preise werden gleich live vorgestellt.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (abschnitt.abschnitt_typ === "intro_vor_dem_start") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/60 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
        {praesentationQuiz.intro_logo_url ? (
          <img
            src={praesentationQuiz.intro_logo_url}
            alt="Quiz Logo"
            className="mb-10 max-h-72 max-w-3xl object-contain"
          />
        ) : (
          <div className="mb-10 rounded-3xl border-4 border-cyan-300 bg-slate-950/70 px-12 py-8 text-5xl font-black uppercase text-yellow-200 shadow-[5px_5px_0_#ff00aa]">
            Logo
          </div>
        )}

        <h2 className="text-7xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[6px_6px_0_#ff00aa]">
          Das Quiz startet in Kürze
        </h2>

        {quiz.intro_wartetext && (
          <div className="mt-10 max-w-5xl rounded-2xl border-4 border-cyan-300 bg-slate-950/70 px-8 py-5 text-3xl font-black text-white shadow-[5px_5px_0_#ff00aa]">
            {quiz.intro_wartetext}
          </div>
        )}

        {quiz.intro_musik_url && (
          <SynchronizedMedia
            kind="audio"
            src={quiz.intro_musik_url}
            loop
            command={playbackCommand}
            commandId={playbackCommandId}
            renderMode={renderMode}
          />
        )}
      </div>
    );
  }

  const blockTitel = isQuestionSection(abschnitt)
    ? `Block ${slides
        .filter(
          (item) =>
            item.typ === "block" &&
            isQuestionSection(item.abschnitt)
        )
        .findIndex(
          (item) =>
            item.typ === "block" &&
            item.abschnitt.quiz_abschnitt_id === abschnitt.quiz_abschnitt_id
        ) + 1}`
    : abschnitt.titel;

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/60 p-10 text-center shadow-[8px_8px_0_#ff00aa]">

      <h2 className="text-7xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[6px_6px_0_#ff00aa]">
        {blockTitel}
      </h2>

      {zeilen.length > 0 && (
        <div className="mt-10 grid gap-4">
          {zeilen.map((zeile, index) => (
            <div
              key={`${zeile}-${index}`}
              className="rounded-2xl border-4 border-cyan-300 bg-slate-950/70 px-8 py-4 text-3xl font-black text-white shadow-[5px_5px_0_#ff00aa]"
            >
              {zeile}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderQrCodeSlide() {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/70 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
      <div className="mb-10 inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-8 py-4 text-2xl font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[5px_5px_0_#00e5ff]">
        Jetzt scannen
      </div>

      <div className="rounded-[2rem] border-4 border-cyan-300 bg-white p-8 shadow-[8px_8px_0_#ff00aa]">
        <div className="rounded-[2rem] border-4 border-cyan-300 bg-white p-8 shadow-[8px_8px_0_#ff00aa]">
          <QRCode
            value={answerUrl}
            size={500}
          />
        </div>
      </div>
    </div>
  );
}

function renderPauseSlide(slide: Extract<Slide, { typ: "pause" }>) {

  const dauerSekunden =
    remoteCountdownDauerSekunden ?? slide.dauerSekunden;

  const verstrichen =
    remoteCountdownStartedAt && remoteCountdownStatus === "running"
      ? Math.max(
        0,
        Math.floor(
          (now - new Date(remoteCountdownStartedAt).getTime()) / 1000
        )
      )
      : 0;

  const aktuelleSekunden =
    remoteCountdownStatus === "running"
      ? Math.max(0, dauerSekunden - verstrichen)
      : dauerSekunden;

  const minuten = Math.floor(aktuelleSekunden / 60);
  const sekunden = aktuelleSekunden % 60;


  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/60 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
      <div className="mb-6 inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
        Abgabezeit
      </div>

      <h2 className="text-7xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[6px_6px_0_#ff00aa]">
        Verbleibende Zeit zum Grübeln:
      </h2>

      <div className="mt-10 rounded-3xl border-4 border-cyan-300 bg-slate-950/70 px-10 py-6 shadow-[5px_5px_0_#ff00aa]">
        <div className="text-7xl font-black text-white">
          {String(minuten).padStart(2, "0")}:
          {String(sekunden).padStart(2, "0")}
        </div>
      </div>

      <div className="mt-8 text-2xl font-black uppercase tracking-wide text-white/70">
        Am Ende des Countdowns wird das Formular automatisch gesperrt und abgeschickt.
      </div>
    </div>
  );
}

function renderFlowStandingsSlide(
  slide: Extract<Slide, { typ: "ablauf" }>,
) {
  const { config, type } = slide.element;
  const sorted = [...punktestand].sort((left, right) => right.punkte - left.punkte);
  const limit =
    config.standingsSize === "TOP_3"
      ? 3
      : config.standingsSize === "TOP_5"
        ? 5
        : sorted.length;
  const teams = type === "WINNER"
    ? sorted.filter((team) => team.punkte === sorted[0]?.punkte)
    : sorted.slice(0, limit);
  const placeGroups = Array.from(
    new Set(
      teams.map(
        (team) => sorted.findIndex((candidate) => candidate.punkte === team.punkte) + 1,
      ),
    ),
  ).sort((left, right) => right - left);
  const visiblePlaces = type === "FINAL_STANDINGS"
    ? placeGroups.slice(0, Math.min(endstandRevealCount, placeGroups.length))
    : placeGroups;
  const hidden = config.standingsSize === "HIDDEN";
  const showPoints = config.showPoints !== false;

  return (
    <section className="presentation-flow-slide presentation-flow-ranking" data-flow-type={type}>
      <p className="presentation-flow-kicker">
        {type === "INTERMEDIATE_STANDINGS"
          ? "Zwischenstand"
          : type === "WINNER"
            ? "Gewinner"
            : "Endstand"}
      </p>
      <h2>{config.title ?? (type === "WINNER" ? "Herzlichen Glückwunsch" : "Aktueller Punktestand")}</h2>
      {config.body && <p className="presentation-flow-lead">{config.body}</p>}
      {hidden ? (
        <div className="presentation-flow-message">Der Zwischenstand wird gerade berechnet.</div>
      ) : teams.length === 0 ? (
        <div className="presentation-flow-message">Noch liegen keine Teamwertungen vor.</div>
      ) : (
        <ol className="presentation-flow-ranking-list" data-many={teams.length > 6}>
          {teams.map((team) => {
            const place = sorted.findIndex((candidate) => candidate.punkte === team.punkte) + 1;
            return (
              <li
                key={team.teamname}
                className={visiblePlaces.includes(place) ? "opacity-100" : "opacity-25 blur-sm"}
              >
                <span className="presentation-flow-rank">{type === "WINNER" ? "★" : place}</span>
                <strong>{team.teamname}</strong>
                {showPoints && <span>{formatQuizPoints(team.punkte)} Punkte</span>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function renderFlowPauseSlide(slide: Extract<Slide, { typ: "ablauf" }>) {
  const config = slide.element.config;
  const duration = remoteCountdownDauerSekunden ?? config.durationSeconds ?? 300;
  const elapsed =
    remoteCountdownStartedAt && remoteCountdownStatus === "running"
      ? Math.max(
          0,
          Math.floor((now - new Date(remoteCountdownStartedAt).getTime()) / 1000),
        )
      : 0;
  const remaining = remoteCountdownStatus === "running"
    ? Math.max(0, duration - elapsed)
    : duration;

  return (
    <section className="presentation-flow-slide presentation-flow-pause" data-flow-type={slide.element.type}>
      <p className="presentation-flow-kicker">
        {slide.element.type === "COUNTDOWN" ? "Countdown" : "Pause"}
      </p>
      <h2>{config.title ?? "Kurze Pause"}</h2>
      {config.body && <p className="presentation-flow-lead">{config.body}</p>}
      {config.showCountdown !== false && (
        <div className="presentation-flow-countdown" aria-label={`${remaining} Sekunden verbleibend`}>
          {String(Math.floor(remaining / 60)).padStart(2, "0")}:
          {String(remaining % 60).padStart(2, "0")}
        </div>
      )}
    </section>
  );
}

function renderFlowContentSlide(slide: Extract<Slide, { typ: "ablauf" }>) {
  const { config, type } = slide.element;
  const activeRules = config.rules?.filter((rule) => rule.enabled) ?? [];

  if (type === "WAITING") return renderAnkommenSlide();
  if (type === "START_SEQUENCE") return renderStartsequenzSlide();
  if (type === "PRIZES") {
    return renderFixenSlide({ typ: "fixer-slide", slideTyp: "preise" });
  }
  if (type === "BREAK" || type === "COUNTDOWN") {
    return renderFlowPauseSlide(slide);
  }
  if (
    type === "INTERMEDIATE_STANDINGS" ||
    type === "FINAL_STANDINGS" ||
    type === "WINNER"
  ) {
    return renderFlowStandingsSlide(slide);
  }

  if (type === "IMAGE") {
    return (
      <section className="presentation-flow-slide presentation-flow-editorial presentation-flow-single-image" data-flow-type={type}>
        <div className="presentation-flow-copy">
          <p className="presentation-flow-kicker">Bildmoment</p>
          {config.title && <h2>{config.title}</h2>}
          {config.subtitle && <p className="presentation-flow-subtitle">{config.subtitle}</p>}
        </div>
        <figure className="presentation-flow-hero-figure">
          <img src={config.imageUrl} alt={config.altText ?? ""} />
          {config.caption && <figcaption>{config.caption}</figcaption>}
        </figure>
      </section>
    );
  }

  if (type === "IMAGE_GALLERY" || type === "MEDIA_SEQUENCE") {
    return (
      <section className="presentation-flow-slide presentation-flow-editorial presentation-flow-gallery" data-flow-type={type}>
        <div className="presentation-flow-copy">
          <p className="presentation-flow-kicker">{type === "MEDIA_SEQUENCE" ? "Bildsequenz" : "Bildergalerie"}</p>
          {config.title && <h2>{config.title}</h2>}
          {config.subtitle && <p className="presentation-flow-subtitle">{config.subtitle}</p>}
        </div>
        <div className="presentation-flow-gallery-grid" data-count={config.images?.length ?? 0}>
          {config.images?.map((image, index) => (
            <figure key={image.id}>
              <img src={image.url} alt={image.altText} />
              {image.caption && <figcaption><span>{index + 1}</span>{image.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </section>
    );
  }

  if (type === "TEXT" || type === "ANECDOTE") {
    return (
      <section className="presentation-flow-slide presentation-flow-editorial presentation-flow-text" data-flow-type={type}>
        <p className="presentation-flow-kicker">{type === "ANECDOTE" ? "Anekdote" : "Text"}</p>
        {config.title && <h2>{config.title}</h2>}
        <p className="presentation-flow-editorial-body">{config.body}</p>
      </section>
    );
  }

  if (type === "QUOTE") {
    return (
      <section className="presentation-flow-slide presentation-flow-editorial presentation-flow-quote" data-flow-type={type}>
        <p className="presentation-flow-kicker">Zitat</p>
        <blockquote>„{config.body}“</blockquote>
        {(config.quoteSource || config.yearOrContext) && (
          <p className="presentation-flow-quote-source">
            {[config.quoteSource, config.yearOrContext].filter(Boolean).join(" · ")}
          </p>
        )}
      </section>
    );
  }

  if (type === "PORTRAIT") {
    return (
      <section className="presentation-flow-slide presentation-flow-editorial presentation-flow-portrait" data-flow-type={type}>
        <figure className="presentation-flow-portrait-figure">
          <img src={config.imageUrl} alt={config.altText ?? ""} />
          {config.caption && <figcaption>{config.caption}</figcaption>}
        </figure>
        <div className="presentation-flow-copy">
          <p className="presentation-flow-kicker">Portrait</p>
          <h2>{config.personName}</h2>
          {config.subtitle && <p className="presentation-flow-subtitle">{config.subtitle}</p>}
          {config.description && <p className="presentation-flow-lead">{config.description}</p>}
        </div>
      </section>
    );
  }

  if (type === "AUDIO") {
    return (
      <section className="presentation-flow-slide presentation-flow-editorial presentation-flow-audio" data-flow-type={type}>
        <p className="presentation-flow-kicker">Audiomoment</p>
        <h2>{config.title}</h2>
        {config.description && <p className="presentation-flow-lead">{config.description}</p>}
        <div className="presentation-flow-audio-mark" aria-hidden="true">
          {Array.from({ length: 22 }, (_, index) => <span key={index} />)}
        </div>
        {config.audioUrl && (
          <SynchronizedMedia kind="audio" src={config.audioUrl} command={playbackCommand} commandId={playbackCommandId} renderMode={renderMode} />
        )}
      </section>
    );
  }

  if (type === "VIDEO") {
    return (
      <section className="presentation-flow-slide presentation-flow-editorial presentation-flow-video" data-flow-type={type}>
        <div className="presentation-flow-copy">
          <p className="presentation-flow-kicker">Videomoment</p>
          <h2>{config.title}</h2>
          {config.description && <p className="presentation-flow-lead">{config.description}</p>}
        </div>
        {config.videoUrl && (
          <SynchronizedMedia kind="video" src={config.videoUrl} poster={config.posterImageUrl} command={playbackCommand} commandId={playbackCommandId} renderMode={renderMode} className="presentation-flow-video-player" />
        )}
      </section>
    );
  }

  if (type === "CALENDAR_SUBSCRIPTION") {
    return (
      <section
        className="presentation-flow-slide"
        data-flow-type={type}
      >
        <p className="presentation-flow-kicker">Nächste Termine</p>
        <h2>{config.title ?? "Kein PubQuiz mehr verpassen"}</h2>
        <p className="presentation-flow-lead">
          {config.body ??
            "Scanne den QR-Code und abonniere unsere nächsten öffentlichen PubQuiz-Termine direkt in deinem Kalender."}
        </p>
        <div className="presentation-flow-qr-layout">
          <div className="presentation-flow-qr">
            <QRCode value={calendarUrl} size={400} />
          </div>
          <div>
            <strong>PubQuiz-Termine</strong>
            <p>Ein Kalender für alle öffentlichen ungegoogelt Quizabende.</p>
            <p className="mt-5 break-all text-base opacity-80">{calendarUrl}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="presentation-flow-slide" data-flow-type={type}>
      <p className="presentation-flow-kicker">
        {type === "WELCOME"
          ? "Willkommen"
          : type === "QR_CODE"
            ? "Mitspielen"
            : type === "RULES"
              ? "Gut zu wissen"
              : type === "ROUND_INTRO"
                ? "Nächste Runde"
                : type === "CHAPTER_INTRO"
                  ? "Kapitel"
                : type === "CLOSING"
                  ? "Zum Abschluss"
                  : "Hinweis"}
      </p>
      <h2>{config.title ?? slide.element.label ?? "Quizabend"}</h2>
      {config.subtitle && <p className="presentation-flow-subtitle">{config.subtitle}</p>}
      {config.body && <p className="presentation-flow-lead">{config.body}</p>}

      {type === "QR_CODE" && (
        <div className="presentation-flow-qr-layout">
          <div className="presentation-flow-qr">
            <QRCode value={answerUrl} size={360} />
          </div>
          <div>
            <strong>{answerUrl}</strong>
            {config.teamHint && <p>{config.teamHint}</p>}
            {teamJoinState && <div className="mt-6" aria-live="polite">
              <p className="text-lg font-black uppercase tracking-[0.16em]">Angemeldete Teams · {teamJoinState.totalTeams}</p>
              {teamJoinState.teamNames.length === 0 ? <p className="mt-3 opacity-70">Noch kein Team angemeldet.</p> : <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-3">
                {teamJoinState.teamNames.map((teamName) => <span key={teamName} className="truncate rounded-xl border border-white/25 bg-black/25 px-3 py-2 text-sm font-bold" title={teamName}>{teamName}</span>)}
              </div>}
              {teamJoinState.remainingTeams > 0 && <p className="mt-3 font-black">+ {teamJoinState.remainingTeams} weitere</p>}
            </div>}
          </div>
        </div>
      )}

      {type === "RULES" && (
        <ol className="presentation-flow-rules">
          {activeRules.map((rule, index) => (
            <li key={rule.id}>
              <span>{index + 1}</span>
              <strong>{rule.text}</strong>
            </li>
          ))}
        </ol>
      )}

      {config.imageUrl && (
        <img className="presentation-flow-image" src={config.imageUrl} alt="" />
      )}
      {config.contact && <p className="presentation-flow-contact">{config.contact}</p>}
      {type === "CLOSING" && praesentationQuiz.outro_musik_url && (
        <SynchronizedMedia
          kind="audio"
          src={praesentationQuiz.outro_musik_url}
          loop
          command={playbackCommand}
          commandId={playbackCommandId}
          renderMode={renderMode}
        />
      )}
    </section>
  );
}

function renderAktuellenSlide() {
  if (!slide) {
    return (
      <div className="flex h-full items-center justify-center text-4xl font-black text-white/50">
        Keine Slides vorhanden
      </div>
    );
  }

  if (slide.typ === "ablauf") {
    return renderFlowContentSlide(slide);
  }

  if (slide.typ === "fixer-slide") {
    return renderFixenSlide(slide);
  }

  if (slide.typ === "block") {
    return renderBlockSlide(slide);
  }
  if (slide.typ === "pause") {
    return renderPauseSlide(slide);
  }

  if (slide.typ === "frage") {
    return renderFrageSlide(slide);
  }

  if (slide.typ === "zwischenstand") {
    return renderZwischenstandSlide();
  }

  if (slide.typ === "endstand") {
    return renderEndstandSlide();
  }

  return renderAufloesungSlide(slide);
}

  const overlayMedia = currentSlideMedia;
  const editorialFlowImage = slide?.typ === "ablauf"
    ? slide.element.config.imageUrl ?? slide.element.config.images?.[0]?.url
    : null;
  const selectedPoolImage = slide?.typ === "ablauf" && isSafeTemplateAssetReference(editorialFlowImage)
    ? editorialFlowImage
    : slide && (slide.typ === "frage" || slide.typ === "aufloesung")
    ? selectDeterministicTemplateImage(theme.assets.personalImagePool, {
        quizId: quiz.quiz_id,
        questionId: slide.frage.fragen_id,
        phase: slide.typ === "aufloesung" ? "SOLUTION" : "QUESTION",
        sequenceIndex: slideIndex,
        assetRole: "IMAGE_POOL",
        slideType: slide.typ,
      })
    : theme.assets.heroImage;
  const personalImage = slide?.typ === "aufloesung" && theme.assets.solutionImage
    ? theme.assets.solutionImage
    : selectedPoolImage;
  const collageImages = theme.design.stylePreset === "BIRTHDAY" && personalImage
    ? [personalImage, ...theme.assets.personalImagePool.filter((image) => image !== personalImage)].slice(0, 3)
    : [];
  const storybookPhase = slide?.typ === "aufloesung" ? "SOLUTION" : "QUESTION";
  const storybookQuestionId = slide && (slide.typ === "frage" || slide.typ === "aufloesung")
    ? slide.frage.fragen_id
    : slide?.typ === "ablauf"
      ? (slide.element.persistentId ?? slideIndex)
    : slide?.typ === "block"
      ? slide.abschnitt.quiz_abschnitt_id
      : slideIndex;
  const inferredStorybookContentKind: ResolveStorybookCompositionInput["contentKind"] =
    slide?.typ === "ablauf" && ["WAITING", "START_SEQUENCE", "WELCOME", "WINNER", "CLOSING", "CALENDAR_SUBSCRIPTION"].includes(slide.element.type) ? "COVER"
      : slide?.typ === "ablauf" && ["ROUND_INTRO", "CHAPTER_INTRO"].includes(slide.element.type) ? "CHAPTER"
      : slide?.typ === "ablauf" && slide.element.type === "AUDIO" ? "AUDIO"
      : slide?.typ === "ablauf" && ["IMAGE", "IMAGE_GALLERY", "MEDIA_SEQUENCE", "PORTRAIT", "VIDEO"].includes(slide.element.type) ? "IMAGE"
      : slide?.typ === "fixer-slide" && ["vor-dem-start", "startsequenz", "begruessung"].includes(slide.slideTyp) ? "COVER"
      : slide?.typ === "block" ? "CHAPTER"
      : slide && (slide.typ === "frage" || slide.typ === "aufloesung")
        ? slide.frage.templateId === "musik_rueckwaerts" ? "AUDIO"
          : slide.frage.templateId === "reihenfolge" ? "ORDERING"
            : slide.frage.antworten.length > 1 ? "MULTIPLE_CHOICE"
              : slide.frage.medien.some((medium) => isBild(medium.datei)) ? "IMAGE" : "TEXT"
        : "TEXT";
  const storybookComposition = theme.design.stylePreset === "BIRTHDAY" && theme.design.storybook
    ? resolveStorybookComposition({
        storybook: theme.design.storybook,
        quizId: quiz.quiz_id,
        questionId: storybookQuestionId,
        phase: storybookPhase,
        sequenceIndex: slideIndex,
        slideType: slide?.typ ?? "EMPTY",
        requestedPersonIds: storybookContext?.personIds,
        contentKind: storybookContext?.contentKind ?? inferredStorybookContentKind,
        preferredVariant: storybookContext?.composition,
        preferredAssetRoles: storybookContext?.preferredAssetRoles,
      })
    : null;

  return (
    <QuizThemeScope
      theme={theme}
      className="presentation-template relative flex h-full min-h-0 flex-col text-white"
    >
      <PresentationDesignBackdrop theme={theme} images={collageImages} storybookComposition={storybookComposition} />
      {slideLabel !== "VOR DEM START" && (
        <PresentationDesignHeader
          theme={theme}
          slideLabel={slideLabel}
          slideNumber={slideIndex + 1}
          slideCount={slides.length}
          storybookComposition={storybookComposition}
        />
      )}
      <PresentationDesignStage theme={theme} storybookComposition={storybookComposition}>
        {estimationPhase !== "HIDDEN"
          ? renderSchaetzfrageOverlay()
          : renderAktuellenSlide()}
      </PresentationDesignStage>
      {slide?.typ === "frage" && pixelState?.stopped && (
        <div className="absolute inset-x-8 bottom-12 z-40 rounded-2xl border-4 border-yellow-300 bg-slate-950/95 px-6 py-4 text-center shadow-[6px_6px_0_#ff00aa]">
          <p className="text-2xl font-black text-yellow-200">
            {pixelState.stoppedByTeamName ?? "Ein Team"} hat in Stufe {pixelState.stoppedAtStage} gestoppt
          </p>
          {pixelState.submissionDeadlineAt && (
            <p className="mt-1 text-lg font-bold text-white">
              {pixelState.state === "COUNTDOWN"
                ? `Noch ${resolvePixelCountdownSeconds(pixelState.submissionDeadlineAt, now)} Sekunden f\u00fcr alle anderen Teams`
                : "Antwortzeit beendet"}
            </p>
          )}
        </div>
      )}
      {slide?.typ === "aufloesung" && pixelState?.stopped && pixelState.resolution && (
        <div className="absolute inset-x-8 bottom-12 z-40 rounded-2xl border-4 border-cyan-300 bg-slate-950/95 px-6 py-4 text-center shadow-[6px_6px_0_#ff00aa]">
          <p className="text-xl font-black text-cyan-200">
            {pixelState.stoppedByTeamName} stoppte in Stufe {pixelState.stoppedAtStage}: {pixelState.resolution.answer ?? "Keine Antwort"}
          </p>
          <p className="mt-1 text-2xl font-black text-white">
            {pixelState.resolution.status === "CORRECT" ? "Richtig" : pixelState.resolution.status === "WRONG" ? "Falsch" : "Bewertung offen"}
            {` \u00b7 ${pixelState.resolution.points.replace(".", ",")} Punkte`}
            {pixelState.resolution.outcome === "EXCLUSIVE_BONUS" ? " \u00b7 Einziger Treffer" : pixelState.resolution.outcome === "WRONG_STOP" ? " \u00b7 Stop-Risiko" : ""}
          </p>
        </div>
      )}
      <PresentationDesignFooter theme={theme} storybookComposition={storybookComposition} />
      {mediaOverlayActive && overlayMedia.length > 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-8">
          <div className="grid max-h-full w-full max-w-6xl gap-5 overflow-hidden rounded-[2rem] border-4 border-yellow-300 bg-slate-950 p-8 shadow-[0_0_60px_rgba(255,0,170,0.65)]">
            {overlayMedia.slice(0, 2).map((medium) =>
              renderMedienKarte(medium, "overlay"),
            )}
          </div>
        </div>
      )}
    </QuizThemeScope>
  );
}
