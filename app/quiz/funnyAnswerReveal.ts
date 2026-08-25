import type { TeamAvatarCode } from "@/app/teams/teamProfile";

export const FUNNY_ANSWERS_PER_PAGE = 3;

export type FunnyAnswerEntry = {
  teamAnswerId: number;
  teamId: number;
  teamName: string;
  answerText: string;
  avatarCode: TeamAvatarCode;
  photoUrl: string | null;
};

export function getFunnyAnswerPageCount(answerCount: number) {
  return Math.max(1, Math.ceil(Math.max(0, answerCount) / FUNNY_ANSWERS_PER_PAGE));
}

export function getFunnyAnswerPage(answers: readonly FunnyAnswerEntry[], requestedPage: number) {
  const pageCount = getFunnyAnswerPageCount(answers.length);
  const page = Math.min(Math.max(Math.trunc(requestedPage) || 1, 1), pageCount);
  return {
    page,
    pageCount,
    answers: answers.slice((page - 1) * FUNNY_ANSWERS_PER_PAGE, page * FUNNY_ANSWERS_PER_PAGE),
  };
}
