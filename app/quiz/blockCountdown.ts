/** The presentation and block use the same server-issued deadline. */
export function presentationCountdownDeadline(status: {
  countdown_started_at: Date | null;
  countdown_dauer_sekunden: number | null;
}) {
  return status.countdown_started_at && status.countdown_dauer_sekunden !== null
    ? new Date(status.countdown_started_at.getTime() + status.countdown_dauer_sekunden * 1_000)
    : null;
}

export function countdownRemainingSeconds(startedAt: string | null, duration: number, status: string | null, serverNow: number) {
  if (status === "finished") return 0;
  if (status !== "running" || !startedAt) return duration;
  return Math.max(0, Math.ceil((Date.parse(startedAt) + duration * 1_000 - serverNow) / 1_000));
}
