import type { Slide } from "../../praesentation/buildPraesentationSlides";
import { getQuizFlowTypeLabel } from "@/app/quiz/flow/quizFlow";

function getSlideTitel(slide: Slide | undefined) {
  if (!slide) return "Kein Slide";

  if (slide.typ === "ablauf") return slide.element.config.title?.trim() || slide.element.label?.trim() || getQuizFlowTypeLabel(slide.element.type);
  if (slide.typ === "pixel-erklaerung") return "Pixelbild · Spielregeln";
  if (slide.typ === "meme-erklaerung") return "Meme-Runde · Erklärung";
  if (slide.typ === "fixer-slide") return ({ "vor-dem-start": "Vor dem Start", startsequenz: "Startsequenz", begruessung: "Begrüßung", preise: "Preise", regeln: "Regeln", qrcode: "QR-Code", bekanntmachungen: "Bekanntmachungen" })[slide.slideTyp];
  if (slide.typ === "block") return slide.abschnitt.titel;
  if (slide.typ === "frage") return slide.frage.frage ?? "Frage";
  if (slide.typ === "funny") return `Falsch aber lustig: ${slide.frage.frage ?? "Frage"}`;
  if (slide.typ === "aufloesung")
    return `Auflösung: ${slide.frage.frage ?? "Frage"}`;
  if (slide.typ === "pause") return "Countdown";
  if (slide.typ === "zwischenstand") return "Zwischenstand";
  if (slide.typ === "endstand") return "Endstand";

  return "Slide";
}

function getSlideTypLabel(slide: Slide | undefined) {
  if (!slide) return "—";
  if (slide.typ === "ablauf") return getQuizFlowTypeLabel(slide.element.type);

  if (slide.typ === "frage") return "Frage";
  if (slide.typ === "funny") return "Funny";
  if (slide.typ === "aufloesung") return "Auflösung";
  if (slide.typ === "pause") return "Pause";
  if (slide.typ === "block") return "Block";
  if (slide.typ === "fixer-slide") return "Fix";
  if (slide.typ === "zwischenstand") return "Zwischenstand";
  if (slide.typ === "endstand") return "Endstand";

  return "Slide";
}

type Props = {
  title?: string;
  slide: Slide | undefined;
};

export default function PresentationPreview({
  title = "Nächste Folie",
  slide,
}: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>

        <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-300">
          {getSlideTypLabel(slide)}
        </span>
      </div>

      <div className="h-28 overflow-hidden rounded-xl border border-zinc-800 bg-black p-3">
        <p
          className="overflow-hidden text-sm font-semibold leading-snug text-zinc-300"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 4,
          }}
        >
          {getSlideTitel(slide)}
        </p>
      </div>
    </div>
  );
}
