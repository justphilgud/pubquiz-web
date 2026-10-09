export function mediaRemainingSeconds(duration: number, position: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return null;
  return Math.max(0, Math.ceil(duration - Math.max(0, position)));
}

export function formatMediaRemaining(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
