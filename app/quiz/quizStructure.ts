import { isQuestionSection } from "./quizSectionPolicy";

type QuizSectionTitleSource = {
  abschnitt_typ: string;
  titel: string;
};

export function getNextAutomaticBlockTitle(
  sections: readonly QuizSectionTitleSource[],
) {
  const usedNumbers = new Set(
    sections
      .filter(isQuestionSection)
      .map((section) => /^Block\s+(\d+)$/i.exec(section.titel.trim())?.[1])
      .filter((value): value is string => value !== undefined)
      .map(Number),
  );

  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) nextNumber += 1;
  return `Block ${nextNumber}`;
}

export function buildDefaultQuizSections(quizId: number) {
  return [
    { quiz_id: quizId, titel: "Intro", abschnitt_typ: "intro", sortierung: 1 },
    { quiz_id: quizId, titel: "Block 1", abschnitt_typ: "fragenblock", sortierung: 2 },
    { quiz_id: quizId, titel: "Outro", abschnitt_typ: "outro", sortierung: 3 },
  ];
}

export function buildQuickQuizSections(quizId: number, blockCount: number) {
  return [
    { quiz_id: quizId, titel: "Intro", abschnitt_typ: "intro", sortierung: 1 },
    ...Array.from({ length: blockCount }, (_, index) => ({
      quiz_id: quizId,
      titel: `Block ${index + 1}`,
      abschnitt_typ: "fragenblock",
      sortierung: index + 2,
    })),
    { quiz_id: quizId, titel: "Outro", abschnitt_typ: "outro", sortierung: blockCount + 2 },
  ];
}
