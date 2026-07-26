export const INTRO_SECTION_TYPE = "intro";
export const QUESTION_SECTION_TYPES = ["fragenblock", "fragenrunde"] as const;
export const OUTRO_SECTION_TYPE = "outro";

type QuizSectionTypeSource = {
  abschnitt_typ: string | null | undefined;
};

export function isIntroSection(section: QuizSectionTypeSource) {
  return section.abschnitt_typ === INTRO_SECTION_TYPE;
}

export function isQuestionSection(section: QuizSectionTypeSource) {
  return QUESTION_SECTION_TYPES.some(
    (sectionType) => sectionType === section.abschnitt_typ,
  );
}

export function isOutroSection(section: QuizSectionTypeSource) {
  return section.abschnitt_typ === OUTRO_SECTION_TYPE;
}
