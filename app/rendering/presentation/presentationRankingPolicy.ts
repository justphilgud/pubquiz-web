export function shouldShowTeamIdentity(input: {
  standingsType: "INTERMEDIATE" | "FINAL" | "WINNER";
  renderMode: "PRESENTATION" | "MODERATION_PREVIEW" | "DESIGN_PREVIEW";
}) {
  return input.standingsType !== "INTERMEDIATE" || input.renderMode !== "PRESENTATION";
}
