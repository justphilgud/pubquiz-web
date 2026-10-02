export type ParticipantAnswerSequenceSourceItem =
  | { kind: "QUESTION"; questionAssignmentId: number }
  | { kind: "LIVE_POLL"; placementId: number };

export type ParticipantAnswerSequenceItem =
  | { kind: "QUESTION"; questionAssignmentId: number }
  | { kind: "LIVE_POLL"; runId: number };

export function buildParticipantAnswerSequence(input: {
  canonicalItems: readonly ParticipantAnswerSequenceSourceItem[];
  visibleQuestionIds: readonly number[];
  releasedPolls: readonly {
    runId: number;
    placementId: number;
    openedAt: Date | string | null;
  }[];
}) {
  const visibleQuestionIds = new Set(input.visibleQuestionIds);
  const pollByPlacementId = new Map(
    input.releasedPolls.map((poll) => [poll.placementId, poll]),
  );
  const includedQuestions = new Set<number>();
  const includedPolls = new Set<number>();
  const sequence: ParticipantAnswerSequenceItem[] = [];

  for (const item of input.canonicalItems) {
    if (item.kind === "QUESTION") {
      if (
        visibleQuestionIds.has(item.questionAssignmentId) &&
        !includedQuestions.has(item.questionAssignmentId)
      ) {
        includedQuestions.add(item.questionAssignmentId);
        sequence.push(item);
      }
      continue;
    }

    const poll = pollByPlacementId.get(item.placementId);
    if (poll && !includedPolls.has(poll.runId)) {
      includedPolls.add(poll.runId);
      sequence.push({ kind: "LIVE_POLL", runId: poll.runId });
    }
  }

  for (const questionAssignmentId of input.visibleQuestionIds) {
    if (!includedQuestions.has(questionAssignmentId)) {
      includedQuestions.add(questionAssignmentId);
      sequence.push({ kind: "QUESTION", questionAssignmentId });
    }
  }

  const missingPolls = input.releasedPolls
    .filter((poll) => !includedPolls.has(poll.runId))
    .sort(
      (left, right) =>
        new Date(left.openedAt ?? 0).getTime() -
          new Date(right.openedAt ?? 0).getTime() ||
        left.runId - right.runId,
    );
  for (const poll of missingPolls) {
    sequence.push({ kind: "LIVE_POLL", runId: poll.runId });
  }

  return sequence;
}
