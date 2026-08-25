export function shouldShowTeamIdentity(input: {
  standingsType: "INTERMEDIATE" | "FINAL" | "WINNER";
  renderMode: "PRESENTATION" | "MODERATION_PREVIEW" | "DESIGN_PREVIEW";
}) {
  return input.standingsType !== "INTERMEDIATE" || input.renderMode !== "PRESENTATION";
}

export function rankScores<T extends { punkte: number }>(scores: readonly T[]) {
  return [...scores]
    .sort((left, right) => right.punkte - left.punkte)
    .map((entry, index, sorted) => ({
      ...entry,
      place: sorted.findIndex((candidate) => candidate.punkte === entry.punkte) + 1,
    }));
}
