const resubmittableInteractionTypes = new Set([
  "TEXT",
  "STRUCTURED_TEXT",
  "NUMBER",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "ORDER",
]);

export type InteractionSubmissionPolicy = {
  resubmissionAllowedWhileOpen: boolean;
};

export function resolveInteractionSubmissionPolicy(
  interactionType: string,
): InteractionSubmissionPolicy {
  return {
    resubmissionAllowedWhileOpen:
      resubmittableInteractionTypes.has(interactionType),
  };
}

export function isDraftChangedSinceSubmission(
  draftRevision: number,
  submittedDraftRevision: number | null,
) {
  return (
    submittedDraftRevision !== null && draftRevision > submittedDraftRevision
  );
}

export function shouldAutoFinalizeDraft(input: {
  hasExplicitSubmission: boolean;
  hasContent: boolean;
}) {
  return !input.hasExplicitSubmission && input.hasContent;
}

export function planSubmissionVersion(
  submissions: readonly {
    submissionVersion: number;
    draftRevision: number;
  }[],
  draftRevision: number,
) {
  const existing = submissions.find(
    (submission) => submission.draftRevision === draftRevision,
  );
  if (existing) {
    return { kind: "IDEMPOTENT", submission: existing } as const;
  }
  return {
    kind: "CREATE",
    submissionVersion:
      submissions.reduce(
        (highest, submission) =>
          Math.max(highest, submission.submissionVersion),
        0,
      ) + 1,
  } as const;
}
