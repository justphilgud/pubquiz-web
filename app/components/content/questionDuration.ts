import { estimateReadingDuration } from "@/app/fragen/editor/readingDuration";
import { parseQuestionTemplateConfigDraft } from "@/app/fragen/editor/pixelTemplateConfig";
import { questionTemplateIds as T, resolveCanonicalQuestionTemplateId } from "@/app/fragen/editor/templates/questionTemplateRegistry";

export function questionDurationPreview(templateId: string | null, question: string, config: unknown, media: readonly { datei: string; slot_key: string | null }[]) {
  const id = resolveCanonicalQuestionTemplateId(templateId);
  if (![T.translationReadAloud, T.music, T.musicReverse, T.musicEightBit].some(t => t === id)) return null;
  const data = parseQuestionTemplateConfigDraft(config, id)?.templateData;
  const translation = data?.kind === "TRANSLATION_READ_ALOUD" ? data : null;
  return {
    questionSeconds: id === T.translationReadAloud && question.trim() ? estimateReadingDuration(question).seconds : null,
    translationSeconds: translation?.translation.trim() ? estimateReadingDuration(translation.translation, translation.speed).seconds : null,
    audioUrls: media.filter(m => m.slot_key?.includes("audio") || /\.(mp3|wav|ogg|m4a|aac|flac|webm)(?:[?#]|$)/i.test(m.datei))
      .map(m => ({ url: /^https?:\/\//.test(m.datei) || m.datei.startsWith("/") ? m.datei : `/medien/${m.datei}`, label: m.slot_key === "lyrics_tts_audio" ? "Vorlese-Audiodatei" : "Audiodatei" })),
  };
}
