type QuizBlockReleaseRevisionInput = {
  quiz_block_freigabe_id: number;
  quiz_abschnitt_id: number;
  ist_freigegeben: boolean;
  ist_geschlossen: boolean;
  aktuelle_quiz_fragen_id: number | null;
  freigegeben_ab: Date | null;
  geschlossen_ab: Date | null;
};

export function parseQuizBlockPreviewSectionId(slideKey: string) {
  const match = /^section:(\d+):intro$/.exec(slideKey);
  if (!match) return null;
  const sectionId = Number(match[1]);
  return Number.isSafeInteger(sectionId) && sectionId > 0 ? sectionId : null;
}

export function serializeQuizBlockReleaseRevision(
  release: QuizBlockReleaseRevisionInput | null | undefined,
) {
  if (!release) return "block:none";
  return [
    "block",
    release.quiz_block_freigabe_id,
    release.quiz_abschnitt_id,
    release.ist_freigegeben ? 1 : 0,
    release.ist_geschlossen ? 1 : 0,
    release.aktuelle_quiz_fragen_id ?? 0,
    release.freigegeben_ab?.getTime() ?? 0,
    release.geschlossen_ab?.getTime() ?? 0,
  ].join(":");
}

export function isQuizQuestionBlockOpen(
  release: {
    ist_freigegeben: boolean;
    ist_geschlossen: boolean;
  } | null | undefined,
) {
  return Boolean(release?.ist_freigegeben && !release.ist_geschlossen);
}

export function serializeQuizParticipantLiveRevision(
  release: QuizBlockReleaseRevisionInput | null | undefined,
  run: {
    interaction_run_id: number;
    state: string;
    revision: number;
  } | null | undefined,
) {
  return [
    serializeQuizBlockReleaseRevision(release),
    "run",
    run?.interaction_run_id ?? 0,
    run?.state ?? "LOCKED",
    run?.revision ?? 0,
  ].join(":");
}
