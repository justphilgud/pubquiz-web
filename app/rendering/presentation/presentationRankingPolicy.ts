export function rankScores<T extends { punkte: number }>(scores: readonly T[]) {
  return [...scores]
    .sort((left, right) => right.punkte - left.punkte)
    .map((entry, index, sorted) => ({
      ...entry,
      place: sorted.findIndex((candidate) => candidate.punkte === entry.punkte) + 1,
    }));
}

export type IntermediateStandingsAudienceEntry = {
  key: string;
  place: number;
  punkte: number;
};

export type IntermediateStandingsModerationEntry =
  IntermediateStandingsAudienceEntry & {
  identity: {
    teamId: number | null;
    teamname: string;
    photoUrl: string | null;
    avatarCode: unknown;
  };
};

export type IntermediateStandingsEntry =
  | IntermediateStandingsAudienceEntry
  | IntermediateStandingsModerationEntry;

export function resolveIntermediateStandingsAudience<
  T extends { punkte: number },
>(
  scores: readonly T[],
): IntermediateStandingsAudienceEntry[] {
  return rankScores(scores).map((entry, index) => ({
    key: `anonymous-rank-${entry.place}-${index}`,
    place: entry.place,
    punkte: entry.punkte,
  }));
}

export function resolveIntermediateStandingsModeration<
  T extends {
    punkte: number;
    teamname: string;
    teamId?: number | null;
    photoUrl?: string | null;
    avatarCode?: unknown;
  },
>(scores: readonly T[]): IntermediateStandingsModerationEntry[] {
  return rankScores(scores).map((entry, index) => ({
    key: `team-${entry.teamId ?? entry.teamname}-${index}`,
    place: entry.place,
    punkte: entry.punkte,
    identity: {
      teamId: entry.teamId ?? null,
      teamname: entry.teamname,
      photoUrl: entry.photoUrl ?? null,
      avatarCode: entry.avatarCode ?? null,
    },
  }));
}

export function resolvePodiumReveal<T extends { punkte: number }>(
  scores: readonly T[],
  revealCount: number,
) {
  const ranked = rankScores(scores);
  const podiumGroups = [3, 2, 1].flatMap((place) => {
    const entries = ranked.filter((entry) => entry.place === place);
    return entries.length > 0 ? [{ place, entries }] : [];
  });
  const normalizedRevealCount = Math.max(0, Math.trunc(revealCount));

  return {
    ranked,
    podiumGroups,
    visiblePodiumGroups: podiumGroups.slice(0, normalizedRevealCount),
    remainingEntries: ranked.filter((entry) => entry.place > 3),
    revealStageCount: podiumGroups.length,
  };
}
