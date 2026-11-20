/** Editorial estimate, not measured audio: 150 words/minute at normal speed. */
export function estimateReadingDuration(text: string, speed = 1) {
  const words = text.match(/\S+/gu)?.length ?? 0;
  const rate = Number.isFinite(speed) && speed > 0 ? speed : 1;
  return { words, seconds: words === 0 ? 0 : Math.ceil(words * 60 / (150 * rate)) };
}

export function formatReadingDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} Min.`;
}
