export function mediaRemainingSeconds(duration: number, position: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return null;
  return Math.max(0, Math.ceil(duration - Math.max(0, position)));
}

export function formatMediaRemaining(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export type IntroMediaResume = {
  source: string; commandId: number; duration: number; position: number;
  recordedAt: number; playing: boolean;
};

/** Resume only the same explicit playback command, never a new slide/start. */
export function introResumePosition(value: unknown, source: string, commandId: number, duration: number, now: number): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<IntroMediaResume>;
  if (record.source !== source || record.commandId !== commandId || typeof record.playing !== "boolean" ||
    !Number.isFinite(duration) || duration <= 0 ||
    typeof record.duration !== "number" || !Number.isFinite(record.duration) || Math.abs(record.duration - duration) > .1 ||
    typeof record.position !== "number" || !Number.isFinite(record.position) || record.position < 0 ||
    typeof record.recordedAt !== "number" || !Number.isFinite(record.recordedAt) || record.recordedAt > now) return null;
  const elapsed = record.playing ? Math.max(0, now - record.recordedAt) / 1000 : 0;
  return Math.min(duration, record.position + elapsed);
}
