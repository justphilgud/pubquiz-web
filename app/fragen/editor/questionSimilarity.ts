import { normalizeExactOpenAnswer } from "@/app/quiz/evaluation/normalizeExactOpenAnswer";
import type { QuestionTemplateConfig } from "./types";
import { resolveQuestionMediaUrl } from "./questionMedia";
import { parseQuestionTemplateData } from "./templates/questionTemplateData";
import { pairContentEntries } from "./templates/pairsTemplate";
import { questionTemplateIds, resolveCanonicalQuestionTemplateId } from "./templates/questionTemplateRegistry";

export function normalizeQuestionForSimilarity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/\u00df/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function trigrams(value: string): Set<string> {
  const padded = `  ${value}  `;
  return new Set(
    Array.from({ length: Math.max(0, padded.length - 2) }, (_, index) =>
      padded.slice(index, index + 3),
    ),
  );
}

export function calculateQuestionSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeQuestionForSimilarity(left);
  const normalizedRight = normalizeQuestionForSimilarity(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const leftParts = trigrams(normalizedLeft);
  const rightParts = trigrams(normalizedRight);
  const intersection = [...leftParts].filter((part) => rightParts.has(part)).length;
  return (2 * intersection) / (leftParts.size + rightParts.size);
}

export function isPotentialQuestionDuplicate(left: string, right: string) {
  return calculateQuestionSimilarity(left, right) >= 0.58;
}

type DuplicateMedium = { slotKey: string; url: string | null; operation?: string };
export type QuestionDuplicateInput = {
  questionText: string;
  templateId: string | null;
  templateConfig: QuestionTemplateConfig | null;
  hasCustomTemplate?: boolean;
  media?: readonly DuplicateMedium[];
  answers: readonly {
    text: string;
    isCorrect?: boolean;
    fieldLabel?: string;
    media?: DuplicateMedium | null;
    additionalInfo?: string;
  }[];
};

export function usesQuestionTextSimilarity(templateId: string | null, customTemplate = false) {
  const id = resolveCanonicalQuestionTemplateId(templateId);
  return !customTemplate && (id === null || id === questionTemplateIds.multipleChoice);
}

const exactText = (value: string) => normalizeExactOpenAnswer(value.normalize("NFKC").replace(/\s+/g, " "));
const uniqueSorted = (entries: readonly string[]) => [...new Set(entries)].sort();
const texts = (entries: readonly string[]) => uniqueSorted(entries.map(exactText).filter(Boolean));

function mediumRef(media: DuplicateMedium | null | undefined) {
  if (!media?.url || media.operation === "REMOVE") return "";
  // Legacy local references and their resolved URLs refer to the same file.
  const url = resolveQuestionMediaUrl(media.url.trim());
  return url.split("#", 1)[0];
}

export function getQuestionDuplicateFingerprint(input: QuestionDuplicateInput): string {
  const template = resolveCanonicalQuestionTemplateId(input.templateId);
  const question = exactText(input.questionText);
  if (usesQuestionTextSimilarity(template, input.hasCustomTemplate)) return normalizeQuestionForSimilarity(input.questionText);

  const payload = input.templateConfig?.templateData;
  const data = payload === undefined ? null : parseQuestionTemplateData(payload, template, true);
  const answers = uniqueSorted(input.answers.flatMap(answer => {
    const text = exactText(answer.text);
    const media = mediumRef(answer.media);
    return text || media ? [JSON.stringify([text, answer.isCorrect !== false, exactText(answer.fieldLabel ?? ""), media])] : [];
  }));
  const solutions = texts(input.answers.filter(answer => answer.isCorrect !== false).map(answer => answer.text));
  const media = input.media ?? [];
  const reference = (slot: string) => uniqueSorted(media.filter(item => item.slotKey === slot).map(mediumRef).filter(Boolean));
  const encode = (...parts: unknown[]) => JSON.stringify([template, ...parts]);

  switch (data?.kind) {
    case "PAIRS":
      return encode(pairContentEntries(data.pairs));
    case "FACTS":
      return encode(texts(data.facts.map(fact => fact.text)), data.response,
        exactText(data.solution), texts(data.acceptedVariants),
        uniqueSorted(data.options.map(option => JSON.stringify([exactText(option.text), option.isCorrect]))));
    case "ORDERING":
      return question ? encode(question, data.items.map(item => exactText(item.text))) : "";
    case "ESTIMATE":
      return question ? encode(question, data.correctValue, exactText(data.unit)) : "";
    case "TRUE_FALSE":
      return question ? encode(question, data.correctAnswer) : "";
    case "TRANSLATION_READ_ALOUD":
      return solutions.length ? encode(exactText(data.originalText), exactText(data.translation),
        data.sourceLanguage, data.targetLanguage, solutions) : "";
    case "ANAGRAM":
      return encode(exactText(data.name), exactText(data.selectedSolution));
    case "GOOGLE_REVIEWS":
      return encode(exactText(data.placeName), texts(data.reviews.map(review => review.text)));
    case "POLL_SCALE":
      return question ? encode(question, data.min, data.max, data.step, exactText(data.minLabel), exactText(data.maxLabel)) : "";
  }

  switch (template) {
    case null:
    case questionTemplateIds.multipleChoice: {
      const questionMedia = uniqueSorted(media.flatMap(item => {
        const ref = mediumRef(item);
        return ref ? [JSON.stringify([item.slotKey, ref])] : [];
      }));
      return answers.length || questionMedia.length ? encode(answers, questionMedia) : "";
    }
    case questionTemplateIds.pollSingle:
    case questionTemplateIds.pollMulti:
      return question && answers.length >= 2 ? encode(question, answers) : "";
    case questionTemplateIds.faceMorph: {
      const personA = reference("face_morph_person_a_original");
      const personB = reference("face_morph_person_b_original");
      const result = reference("face_morph_result");
      const pair = [personA, personB].map(entries => JSON.stringify(entries)).sort();
      return answers.length && ((personA.length && personB.length) || result.length)
        ? encode(personA.length && personB.length ? pair : result, answers) : "";
    }
    case questionTemplateIds.music:
    case questionTemplateIds.musicReverse:
    case questionTemplateIds.musicEightBit: {
      const original = reference("music_original_audio");
      const stimulus = original.length ? original : reference(
        template === questionTemplateIds.musicReverse ? "music_reverse_audio" : "music_bitcrush_audio",
      );
      return stimulus.length && answers.length ? encode(stimulus, answers) : "";
    }
    case questionTemplateIds.pixelImage: {
      const original = reference("pixel_original_image");
      return original.length && answers.length ? encode(original, answers) : "";
    }
    case questionTemplateIds.artwork:
      return reference("question_image").length && answers.length ? encode(reference("question_image"), answers) : "";
    case questionTemplateIds.memeCaption:
      return reference("question_image").length ? encode(question, reference("question_image")) : "";
    default:
      return ""; // An unknown or incomplete template provides no reliable comparison.
  }
}

export function compareQuestionFingerprints(fingerprint: string, candidate: string, compareText: boolean): number {
  if (!fingerprint || !candidate) return 0;
  return compareText ? calculateQuestionSimilarity(fingerprint, candidate) : Number(fingerprint === candidate);
}
