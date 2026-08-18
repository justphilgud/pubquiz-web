export const QUESTION_LIFECYCLE_SOON_DAYS = 30;

export const QUESTION_LIFECYCLE_FILTERS = [
  "ALL",
  "CURRENT",
  "OUTDATED_SOON",
  "OUTDATED",
  "REVIEW_SOON",
  "REVIEW_DUE",
] as const;

export type QuestionLifecycleFilter =
  (typeof QUESTION_LIFECYCLE_FILTERS)[number];

export type QuestionLifecycleMode =
  | "TIMELESS"
  | "OUTDATED_FROM"
  | "REVIEW_FROM";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateInput(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function shiftDateInput(value: string, days: number): string {
  if (!isDateInput(value)) return "";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function validUntilToOutdatedFrom(validUntil: string | null): string | null {
  return validUntil === null ? null : shiftDateInput(validUntil, 1);
}

export function outdatedFromToValidUntil(outdatedFrom: string | null): string | null {
  return outdatedFrom === null ? null : shiftDateInput(outdatedFrom, -1);
}

export function getQuestionLifecycleMode(input: {
  validUntil: string | null;
  reviewFrom: string | null;
}): QuestionLifecycleMode {
  if (input.validUntil !== null) return "OUTDATED_FROM";
  if (input.reviewFrom !== null) return "REVIEW_FROM";
  return "TIMELESS";
}

export function getQuestionLifecycleState(input: {
  validUntil: string | null;
  reviewFrom: string | null;
  today: string;
  soonDays?: number;
}) {
  const soonUntil = shiftDateInput(
    input.today,
    input.soonDays ?? QUESTION_LIFECYCLE_SOON_DAYS,
  );
  const outdatedFrom = validUntilToOutdatedFrom(input.validUntil);
  const isOutdated = outdatedFrom !== null && outdatedFrom <= input.today;
  const isOutdatedSoon =
    outdatedFrom !== null &&
    outdatedFrom > input.today &&
    outdatedFrom <= soonUntil;
  const isReviewDue =
    input.reviewFrom !== null && input.reviewFrom <= input.today;
  const isReviewSoon =
    input.reviewFrom !== null &&
    input.reviewFrom > input.today &&
    input.reviewFrom <= soonUntil;

  return {
    mode: getQuestionLifecycleMode(input),
    outdatedFrom,
    isOutdated,
    isOutdatedSoon,
    isReviewDue,
    isReviewSoon,
    isCurrent: !isOutdated && !isReviewDue,
  };
}

export function isValidNextReviewFrom(
  nextReviewFrom: string | null,
  today: string,
): boolean {
  return nextReviewFrom === null ||
    (isDateInput(nextReviewFrom) && nextReviewFrom > today);
}
