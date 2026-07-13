import type { QuestionTemplate } from "../types";

export const questionTemplates: QuestionTemplate[] = [
  {
    id: "standard",
    name: "Standardfrage",
    description: "Freie Frage mit beliebig vielen Antworten.",
    defaultQuestionText: "",
    initialAnswers: [
      {
        isCorrect: true,
      },
    ],
  },
  {
    id: "multiple-choice",
    name: "Multiple Choice",
    description: "Geschlossene Frage mit vier Antwortmöglichkeiten.",
    defaultQuestionText: "",
    initialAnswers: [
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: false },
    ],
  },
  {
    id: "facemorph",
    name: "FaceMorph",
    description: "Zwei Personen in einem kombinierten Bild erkennen.",
    defaultQuestionText:
      "Welche beiden Personen sind auf diesem Bild zu sehen?",
    initialAnswers: [
      {
        fieldLabel: "Person A",
        isCorrect: true,
      },
      {
        fieldLabel: "Person B",
        isCorrect: true,
      },
    ],
    requiresQuestionMedia: true,
  },
  {
    id: "music-reverse",
    name: "Musik rückwärts",
    description: "Interpret und Titel eines rückwärts abgespielten Songs.",
    defaultQuestionText:
      "Welcher Song wurde hier rückwärts abgespielt? Nennt Interpret und Titel.",
    initialAnswers: [
      {
        fieldLabel: "Interpret",
        isCorrect: true,
      },
      {
        fieldLabel: "Titel",
        isCorrect: true,
      },
    ],
  },
];
