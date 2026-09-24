export const MEME_OVERVIEW_PAGE_SIZE = 4;

export type MemePresentationPhase =
  | "PRESENTING"
  | "OVERVIEW"
  | "VOTING_OPEN"
  | "VOTING_CLOSED";

export type MemePresentationCandidate = {
  candidateId: number;
  number: number;
  topText: string;
  bottomText: string;
  captions?: Record<string, string>;
  layout?: ResolvedMemeCaptionLayout;
};

export type MemePresentationTransition =
  | "PREVIOUS_CANDIDATE"
  | "NEXT_CANDIDATE"
  | "PREVIOUS_OVERVIEW_PAGE"
  | "NEXT_OVERVIEW_PAGE"
  | "OPEN_VOTING"
  | "CLOSE_VOTING";

export type StoredMemePresentationState = {
  state: MemePresentationPhase;
  activeCandidatePosition: number | null;
  overviewPage: number;
};

export function getMemeOverviewPageCount(candidateCount: number) {
  return Math.max(1, Math.ceil(candidateCount / MEME_OVERVIEW_PAGE_SIZE));
}

export function getMemeOverviewCandidates<T>(
  candidates: readonly T[],
  page: number,
) {
  const safePage = Math.min(
    Math.max(0, page),
    getMemeOverviewPageCount(candidates.length) - 1,
  );
  const start = safePage * MEME_OVERVIEW_PAGE_SIZE;
  return candidates.slice(start, start + MEME_OVERVIEW_PAGE_SIZE);
}

export function createInitialMemePresentationState(
  candidateNumbers: readonly number[],
): StoredMemePresentationState {
  if (candidateNumbers.length === 0) {
    throw new Error("Eine Meme-Präsentation benötigt mindestens einen freigegebenen Kandidaten.");
  }
  return {
    state: "PRESENTING",
    activeCandidatePosition: candidateNumbers[0],
    overviewPage: 0,
  };
}

export function transitionMemePresentation(
  current: StoredMemePresentationState,
  candidateNumbers: readonly number[],
  transition: MemePresentationTransition,
): StoredMemePresentationState | null {
  if (candidateNumbers.length === 0) return null;
  const currentCandidateIndex = current.activeCandidatePosition === null
    ? -1
    : candidateNumbers.indexOf(current.activeCandidatePosition);
  const lastOverviewPage = getMemeOverviewPageCount(candidateNumbers.length) - 1;

  if (transition === "PREVIOUS_CANDIDATE" && current.state === "PRESENTING") {
    if (currentCandidateIndex <= 0) return null;
    return { ...current, activeCandidatePosition: candidateNumbers[currentCandidateIndex - 1] };
  }
  if (transition === "NEXT_CANDIDATE" && current.state === "PRESENTING") {
    if (currentCandidateIndex < 0) return null;
    if (currentCandidateIndex < candidateNumbers.length - 1) {
      return { ...current, activeCandidatePosition: candidateNumbers[currentCandidateIndex + 1] };
    }
    return { state: "OVERVIEW", activeCandidatePosition: null, overviewPage: 0 };
  }
  if (transition === "PREVIOUS_OVERVIEW_PAGE" && current.state === "OVERVIEW") {
    if (current.overviewPage <= 0) return null;
    return { ...current, overviewPage: current.overviewPage - 1 };
  }
  if (transition === "NEXT_OVERVIEW_PAGE" && current.state === "OVERVIEW") {
    if (current.overviewPage >= lastOverviewPage) return null;
    return { ...current, overviewPage: current.overviewPage + 1 };
  }
  if (
    transition === "OPEN_VOTING" &&
    current.state === "OVERVIEW" &&
    current.overviewPage === lastOverviewPage
  ) {
    return { state: "VOTING_OPEN", activeCandidatePosition: null, overviewPage: 0 };
  }
  if (transition === "CLOSE_VOTING" && current.state === "VOTING_OPEN") {
    return { ...current, state: "VOTING_CLOSED" };
  }
  return null;
}

export function teamCanVoteForCandidate(input: {
  votingOpen: boolean;
  voterTeamId: number;
  ownerTeamId: number;
}) {
  return input.votingOpen && input.voterTeamId !== input.ownerTeamId;
}

export function countEligibleMemeVoters(
  teamIds: readonly number[],
  candidateOwnerTeamIds: readonly number[],
) {
  return teamIds.filter((teamId) =>
    candidateOwnerTeamIds.some((ownerTeamId) => ownerTeamId !== teamId),
  ).length;
}

export function planMemeVoteWrite(input: {
  presentationState: MemePresentationPhase;
  voterTeamId: number;
  ownerTeamId: number;
  expectedRevision: number | null;
  currentRevision: number | null;
}) {
  if (input.presentationState !== "VOTING_OPEN") {
    return { ok: false as const, reason: "VOTING_CLOSED" as const };
  }
  if (input.voterTeamId === input.ownerTeamId) {
    return { ok: false as const, reason: "SELF_VOTE" as const };
  }
  if (input.expectedRevision !== input.currentRevision) {
    return { ok: false as const, reason: "REVISION_CONFLICT" as const };
  }
  return {
    ok: true as const,
    operation: input.currentRevision === null ? "CREATE" as const : "UPDATE" as const,
    nextRevision: (input.currentRevision ?? 0) + 1,
  };
}
import type { ResolvedMemeCaptionLayout } from "@/app/quiz/memeCaptionZones";
