import assert from "node:assert/strict";
import test from "node:test";
import type { QuizPraesentationResult } from "../../actions";
import {
  buildPraesentationSlides,
  getPresentationSlideKey,
} from "./buildPraesentationSlides";

function quizFixture(): QuizPraesentationResult {
  const question = (quizQuestionId: number, questionId: number, sectionId: number | null, order: number) => ({
    quiz_fragen_id: quizQuestionId,
    fragen_id: questionId,
    quiz_abschnitt_id: sectionId,
    sortierung: order,
    frage: `Frage ${questionId}`,
    funnyRevealAvailable: false,
  }) as unknown as QuizPraesentationResult["fragen"][number];
  return {
    quiz_id: 1,
    titel: "Ablauftest",
    quiz_datum: null,
    intro_begruessungstitel: null,
    intro_begruessungstext: null,
    intro_regeln: null,
    intro_preise: null,
    intro_logo_url: null,
    intro_musik_url: null,
    intro_wartetext: null,
    intro_video_url: null,
    intro_startzeit: null,
    intro_startsequenz_text: null,
    outro_bekanntmachungen: null,
    outro_musik_url: null,
    abschnitte: [
      { quiz_abschnitt_id: 10, titel: "Runde 1", abschnitt_typ: "fragenblock", sortierung: 1, dauer_sekunden: 60, qr_code_url: null, medien_datei: null, bemerkung: null },
      { quiz_abschnitt_id: 20, titel: "Runde 2", abschnitt_typ: "fragenrunde", sortierung: 2, dauer_sekunden: 60, qr_code_url: null, medien_datei: null, bemerkung: null },
    ],
    fragen: [question(101, 1, 10, 1), question(102, 2, 10, 2), question(201, 3, 20, 3)],
    ablaufElemente: [],
  };
}

function setBlockQuestions(
  quiz: QuizPraesentationResult,
  blocks: ReadonlyArray<{
    sectionId: number;
    questionAssignmentIds: readonly number[];
  }>,
) {
  const sourceQuestion = quiz.fragen[0];
  quiz.abschnitte = quiz.abschnitte.filter((section) =>
    blocks.some((block) => block.sectionId === section.quiz_abschnitt_id),
  );
  quiz.fragen = blocks.flatMap((block) =>
    block.questionAssignmentIds.map((questionAssignmentId, index) => ({
      ...sourceQuestion,
      quiz_fragen_id: questionAssignmentId,
      fragen_id: questionAssignmentId,
      quiz_abschnitt_id: block.sectionId,
      sortierung: index + 1,
      frage: `Frage ${questionAssignmentId}`,
    })),
  );
}

function compactBlockSequence(
  slides: ReturnType<typeof buildPraesentationSlides>,
) {
  return slides.flatMap((slide) => {
    if (!("abschnitt" in slide) || !slide.abschnitt) return [];
    const sectionId = slide.abschnitt.quiz_abschnitt_id;
    if (slide.typ === "frage") {
      return [`${sectionId}:QUESTION:${slide.frage.quiz_fragen_id}`];
    }
    if (slide.typ === "aufloesung") {
      return [`${sectionId}:SOLUTION:${slide.frage.quiz_fragen_id}`];
    }
    if (
      slide.typ === "ablauf" &&
      (slide.element.type === "BREAK" || slide.element.type === "COUNTDOWN")
    ) {
      return [`${sectionId}:COUNTDOWN`];
    }
    return [];
  });
}

test("ordnet Funny-Reveals nur Fragen mit final markierten Textantworten zu", () => {
  const quiz = quizFixture();
  quiz.fragen[0].funnyRevealAvailable = true;
  quiz.fragen[2].funnyRevealAvailable = true;
  const slides = buildPraesentationSlides(quiz);
  const questionSlides = slides.filter((slide) => slide.typ === "frage");
  assert.equal(questionSlides.length, 3);
  for (const questionSlide of questionSlides) {
    const index = slides.indexOf(questionSlide);
    const hasFunnyReveal = questionSlide.frage.funnyRevealAvailable;
    const funny = hasFunnyReveal ? slides[index + 1] : null;
    const solution = slides[index + (hasFunnyReveal ? 2 : 1)];
    if (hasFunnyReveal) {
      assert.equal(funny?.typ, "funny");
      assert.equal(
        funny?.typ === "funny" ? funny.frage.quiz_fragen_id : null,
        questionSlide.frage.quiz_fragen_id,
      );
    }
    assert.equal(solution?.typ, "aufloesung");
    assert.equal(
      solution?.typ === "aufloesung" ? solution.frage.quiz_fragen_id : null,
      questionSlide.frage.quiz_fragen_id,
    );
  }
  assert.equal(
    slides.filter(
      (slide) =>
        slide.typ === "frage" || slide.typ === "funny" || slide.typ === "aufloesung",
    ).length,
    8,
  );
  assert.deepEqual(
    slides.filter((slide) => slide.typ === "funny").map((slide) => slide.frage.quiz_fragen_id),
    [101, 201],
  );
});

test("leitet Standardphasen für mehrere Runden und den Abschluss ab", () => {
  const slides = buildPraesentationSlides(quizFixture());
  const flowTypes = slides
    .filter((slide) => slide.typ === "ablauf")
    .map((slide) => slide.element.type);
  assert.deepEqual(flowTypes.slice(0, 3), ["WELCOME", "QR_CODE", "RULES"]);
  assert.equal(flowTypes.filter((type) => type === "ROUND_INTRO").length, 2);
  const firstRoundIntro = slides.find(
    (slide) =>
      slide.typ === "ablauf" &&
      slide.element.type === "ROUND_INTRO" &&
      slide.abschnitt?.quiz_abschnitt_id === 10,
  );
  assert.equal(
    firstRoundIntro ? getPresentationSlideKey(firstRoundIntro) : null,
    "section:10:intro",
  );
  assert.ok(flowTypes.includes("INTERMEDIATE_STANDINGS"));
  assert.deepEqual(flowTypes.slice(-4), ["WINNER", "FINAL_STANDINGS", "CLOSING", "CALENDAR_SUBSCRIPTION"]);
});

test("ausgeblendete Elemente verschwinden und stabile Schlüssel bleiben erhalten", () => {
  const quiz = quizFixture();
  quiz.ablaufElemente = [{
    quiz_ablauf_element_id: 77,
    typ: "CUSTOM_MESSAGE",
    anker_typ: "BEFORE_QUIZ",
    anker_schluessel: "QUIZ",
    quiz_abschnitt_id: null,
    sortierung: 10,
    ist_sichtbar: false,
    bezeichnung: null,
    konfiguration: { version: 1, title: "Unsichtbar" },
    ist_standard: false,
  }];
  const slides = buildPraesentationSlides(quiz);
  assert.equal(slides.some((slide) => slide.typ === "ablauf" && slide.element.persistentId === 77), false);

  const editorSlides = buildPraesentationSlides(quiz, {
    includeDisabledFlowItems: true,
  });
  assert.equal(
    editorSlides.some(
      (slide) =>
        slide.typ === "ablauf" && slide.element.persistentId === 77,
    ),
    true,
  );

  quiz.ablaufElemente[0].ist_sichtbar = true;
  const visible = buildPraesentationSlides(quiz).find(
    (slide) => slide.typ === "ablauf" && slide.element.persistentId === 77,
  );
  assert.ok(visible);
  assert.equal(visible ? getPresentationSlideKey(visible) : null, "flow:77:CUSTOM_MESSAGE");
});

test("calendar outro uses the existing visibility contract", () => {
  const quiz = quizFixture();
  quiz.ablaufElemente = [{
    quiz_ablauf_element_id: 78,
    typ: "CALENDAR_SUBSCRIPTION",
    anker_typ: "AFTER_QUIZ",
    anker_schluessel: "QUIZ",
    quiz_abschnitt_id: null,
    sortierung: 40,
    ist_sichtbar: false,
    bezeichnung: null,
    konfiguration: { version: 1, title: "Kein PubQuiz mehr verpassen" },
    ist_standard: true,
  }];

  assert.equal(
    buildPraesentationSlides(quiz).some(
      (slide) =>
        slide.typ === "ablauf" &&
        slide.element.type === "CALENDAR_SUBSCRIPTION",
    ),
    false,
  );
  assert.equal(
    buildPraesentationSlides(quiz, { includeDisabledFlowItems: true }).some(
      (slide) =>
        slide.typ === "ablauf" &&
        slide.element.type === "CALENDAR_SUBSCRIPTION",
    ),
    true,
  );
});

test("mischt Blockelemente und Fragen über denselben produktiven Slide-Builder", () => {
  const quiz = quizFixture();
  quiz.aufloesungsstrategie = "END_OF_BLOCK";
  quiz.ablaufElemente = [
    {
      quiz_ablauf_element_id: 81,
      typ: "QUESTION",
      anker_typ: "BLOCK",
      anker_schluessel: "10",
      quiz_abschnitt_id: 10,
      quiz_fragen_id: 101,
      sortierung: 1_000,
      ist_sichtbar: true,
      bezeichnung: null,
      konfiguration: { version: 1 },
      konfigurations_version: 1,
      ist_standard: true,
    },
    {
      quiz_ablauf_element_id: 82,
      typ: "TEXT",
      anker_typ: "BLOCK",
      anker_schluessel: "10",
      quiz_abschnitt_id: 10,
      quiz_fragen_id: null,
      sortierung: 2_000,
      ist_sichtbar: true,
      bezeichnung: "Anekdote",
      konfiguration: { version: 1, body: "Eine Erinnerung" },
      konfigurations_version: 1,
      ist_standard: false,
    },
    {
      quiz_ablauf_element_id: 83,
      typ: "QUESTION",
      anker_typ: "BLOCK",
      anker_schluessel: "10",
      quiz_abschnitt_id: 10,
      quiz_fragen_id: 102,
      sortierung: 3_000,
      ist_sichtbar: true,
      bezeichnung: null,
      konfiguration: { version: 1 },
      konfigurations_version: 1,
      ist_standard: true,
    },
  ];

  const blockSlides = buildPraesentationSlides(quiz).filter(
    (slide) =>
      "abschnitt" in slide && slide.abschnitt?.quiz_abschnitt_id === 10 &&
      (slide.typ === "frage" || slide.typ === "aufloesung" ||
        (slide.typ === "ablauf" && slide.element.anchorType === "BLOCK")),
  );
  assert.deepEqual(
    blockSlides.map((slide) =>
      slide.typ === "ablauf"
        ? slide.element.type
        : slide.typ === "frage" || slide.typ === "aufloesung"
          ? `${slide.typ}:${slide.frage.quiz_fragen_id}`
          : slide.typ,
    ),
    ["frage:101", "TEXT", "frage:102", "aufloesung:101", "aufloesung:102"],
  );
  const storySlide = blockSlides.find(
    (slide) => slide.typ === "ablauf" && slide.element.type === "TEXT",
  );
  assert.equal(
    storySlide ? getPresentationSlideKey(storySlide) : null,
    "block-item:82",
  );
});

test("verwendet die redaktionelle Fragenreihenfolge trotz abweichender Flow-Slots", () => {
  const quiz = quizFixture();
  const first = quiz.fragen[0];
  const second = quiz.fragen[1];
  quiz.abschnitte = quiz.abschnitte.slice(0, 1);
  quiz.fragen = [
    { ...first, quiz_fragen_id: 101, fragen_id: 1, sortierung: 1 },
    { ...second, quiz_fragen_id: 102, fragen_id: 2, sortierung: 2 },
    { ...first, quiz_fragen_id: 103, fragen_id: 3, sortierung: 3 },
    { ...second, quiz_fragen_id: 104, fragen_id: 4, sortierung: 4 },
  ];
  quiz.aufloesungsstrategie = "END_OF_BLOCK";
  quiz.ablaufElemente = [
    [103, 1_000],
    [101, 2_100],
    [102, 3_200],
    [104, 4_200],
  ].map(([questionAssignmentId, order], index) => ({
    quiz_ablauf_element_id: 90 + index,
    typ: "QUESTION",
    anker_typ: "BLOCK",
    anker_schluessel: "10",
    quiz_abschnitt_id: 10,
    quiz_fragen_id: questionAssignmentId,
    sortierung: order,
    ist_sichtbar: true,
    bezeichnung: null,
    konfiguration: { version: 1 },
    konfigurations_version: 1,
    ist_standard: true,
  }));

  assert.deepEqual(
    buildPraesentationSlides(quiz)
      .filter((slide) => slide.typ === "frage")
      .map((slide) => slide.frage.quiz_fragen_id),
    [101, 102, 103, 104],
  );
});

test("places an explicit countdown between collected questions and solutions", () => {
  const quiz = quizFixture();
  quiz.aufloesungsstrategie = "END_OF_BLOCK";
  setBlockQuestions(quiz, [
    { sectionId: 10, questionAssignmentIds: [101, 102, 103] },
  ]);
  quiz.ablaufElemente = [
    {
      quiz_ablauf_element_id: 301,
      typ: "BREAK",
      anker_typ: "ROUND_END",
      anker_schluessel: "10",
      quiz_abschnitt_id: 10,
      quiz_fragen_id: null,
      sortierung: 10,
      ist_sichtbar: false,
      bezeichnung: null,
      konfiguration: { version: 1, durationSeconds: 60, showCountdown: true },
      konfigurations_version: 1,
      ist_standard: true,
    },
    {
      quiz_ablauf_element_id: 302,
      typ: "COUNTDOWN",
      anker_typ: "ROUND_END",
      anker_schluessel: "10",
      quiz_abschnitt_id: 10,
      quiz_fragen_id: null,
      sortierung: 20,
      ist_sichtbar: true,
      bezeichnung: "Antworten abgeben",
      konfiguration: { version: 1, durationSeconds: 60, showCountdown: true },
      konfigurations_version: 1,
      ist_standard: false,
    },
  ];

  assert.deepEqual(compactBlockSequence(buildPraesentationSlides(quiz)), [
    "10:QUESTION:101",
    "10:QUESTION:102",
    "10:QUESTION:103",
    "10:COUNTDOWN",
    "10:SOLUTION:101",
    "10:SOLUTION:102",
    "10:SOLUTION:103",
  ]);
});

test("places the standard countdown before the solution in a one-question block", () => {
  const quiz = quizFixture();
  quiz.aufloesungsstrategie = "END_OF_BLOCK";
  setBlockQuestions(quiz, [
    { sectionId: 10, questionAssignmentIds: [101] },
  ]);

  assert.deepEqual(compactBlockSequence(buildPraesentationSlides(quiz)), [
    "10:QUESTION:101",
    "10:COUNTDOWN",
    "10:SOLUTION:101",
  ]);
});

test("keeps countdown and collected solutions inside their respective blocks", () => {
  const quiz = quizFixture();
  quiz.aufloesungsstrategie = "END_OF_BLOCK";
  setBlockQuestions(quiz, [
    { sectionId: 10, questionAssignmentIds: [101, 102] },
    { sectionId: 20, questionAssignmentIds: [201, 202] },
  ]);

  assert.deepEqual(compactBlockSequence(buildPraesentationSlides(quiz)), [
    "10:QUESTION:101",
    "10:QUESTION:102",
    "10:COUNTDOWN",
    "10:SOLUTION:101",
    "10:SOLUTION:102",
    "20:QUESTION:201",
    "20:QUESTION:202",
    "20:COUNTDOWN",
    "20:SOLUTION:201",
    "20:SOLUTION:202",
  ]);
});

test("keeps the immediate reveal sequence unchanged", () => {
  const quiz = quizFixture();
  quiz.aufloesungsstrategie = "AFTER_EACH_QUESTION";
  setBlockQuestions(quiz, [
    { sectionId: 10, questionAssignmentIds: [101, 102] },
  ]);

  assert.deepEqual(compactBlockSequence(buildPraesentationSlides(quiz)), [
    "10:QUESTION:101",
    "10:SOLUTION:101",
    "10:QUESTION:102",
    "10:SOLUTION:102",
    "10:COUNTDOWN",
  ]);
});
