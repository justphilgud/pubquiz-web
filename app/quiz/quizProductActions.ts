export type QuizProductActionId =
  | "FLOW"
  | "MODERATION"
  | "PRESENTATION"
  | "ANSWER_FORM"
  | "EVALUATION";

export function getQuizProductActions(quizId: number) {
  const base = `/quiz/${quizId}`;
  return [
    { id: "FLOW", label: "Ablauf bearbeiten", href: `${base}/ablauf`, opensNewTab: false },
    { id: "MODERATION", label: "Moderieren", href: `${base}/moderation`, opensNewTab: true },
    { id: "PRESENTATION", label: "Präsentation öffnen", href: `${base}/praesentation`, opensNewTab: true },
    { id: "ANSWER_FORM", label: "Antwortformular öffnen", href: `${base}/antworten`, opensNewTab: true },
    { id: "EVALUATION", label: "Auswertung öffnen", href: `${base}/auswertung`, opensNewTab: true },
  ] as const satisfies readonly {
    id: QuizProductActionId;
    label: string;
    href: string;
    opensNewTab: boolean;
  }[];
}
