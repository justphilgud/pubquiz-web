export function buildDefaultQuizSections(quizId: number) {
  return [
    { quiz_id: quizId, titel: "Intro", abschnitt_typ: "intro", sortierung: 1 },
    { quiz_id: quizId, titel: "Fragenblock 1", abschnitt_typ: "fragenblock", sortierung: 2 },
    { quiz_id: quizId, titel: "Outro", abschnitt_typ: "outro", sortierung: 3 },
  ];
}

export function buildQuickQuizSections(quizId: number, blockCount: number) {
  return [
    { quiz_id: quizId, titel: "Intro", abschnitt_typ: "intro", sortierung: 1 },
    ...Array.from({ length: blockCount }, (_, index) => ({
      quiz_id: quizId,
      titel: `Fragenblock ${index + 1}`,
      abschnitt_typ: "fragenblock",
      sortierung: index + 2,
    })),
    { quiz_id: quizId, titel: "Outro", abschnitt_typ: "outro", sortierung: blockCount + 2 },
  ];
}
