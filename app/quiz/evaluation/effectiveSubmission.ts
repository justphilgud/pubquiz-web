import type { Prisma } from "@/app/generated/prisma/client";

export type EffectiveAnswerContent = {
  answerText: string | null;
  selectedAnswerIds: readonly number[];
  structuredAnswers: ReadonlyMap<number, string | null>;
};

export type EffectiveAnswerSnapshot = EffectiveAnswerContent & {
  source: "SUBMISSION" | "LEGACY";
  interactionRunId: number | null;
  submissionId: number | null;
  submissionVersion: number | null;
  submissionStatus: "SUBMITTED" | "AUTO_FINALIZED" | null;
};

type StoredDraft = {
  antwort_text: string | null;
  antwort_id: number | null;
  antwortauswahlen: readonly { antwort_id: number }[];
  antwortfelder: readonly {
    antwortfeld_id: number;
    antwort_text: string | null;
  }[];
};

type StoredSubmission = {
  team_answer_submission_id: number;
  interaction_run_id: number;
  submission_version: number;
  status: "SUBMITTED" | "AUTO_FINALIZED";
  interaction_type: string;
  payload: Prisma.JsonValue;
};

export type EffectiveSubmissionInput = {
  interactionRunId: number | null;
  draft: StoredDraft;
  submissions: readonly StoredSubmission[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readStringProperty(
  payload: Prisma.JsonValue,
  property: string,
): string {
  if (!isRecord(payload) || typeof payload[property] !== "string") {
    throw new Error("Der finale Submission-Snapshot ist ungültig.");
  }
  return payload[property];
}

function contentFromSubmission(
  submission: StoredSubmission,
): EffectiveAnswerContent {
  const { interaction_type: interactionType, payload } = submission;

  if (interactionType === "TEXT") {
    return {
      answerText: readStringProperty(payload, "text"),
      selectedAnswerIds: [],
      structuredAnswers: new Map(),
    };
  }
  if (interactionType === "NUMBER") {
    return {
      answerText: readStringProperty(payload, "value"),
      selectedAnswerIds: [],
      structuredAnswers: new Map(),
    };
  }
  if (interactionType === "STRUCTURED_TEXT") {
    if (!isRecord(payload) || !isRecord(payload.fields)) {
      throw new Error("Der finale Submission-Snapshot ist ungültig.");
    }
    const fields = Object.entries(payload.fields).map(([fieldId, value]) => {
      const parsedFieldId = Number(fieldId);
      if (!Number.isInteger(parsedFieldId) || typeof value !== "string") {
        throw new Error("Der finale Submission-Snapshot ist ungültig.");
      }
      return [parsedFieldId, value] as const;
    });
    return {
      answerText: null,
      selectedAnswerIds: [],
      structuredAnswers: new Map(fields),
    };
  }
  if (interactionType === "SINGLE_CHOICE") {
    if (
      !isRecord(payload) ||
      (payload.optionId !== null && !Number.isInteger(payload.optionId))
    ) {
      throw new Error("Der finale Submission-Snapshot ist ungültig.");
    }
    const optionId = payload.optionId as number | null;
    return {
      answerText: null,
      selectedAnswerIds: optionId === null ? [] : [optionId],
      structuredAnswers: new Map(),
    };
  }
  if (interactionType === "MULTI_CHOICE") {
    if (
      !isRecord(payload) ||
      !Array.isArray(payload.optionIds) ||
      !payload.optionIds.every(Number.isInteger) ||
      new Set(payload.optionIds).size !== payload.optionIds.length
    ) {
      throw new Error("Der finale Submission-Snapshot ist ungültig.");
    }
    return {
      answerText: null,
      selectedAnswerIds: payload.optionIds as number[],
      structuredAnswers: new Map(),
    };
  }
  if (interactionType === "ORDER") {
    if (
      !isRecord(payload) ||
      !Array.isArray(payload.itemIds) ||
      !payload.itemIds.every((item) => typeof item === "string") ||
      new Set(payload.itemIds).size !== payload.itemIds.length
    ) {
      throw new Error("Der finale Submission-Snapshot ist ungültig.");
    }
    return {
      answerText: JSON.stringify(payload.itemIds),
      selectedAnswerIds: [],
      structuredAnswers: new Map(),
    };
  }

  throw new Error(`Nicht unterstützter Submission-Typ: ${interactionType}`);
}

function legacyAnswerSnapshot(draft: StoredDraft): EffectiveAnswerSnapshot {
  return {
    source: "LEGACY",
    interactionRunId: null,
    submissionId: null,
    submissionVersion: null,
    submissionStatus: null,
    answerText: draft.antwort_text,
    selectedAnswerIds:
      draft.antwortauswahlen.length > 0
        ? draft.antwortauswahlen.map((selection) => selection.antwort_id)
        : draft.antwort_id === null
          ? []
          : [draft.antwort_id],
    structuredAnswers: new Map(
      draft.antwortfelder.map((field) => [
        field.antwortfeld_id,
        field.antwort_text,
      ]),
    ),
  };
}

export function resolveEffectiveSubmission(
  input: EffectiveSubmissionInput,
): EffectiveAnswerSnapshot | null {
  if (input.interactionRunId === null) {
    return legacyAnswerSnapshot(input.draft);
  }

  const submission = input.submissions
    .filter((candidate) => candidate.interaction_run_id === input.interactionRunId)
    .reduce<StoredSubmission | null>((latest, candidate) => {
      if (!latest) return candidate;
      if (candidate.submission_version !== latest.submission_version) {
        return candidate.submission_version > latest.submission_version
          ? candidate
          : latest;
      }
      return candidate.team_answer_submission_id >
        latest.team_answer_submission_id
        ? candidate
        : latest;
    }, null);

  if (!submission) return null;

  return {
    source: "SUBMISSION",
    interactionRunId: submission.interaction_run_id,
    submissionId: submission.team_answer_submission_id,
    submissionVersion: submission.submission_version,
    submissionStatus: submission.status,
    ...contentFromSubmission(submission),
  };
}
