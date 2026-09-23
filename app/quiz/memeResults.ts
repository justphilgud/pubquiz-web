export const MEME_RESULT_PAGE_SIZE = 4;

export type MemeResultCandidateInput = {
  candidateId: number;
  number: number;
  ownerTeamId: number;
};

export type MemeResultEntry = MemeResultCandidateInput & {
  voteCount: number;
  share: number;
  isWinner: boolean;
  awardedPoints: number;
};

export type MemeCalculatedResult = {
  totalVotes: number;
  maximumVotes: number;
  winnerCandidateIds: number[];
  entries: MemeResultEntry[];
};

export function calculateMemeResult(input: {
  candidates: readonly MemeResultCandidateInput[];
  voteCandidateIds: readonly number[];
}): MemeCalculatedResult {
  const candidateIds = new Set(input.candidates.map((candidate) => candidate.candidateId));
  const validVotes = input.voteCandidateIds.filter((candidateId) =>
    candidateIds.has(candidateId),
  );
  const voteCounts = new Map<number, number>();
  for (const candidateId of validVotes) {
    voteCounts.set(candidateId, (voteCounts.get(candidateId) ?? 0) + 1);
  }
  const maximumVotes = Math.max(
    0,
    ...input.candidates.map((candidate) => voteCounts.get(candidate.candidateId) ?? 0),
  );
  const hasWinner = maximumVotes > 0;
  const entries = input.candidates.map((candidate) => {
    const voteCount = voteCounts.get(candidate.candidateId) ?? 0;
    const isWinner = hasWinner && voteCount === maximumVotes;
    return {
      ...candidate,
      voteCount,
      share: validVotes.length === 0 ? 0 : (voteCount / validVotes.length) * 100,
      isWinner,
      awardedPoints: isWinner ? 1 : 0,
    };
  });
  return {
    totalVotes: validVotes.length,
    maximumVotes,
    winnerCandidateIds: entries.filter((entry) => entry.isWinner).map((entry) => entry.candidateId),
    entries,
  };
}

export function getMemeResultPageCount(candidateCount: number) {
  return Math.max(1, Math.ceil(candidateCount / MEME_RESULT_PAGE_SIZE));
}

export function getMemeResultPage<T>(entries: readonly T[], revealCount: number) {
  const pageCount = getMemeResultPageCount(entries.length);
  const page = Math.min(Math.max(1, Math.trunc(revealCount)), pageCount);
  const start = (page - 1) * MEME_RESULT_PAGE_SIZE;
  return {
    page,
    pageCount,
    entries: entries.slice(start, start + MEME_RESULT_PAGE_SIZE),
  };
}
