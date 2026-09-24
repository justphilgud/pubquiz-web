import { randomInt } from "node:crypto";

import {
  parseMemeCaptionPayload,
  hasMemeCaptionContent,
  type MemeCaptionPayload,
} from "@/app/quiz/memeCaption";

export type MemeReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";
export type MemeSelectionState = "REVIEWING" | "COMPLETED" | "SKIPPED";

export type StoredMemeSubmission = {
  team_answer_submission_id: number;
  interaction_run_id: number;
  quiz_team_session_id: number;
  submission_version: number;
  status: "SUBMITTED" | "AUTO_FINALIZED";
  interaction_type: string;
  payload: unknown;
};

export type ValidMemeSubmission = StoredMemeSubmission & {
  payload: MemeCaptionPayload;
};

export type MemeSelectionPlan = {
  validSubmissionCount: number;
  selected: ValidMemeSubmission[];
};

export type RandomIndex = (upperExclusive: number) => number;

export function collectValidMemeSubmissions(
  interactionRunId: number,
  submissions: readonly StoredMemeSubmission[],
): ValidMemeSubmission[] {
  const latestByTeam = new Map<number, ValidMemeSubmission>();

  for (const submission of submissions) {
    if (
      submission.interaction_run_id !== interactionRunId ||
      submission.interaction_type !== "MEME_CAPTION" ||
      (submission.status !== "SUBMITTED" &&
        submission.status !== "AUTO_FINALIZED")
    ) {
      continue;
    }
    const payload = parseMemeCaptionPayload(submission.payload);
    if (!payload || !hasMemeCaptionContent(payload)) continue;

    const candidate = { ...submission, payload };
    const current = latestByTeam.get(submission.quiz_team_session_id);
    if (
      !current ||
      candidate.submission_version > current.submission_version ||
      (candidate.submission_version === current.submission_version &&
        candidate.team_answer_submission_id >
          current.team_answer_submission_id)
    ) {
      latestByTeam.set(submission.quiz_team_session_id, candidate);
    }
  }

  return [...latestByTeam.values()].sort(
    (left, right) =>
      left.team_answer_submission_id - right.team_answer_submission_id,
  );
}

function defaultRandomIndex(upperExclusive: number) {
  return randomInt(upperExclusive);
}

export function createMemeSelectionPlan(
  validSubmissions: readonly ValidMemeSubmission[],
  maxPresentedMemes: number | null,
  randomIndex: RandomIndex = defaultRandomIndex,
): MemeSelectionPlan {
  const shuffled = [...validSubmissions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    if (
      !Number.isSafeInteger(swapIndex) ||
      swapIndex < 0 ||
      swapIndex > index
    ) {
      throw new Error("Die Zufallsquelle hat einen ungültigen Index geliefert.");
    }
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  const selected =
    maxPresentedMemes === null
      ? shuffled
      : shuffled.slice(0, Math.min(maxPresentedMemes, shuffled.length));
  return { validSubmissionCount: validSubmissions.length, selected };
}

export function validateMemeReviewCompletion(input: {
  candidateStatuses: readonly MemeReviewStatus[];
}) {
  if (input.candidateStatuses.length === 0) {
    return { ok: true as const, nextState: "SKIPPED" as const };
  }
  if (input.candidateStatuses.includes("PENDING_REVIEW")) {
    return {
      ok: false as const,
      reason: "PENDING_CANDIDATES" as const,
      message: "Bitte alle ausgewählten Memes freigeben oder ausschließen.",
    };
  }
  if (!input.candidateStatuses.includes("APPROVED")) {
    return {
      ok: false as const,
      reason: "NO_APPROVED_CANDIDATES" as const,
      message:
        "Keine Meme-Einreichung wurde für die Präsentation freigegeben. Bitte den Review anpassen.",
    };
  }
  return { ok: true as const, nextState: "COMPLETED" as const };
}
