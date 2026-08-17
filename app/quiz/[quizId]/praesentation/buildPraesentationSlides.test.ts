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

test("paart jede Frage unmittelbar mit ihrer richtigen Auflösung", () => {
  const slides = buildPraesentationSlides(quizFixture());
  const questionSlides = slides.filter((slide) => slide.typ === "frage");
  assert.equal(questionSlides.length, 3);
  for (const questionSlide of questionSlides) {
    const index = slides.indexOf(questionSlide);
    const solution = slides[index + 1];
    assert.equal(solution?.typ, "aufloesung");
    assert.equal(
      solution?.typ === "aufloesung" ? solution.frage.quiz_fragen_id : null,
      questionSlide.frage.quiz_fragen_id,
    );
  }
  assert.equal(
    slides.filter((slide) => slide.typ === "frage" || slide.typ === "aufloesung").length,
    6,
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
  assert.deepEqual(flowTypes.slice(-3), ["FINAL_STANDINGS", "WINNER", "CLOSING"]);
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
