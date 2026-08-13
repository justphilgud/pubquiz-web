import { isQuestionSection } from "./quizSectionPolicy";

type QuizSectionTitleSource = {
  abschnitt_typ: string;
  titel: string;
};

const AUTOMATIC_BLOCK_TITLE = /^(?:Block(?:\s+\d+)?|Fragenblock\s+\d+)$/i;

export function isAutomaticBlockTitle(title: string) {
  return AUTOMATIC_BLOCK_TITLE.test(title.trim());
}

export function synchronizeAutomaticBlockTitles<
  TSection extends QuizSectionTitleSource,
>(sections: readonly TSection[]) {
  let questionBlockNumber = 0;
  return sections.map((section) => {
    if (!isQuestionSection(section)) return section;
    questionBlockNumber += 1;
    if (!isAutomaticBlockTitle(section.titel)) return section;
    return { ...section, titel: `Block ${questionBlockNumber}` };
  });
}

export function getNextAutomaticBlockTitle(
  sections: readonly QuizSectionTitleSource[],
) {
  return `Block ${sections.filter(isQuestionSection).length + 1}`;
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
