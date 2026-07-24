"use client";

import Image from "next/image";
import type { QuizPraesentationResult } from "../../../actions";
import type { Slide } from "../../praesentation/buildPraesentationSlides";
import { buildQuestionTemplateRuntimeModel } from "@/app/fragen/editor/templates/questionTemplateRuntime";

type PunktestandEintrag = {
  teamname: string;
  punkte: number;
};

type Props = {
  slide: Slide | undefined;
  slides: Slide[];
  countdownRestSekunden: number;
  punktestand: PunktestandEintrag[];
  endstandRevealCount: number;
  preiseText?: string | null;
};

function istFragenblockTyp(abschnittTyp: string | null | undefined) {
  return abschnittTyp === "fragenrunde" || abschnittTyp === "fragenblock";
}

function formatSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "--:--";
  }

  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(rest).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function getAbschnittAnzeigeTitel(
  abschnitt: QuizPraesentationResult["abschnitte"][number] | null | undefined,
  slides?: Slide[],
) {
  if (!abschnitt) return "Kein Block";

  if (!istFragenblockTyp(abschnitt.abschnitt_typ)) {
    return abschnitt.titel;
  }

  if (!slides) return abschnitt.titel;

  const blockIndex = slides
    .filter(
      (slide) =>
        slide.typ === "block" &&
        istFragenblockTyp(slide.abschnitt.abschnitt_typ),
    )
    .findIndex(
      (slide) =>
        slide.typ === "block" &&
        slide.abschnitt.quiz_abschnitt_id === abschnitt.quiz_abschnitt_id,
    );

  return blockIndex >= 0 ? `Block ${blockIndex + 1}` : abschnitt.titel;
}

export function getSlideTitel(slide: Slide | undefined, slides?: Slide[]) {
  if (!slide) return "Kein Slide";

  if (slide.typ === "fixer-slide") {
    if (slide.slideTyp === "vor-dem-start") return "Vor dem Start";
    if (slide.slideTyp === "startsequenz") return "Startsequenz";
    if (slide.slideTyp === "begruessung") return "Begrüßung";
    if (slide.slideTyp === "preise") return "Preise";
    if (slide.slideTyp === "regeln") return "Regeln";
    if (slide.slideTyp === "qrcode") return "QR-Code";
    if (slide.slideTyp === "bekanntmachungen") return "Bekanntmachungen";

    return slide.slideTyp;
  }

  if (slide.typ === "block") {
    return getAbschnittAnzeigeTitel(slide.abschnitt, slides);
  }

  if (slide.typ === "frage") {
    return slide.frage.frage ?? "Frage";
  }

  if (slide.typ === "aufloesung") {
    return `Auflösung: ${slide.frage.frage ?? "Frage"}`;
  }

  if (slide.typ === "pause") {
    return `Countdown: ${getAbschnittAnzeigeTitel(slide.abschnitt, slides)}`;
  }

  if (slide.typ === "zwischenstand") return "Zwischenstand";
  if (slide.typ === "endstand") return "Endstand";

  return "Slide";
}

export default function SlidePreview({
  slide,
  slides,
  countdownRestSekunden,
  punktestand,
  endstandRevealCount,
  preiseText,
}: Props) {
  if (!slide) {
    return <div className="text-zinc-500">Kein Slide vorhanden</div>;
  }

  function renderPunktestandPreview({
    anonym,
    titel,
    istEndstand,
  }: {
    anonym: boolean;
    titel: string;
    istEndstand: boolean;
  }) {
    const topTeams = [...punktestand]
      .sort((a, b) => b.punkte - a.punkte)
      .slice(0, 5);

    const teamsMitPlatz = topTeams.map((team) => {
      const ersterIndex = topTeams.findIndex(
        (vergleich) => vergleich.punkte === team.punkte,
      );

      return {
        ...team,
        platz: ersterIndex + 1,
      };
    });

    const platzGruppen = Array.from(
      new Set(teamsMitPlatz.map((team) => team.platz)),
    ).sort((a, b) => b - a);

    const sichtbarePlaetze = istEndstand
      ? platzGruppen.slice(
          0,
          Math.min(endstandRevealCount, platzGruppen.length),
        )
      : platzGruppen;

    const naechsterPlatz = istEndstand
      ? (platzGruppen[endstandRevealCount] ?? null)
      : null;

    return (
      <div className="grid h-full min-h-360px grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)] gap-5">
        <div className="rounded-2xl border border-zinc-700 bg-zinc-950 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm uppercase tracking-[0.25em] text-yellow-300">
                {titel}
              </div>

              {istEndstand && (
                <div className="mt-1 text-xs text-zinc-400">
                  Sichtbar:{" "}
                  <span className="font-bold text-yellow-300">
                    {sichtbarePlaetze
                      .map((platz) => `Platz ${platz}`)
                      .join(", ")}
                  </span>
                  {naechsterPlatz && (
                    <>
                      {" "}
                      · Nächster Klick:{" "}
                      <span className="font-bold text-cyan-300">
                        Platz {naechsterPlatz}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800">
            {teamsMitPlatz.map((team, index) => {
              const istSichtbar = sichtbarePlaetze.includes(team.platz);
              const name = anonym ? `Team ${index + 1}` : team.teamname;

              return (
                <div
                  key={`${team.teamname}-${index}`}
                  className={`grid grid-cols-[80px_1fr_110px] items-center gap-3 border-b border-zinc-800 px-4 py-3 last:border-b-0 ${
                    istSichtbar
                      ? "bg-yellow-400/10 text-white"
                      : "bg-black/30 text-zinc-600"
                  }`}
                >
                  <div className="text-xl font-black">#{team.platz}</div>

                  <div className="truncate text-lg font-bold">
                    {istSichtbar ? name : "???"}
                  </div>

                  <div className="text-right text-xl font-black">
                    {istSichtbar ? team.punkte.toFixed(1) : "?"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-700 bg-zinc-950 p-5">
          <h3 className="mb-4 text-xl font-black">Preise</h3>

          {preiseText ? (
            <div className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">
              {preiseText}
            </div>
          ) : (
            <div className="text-sm text-zinc-500">
              Keine Preise hinterlegt.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (slide.typ === "fixer-slide") {
    return (
      <div className="flex h-full min-h-300px items-center justify-center text-center">
        <div>
          <div className="mb-4 text-sm uppercase tracking-[0.3em] text-cyan-300">
            Fixer Slide
          </div>

          <div className="text-5xl font-black">
            {getSlideTitel(slide, slides)}
          </div>
        </div>
      </div>
    );
  }

  if (slide.typ === "block") {
    return (
      <div className="flex h-full min-h-300px items-center justify-center text-center">
        <div>
          <div className="mb-4 text-sm uppercase tracking-[0.3em] text-pink-300">
            Block
          </div>

          <div className="text-5xl font-black">
            {getAbschnittAnzeigeTitel(slide.abschnitt, slides)}
          </div>
        </div>
      </div>
    );
  }

  if (slide.typ === "frage") {
    const bildMedien = slide.frage.medien.filter((medium) =>
      medium.medientyp.toLowerCase().includes("bild"),
    );

    return (
      <div className="flex h-full min-h-360px flex-col justify-center">
        <div className="mb-4 text-sm uppercase tracking-[0.3em] text-cyan-300">
          Frage {slide.frageIndexImBlock} / {slide.fragenAnzahlImBlock}
        </div>

        <div className="grid items-center gap-8 md:grid-cols-[1.2fr_0.8fr]">
          <div className="text-4xl font-black leading-tight">
            {slide.frage.frage}
          </div>

          {bildMedien.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950">
              <Image
                src={bildMedien[0].datei}
                alt=""
                width={800}
                height={600}
                unoptimized
                className="max-h-320px w-full object-contain"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (slide.typ === "aufloesung") {
    const richtigeAntworten = slide.frage.antworten
      .filter((antwort) => antwort.ist_richtig)
      .map((antwort) => antwort.antwort);
    const runtime = buildQuestionTemplateRuntimeModel({
      templateId: slide.frage.templateId,
      questionText: slide.frage.frage,
      templateConfig: slide.frage.templateConfig,
      correctAnswers: richtigeAntworten.map((text) => ({ text })),
    });

    return (
      <div>
        <div className="mb-4 text-sm uppercase tracking-[0.3em] text-emerald-300">
          Auflösung
        </div>

        <div className="mb-8 text-3xl font-black leading-tight">
          {slide.frage.frage}
        </div>

        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-5 text-2xl font-bold text-emerald-100">
          {runtime.solutionLines.length > 0
            ? runtime.solutionLines.join(" / ")
            : "Keine Antwort hinterlegt"}
        </div>
      </div>
    );
  }

  if (slide.typ === "pause") {
    return (
      <div className="flex h-full min-h-300px items-center justify-center text-center">
        <div>
          <div className="mb-4 text-sm uppercase tracking-[0.3em] text-yellow-300">
            Antwortzeit
          </div>

          <div className="text-6xl font-black">
            {formatSeconds(countdownRestSekunden)}
          </div>
        </div>
      </div>
    );
  }

  if (slide.typ === "zwischenstand") {
    return renderPunktestandPreview({
      anonym: true,
      titel: "Anonymer Zwischenstand",
      istEndstand: false,
    });
  }

  if (slide.typ === "endstand") {
    return renderPunktestandPreview({
      anonym: false,
      titel: "Finale Tabelle",
      istEndstand: true,
    });
  }

  return <div className="text-zinc-500">Unbekannter Slide</div>;
}
