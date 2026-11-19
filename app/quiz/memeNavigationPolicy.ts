import type { Slide } from "./[quizId]/praesentation/buildPraesentationSlides";

export function nextIndexAfterSkippedMeme(slides: readonly Slide[], index: number) {
  const current = slides[index];
  const next = slides[index + 1];
  return index + (current?.typ === "frage" && next?.typ === "aufloesung" &&
    current.frage.quiz_fragen_id === next.frage.quiz_fragen_id ? 2 : 1);
}

/** A completed explicit skip is a terminal review, not an unfinished voting. */
export function mayLeaveMemeQuestion(input: {
  finalizedResult: boolean; reviewState: string | null;
  runState: string | null; selectedCandidates: number;
}): boolean {
  return input.finalizedResult || (input.reviewState === "SKIPPED"
    && (input.runState === "CLOSED" || input.runState === "REVEALED")
    && input.selectedCandidates === 0);
}
