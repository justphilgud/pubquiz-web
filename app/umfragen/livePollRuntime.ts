import type { QuizInteractionState } from "@/app/generated/prisma/enums";
import type { TeamAvatarCode } from "@/app/teams/teamProfile";
import type { LivePollRuntimeConfig } from "./livePoll";

export type LivePollResponseProjection = {
  id: number;
  teamId: number;
  teamName: string;
  avatarCode: TeamAvatarCode;
  photoUrl: string | null;
  selectedOptionId: string | null;
  originalText: string | null;
  publicText: string | null;
  isVisible: boolean;
  updatedAt: string;
};

export type LivePollAudienceState = {
  revision: string;
  runId: number;
  pollRevisionId: number;
  state: QuizInteractionState;
  type: LivePollRuntimeConfig["type"];
  prompt: string;
  publicationMode: LivePollRuntimeConfig["publicationMode"];
  totalResponses: number;
  options: { id: string; label: string; count: number; share: number }[];
  publicResponses: { id: number; publicText: string; updatedAt: string }[];
};

export type LivePollModerationResponse = LivePollResponseProjection & { changed: boolean };

export function aggregateLivePollState(input: {
  revision: string;
  runId: number;
  state: QuizInteractionState;
  config: LivePollRuntimeConfig;
  responses: readonly LivePollResponseProjection[];
  includeModeration: boolean;
}) {
  const totalResponses = input.responses.filter((response) =>
    input.config.type === "SINGLE_CHOICE"
      ? response.selectedOptionId !== null
      : Boolean(response.originalText?.trim()),
  ).length;
  const options = input.config.options.map((option) => {
    const count = input.responses.filter((response) => response.selectedOptionId === option.id).length;
    return {
      ...option,
      count,
      share: totalResponses === 0 ? 0 : Number(((count / totalResponses) * 100).toFixed(1)),
    };
  });
  const publicResponses = input.config.type === "FREE_TEXT"
    ? input.responses
        .filter((response) => response.isVisible && Boolean(response.publicText?.trim()))
        .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
        .slice(-20)
        .map((response) => ({ id: response.id, publicText: response.publicText!, updatedAt: response.updatedAt }))
    : [];
  const audience: LivePollAudienceState = {
    revision: input.revision,
    runId: input.runId,
    pollRevisionId: input.config.pollRevisionId,
    state: input.state,
    type: input.config.type,
    prompt: input.config.prompt,
    publicationMode: input.config.publicationMode,
    totalResponses,
    options,
    publicResponses,
  };
  return {
    audience,
    moderationResponses: input.includeModeration
      ? input.responses.map((response): LivePollModerationResponse => ({
          ...response,
          changed: Boolean(response.originalText && response.publicText && response.originalText !== response.publicText),
        }))
      : undefined,
  };
}

export function getLivePollPollingDelay(input: { hidden: boolean; consecutiveFailures: number }) {
  const base = input.hidden ? 5_000 : 1_200;
  if (input.consecutiveFailures <= 0) return base;
  return Math.min(15_000, base * 2 ** Math.min(input.consecutiveFailures, 4));
}
