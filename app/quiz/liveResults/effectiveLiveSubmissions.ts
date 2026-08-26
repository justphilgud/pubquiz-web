export type StoredLiveSubmission = {
  team_answer_submission_id: number;
  interaction_run_id: number;
  submission_version: number;
};

export type StoredLiveAnswer<TSubmission extends StoredLiveSubmission> = {
  interaction_run_id: number | null;
  quiz_team_session_id: number;
  submissions: readonly TSubmission[];
};

export function selectEffectiveLiveSubmissions<
  TSubmission extends StoredLiveSubmission,
>(input: {
  interactionRunId: number;
  answers: readonly StoredLiveAnswer<TSubmission>[];
}): TSubmission[] {
  const effectiveByTeam = new Map<number, TSubmission>();

  for (const answer of input.answers) {
    if (answer.interaction_run_id !== input.interactionRunId) continue;

    const latest = answer.submissions
      .filter(
        (submission) =>
          submission.interaction_run_id === input.interactionRunId,
      )
      .reduce<TSubmission | null>((current, submission) => {
        if (!current) return submission;
        if (submission.submission_version !== current.submission_version) {
          return submission.submission_version > current.submission_version
            ? submission
            : current;
        }
        return submission.team_answer_submission_id >
          current.team_answer_submission_id
          ? submission
          : current;
      }, null);

    if (latest) effectiveByTeam.set(answer.quiz_team_session_id, latest);
  }

  return [...effectiveByTeam.values()];
}
