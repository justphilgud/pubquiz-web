/** Content selection only: no audio processing and no mutation of stored media. */
export function questionPhaseMedia<T extends { slotKey?: string | null; datei: string }>(
  templateId: string | null, media: readonly T[], phase: "QUESTION" | "SOLUTION",
): T[] {
  if (templateId === "musik") {
    const wanted = phase === "SOLUTION" && media.some(item => item.slotKey === "music_original_audio")
      ? "music_original_audio" : "question_audio";
    return media.filter(item => !["music_original_audio", "question_audio"].includes(item.slotKey ?? "") || item.slotKey === wanted);
  }
  const processedSlot = templateId === "musik_rueckwaerts" ? "music_reverse_audio"
    : templateId === "eight_bit" ? "music_bitcrush_audio" : null;
  if (!processedSlot) return [...media];
  const audio = media.filter(item => /\.(mp3|wav|ogg|m4a)(?:[?#].*)?$/i.test(item.datei));
  const wantedSlot = phase === "QUESTION" ? processedSlot : "music_original_audio";
  const explicit = audio.filter(item => item.slotKey === wantedSlot);
  // A lone unkeyed legacy file is the previously prepared question version.
  // Never substitute the original for a missing reverse file or vice versa.
  const selected = explicit.length ? explicit
    : phase === "QUESTION" && audio.length === 1 && !audio[0].slotKey ? audio : [];
  return media.filter(item => !audio.includes(item)).concat(selected);
}
