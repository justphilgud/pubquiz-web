import type { QuizInteractionState } from "@/app/quiz/interaction/interactionStateMachine";
import { sanitizePublicLiveText, type PublicTextReplacementRule } from "./publicTextSanitizer";
import type { TeamAvatarCode } from "@/app/teams/teamProfile";

export type LiveTextSubmission = {
  submissionId: number;
  teamId: number;
  teamName: string;
  avatarCode: TeamAvatarCode;
  photoUrl: string | null;
  originalText: string;
  isVisible: boolean;
};

export type LiveTextModerationResponse = {
  responseKey: string;
  submissionId: number | null;
  teamId: number;
  teamName: string;
  avatarCode: TeamAvatarCode;
  photoUrl: string | null;
  originalText: string;
  isVisible: boolean;
  status: "DRAFT" | "FINAL";
};

export type LiveTextResultState = {
  kind: "TEXT";
  visible: boolean;
  state: QuizInteractionState;
  finalAnswers: number;
  totalTeams: number;
  publicResponses: Array<{ submissionId: number; publicText: string }>;
  moderationResponses?: Array<{
    responseKey: string;
    submissionId: number | null;
    teamId: number;
    teamName: string;
    avatarCode: TeamAvatarCode;
    photoUrl: string | null;
    originalText: string;
    publicText: string;
    changed: boolean;
    isVisible: boolean;
    status: "DRAFT" | "FINAL";
  }>;
};

export function aggregateLiveTextResults(input: {
  visible: boolean;
  state: QuizInteractionState;
  totalTeams: number;
  submissions: readonly LiveTextSubmission[];
  moderationResponses?: readonly LiveTextModerationResponse[];
  rules: readonly PublicTextReplacementRule[];
  includeModeration: boolean;
}): LiveTextResultState {
  const mapped = input.submissions.map((submission) => {
    const sanitized = sanitizePublicLiveText(submission.originalText, input.rules);
    return { ...submission, publicText: sanitized.publicText, changed: sanitized.changed };
  });
  const moderationSource = input.moderationResponses ?? input.submissions.map((submission) => ({
    ...submission,
    responseKey: `submission:${submission.submissionId}`,
    status: "FINAL" as const,
  }));
  const moderationMapped = moderationSource.map((response) => {
    const sanitized = sanitizePublicLiveText(response.originalText, input.rules);
    return { ...response, publicText: sanitized.publicText, changed: sanitized.changed };
  });
  return {
    kind: "TEXT",
    visible: input.visible,
    state: input.state,
    finalAnswers: input.submissions.length,
    totalTeams: input.totalTeams,
    publicResponses: mapped.filter((entry) => entry.isVisible).map(({ submissionId, publicText }) => ({ submissionId, publicText })),
    ...(input.includeModeration ? { moderationResponses: moderationMapped } : {}),
  };
}
