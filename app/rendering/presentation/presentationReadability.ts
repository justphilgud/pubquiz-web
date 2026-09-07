import type { QuestionTemplateData } from "@/app/fragen/editor/types";

/** Recommendations, never validation limits. Existing content remains renderable. */
export const presentationRecommendations = {
  question: 220,
  answer: 120,
  title: 100,
  body: 600,
  information: 300,
  optionCount: 6,
} as const;

export type PresentationTextRole = Exclude<keyof typeof presentationRecommendations, "optionCount">;
export type PresentationDensity = "regular" | "compact" | "extended";

export function presentationTextDensity(length: number, role: PresentationTextRole): PresentationDensity {
  const recommended = presentationRecommendations[role];
  return length > recommended ? "extended" : length > recommended * 0.6 ? "compact" : "regular";
}

export function presentationContentWarning(text: string, role: PresentationTextRole): string | null {
  const recommended = presentationRecommendations[role];
  if (text.length <= recommended) return null;
  return `${text.length} / empfohlen ${recommended} Zeichen. Langer Inhalt – bitte die Präsentationsvorschau prüfen. Der Text bleibt vollständig erhalten.`;
}

/** Only audience-visible template content; excludes notes, identifiers and source URLs. */
export function templatePresentationTexts(data: QuestionTemplateData | undefined): Array<{ text: string; role: PresentationTextRole }> {
  if (!data) return [];
  switch (data.kind) {
    case "TRUE_FALSE":
    case "ESTIMATE": return [{ text: data.explanation, role: "information" }];
    case "ORDERING": return data.items.flatMap((item) => [{ text: item.text, role: "answer" as const }, { text: item.explanation, role: "information" as const }]);
    case "ANAGRAM": return [{ text: data.selectedSolution, role: "answer" }, { text: data.name, role: "answer" }];
    case "GOOGLE_REVIEWS": return [...data.reviews.map((review) => ({ text: review.text, role: "information" as const })), { text: data.explanation, role: "information" }];
    case "POLL_SCALE": return [{ text: data.minLabel, role: "answer" }, { text: data.maxLabel, role: "answer" }];
    case "TRANSLATION_READ_ALOUD": return [{ text: data.originalText, role: "information" }];
  }
}
