import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDefaultQuizFlow,
  parseStoredQuizFlowItem,
  resolveQuizFlow,
  isQuizBlockFlowItemType,
  isQuizGlobalFlowItemType,
  validateQuizFlowConfig,
  formatRoundContentCounts,
} from "./quizFlow";

function quizFixture() {
  return {
    titel: "Testquiz",
    intro_begruessungstitel: null,
    intro_begruessungstext: null,
    intro_regeln: null,
    intro_preise: null,
    intro_wartetext: null,
    intro_video_url: null,
    intro_startzeit: null,
    intro_musik_url: null,
    intro_startsequenz_text: null,
    outro_bekanntmachungen: null,
    abschnitte: [
      { quiz_abschnitt_id: 10, titel: "Runde 1", abschnitt_typ: "fragenblock", sortierung: 1, dauer_sekunden: 120, bemerkung: null },
      { quiz_abschnitt_id: 20, titel: "Runde 2", abschnitt_typ: "fragenrunde", sortierung: 2, dauer_sekunden: 120, bemerkung: null },
    ],
    fragen: [
      { quiz_abschnitt_id: 10 },
      { quiz_abschnitt_id: 10 },
      { quiz_abschnitt_id: 20 },
    ],
  };
}

test("leitet einen vollständigen Standardablauf ohne Fragenkopien ab", () => {
  const flow = buildDefaultQuizFlow(quizFixture());
  assert.deepEqual(flow.slice(0, 3).map((item) => item.type), ["WELCOME", "RULES", "QR_CODE"]);
  assert.equal(flow.filter((item) => item.type === "ROUND_INTRO").length, 2);
  assert.deepEqual(
    flow
      .filter((item) => item.type === "ROUND_INTRO")
      .map((item) => item.config.title),
    ["Runde 1", "Runde 2"],
  );
  assert.equal(flow.filter((item) => item.type === "INTERMEDIATE_STANDINGS").length, 1);
  assert.deepEqual(flow.slice(-7).map((item) => item.type), ["WINNER", "FINAL_STANDINGS", "YEARLY_STANDINGS", "CLOSING", "QUESTION_SUBMISSION_QR", "CALENDAR_SUBSCRIPTION", "BOOKING_CONTACT"]);
  assert.equal(flow.find((item) => item.type === "QUESTION_SUBMISSION_QR")?.enabled, false);
  assert.equal(flow.find(item => item.type === "CALENDAR_SUBSCRIPTION")?.enabled, true);
  assert.equal(flow.at(-1)?.enabled, false);
  assert.equal(flow.some((item) => item.type === ("QUESTION" as never)), false);
});

test("validiert alle redaktionellen MVP-Elemente in derselben Registry", () => {
  const image = "/medien/template-preview.svg";
  const cases = [
    ["CHAPTER_INTRO", { version: 1, title: "Kindheit" }],
    ["IMAGE", { version: 1, imageUrl: image, altText: "Erster Schultag" }],
    ["IMAGE_GALLERY", { version: 1, images: [
      { id: "one", url: image, altText: "Bild eins" },
      { id: "two", url: image, altText: "Bild zwei" },
    ] }],
    ["MEDIA_SEQUENCE", { version: 1, images: [
      { id: "one", url: image, altText: "Bild eins" },
      { id: "two", url: image, altText: "Bild zwei" },
    ] }],
    ["TEXT", { version: 1, body: "Eine kurze Anekdote" }],
    ["QUOTE", { version: 1, body: "Ich wollte nie zur Schule", quoteSource: "Alex" }],
    ["PORTRAIT", { version: 1, personName: "Alex", imageUrl: image, altText: "Portrait von Alex" }],
    ["AUDIO", { version: 1, title: "Unser Lied", audioUrl: "/medien/audio/intro/6.mp3" }],
    ["VIDEO", { version: 1, title: "Der Film", videoUrl: "/medien/video/intro/intro.mp4" }],
    ["CUSTOM_MESSAGE", { version: 1, title: "Hinweis" }],
  ] as const;

  for (const [type, config] of cases) {
    assert.equal(validateQuizFlowConfig(type, config).ok, true, type);
    assert.equal(isQuizBlockFlowItemType(type), true, type);
  }
  assert.equal(isQuizGlobalFlowItemType("IMAGE"), false);
  assert.equal(isQuizGlobalFlowItemType("CUSTOM_MESSAGE"), true);
});

test("Fragen-Blockelemente benötigen eine bestehende Fragenreferenz", () => {
  const base = {
    quiz_ablauf_element_id: 88,
    typ: "QUESTION",
    anker_typ: "BLOCK",
    anker_schluessel: "10",
    quiz_abschnitt_id: 10,
    sortierung: 1,
    ist_sichtbar: true,
    bezeichnung: null,
    konfiguration: { version: 1 },
    ist_standard: true,
  };
  assert.equal(parseStoredQuizFlowItem(base), null);
  assert.equal(
    parseStoredQuizFlowItem({ ...base, quiz_fragen_id: 101 })?.questionAssignmentId,
    101,
  );
});

test("bewahrt bestehende Vor-dem-Start-Elemente im Legacy-Fallback", () => {
  const quiz = quizFixture();
  quiz.abschnitte.unshift({ quiz_abschnitt_id: 1, titel: "Intro", abschnitt_typ: "intro", sortierung: 0, dauer_sekunden: 120, bemerkung: null });
  const types = buildDefaultQuizFlow(quiz).map((item) => item.type);
  assert.ok(types.includes("WAITING"));
  assert.ok(types.includes("START_SEQUENCE"));
  assert.ok(types.includes("PRIZES"));
});

test("weist unbekannte Typen und ungültige Konfiguration sicher zurück", () => {
  assert.equal(parseStoredQuizFlowItem({
    quiz_ablauf_element_id: 1,
    typ: "EXECUTE_SCRIPT",
    anker_typ: "BEFORE_QUIZ",
    anker_schluessel: "QUIZ",
    quiz_abschnitt_id: null,
    sortierung: 1,
    ist_sichtbar: true,
    bezeichnung: null,
    konfiguration: { version: 1 },
    ist_standard: false,
  }), null);
  assert.deepEqual(
    validateQuizFlowConfig("WELCOME", { version: 1, executable: "alert(1)" }),
    { ok: false, message: "Die Ablaufkonfiguration enthält unbekannte Felder." },
  );
  assert.equal(
    validateQuizFlowConfig("WELCOME", {
      version: 1,
      imageUrl: "javascript:alert(1)",
    }).ok,
    false,
  );
});

test("ergänzt neue Runden bei einem bereits persistierten Ablauf", () => {
  const flow = resolveQuizFlow(quizFixture(), [{
    quiz_ablauf_element_id: 4,
    typ: "WELCOME",
    anker_typ: "BEFORE_QUIZ",
    anker_schluessel: "QUIZ",
    quiz_abschnitt_id: null,
    sortierung: 10,
    ist_sichtbar: true,
    bezeichnung: null,
    konfiguration: { version: 1, title: "Eigener Auftakt" },
    ist_standard: true,
  }]);
  assert.equal(flow.filter((item) => item.type === "ROUND_INTRO").length, 2);
  assert.equal(flow.find((item) => item.type === "WELCOME")?.config.title, "Eigener Auftakt");
});

test("formatiert die gemeinsame Fragen- und Umfragezählung mit korrektem Singular", () => {
  assert.equal(formatRoundContentCounts(8, 0), "8 Fragen");
  assert.equal(formatRoundContentCounts(8, 2), "8 Fragen · 2 Umfragen");
  assert.equal(formatRoundContentCounts(1, 1), "1 Frage · 1 Umfrage");
  assert.equal(formatRoundContentCounts(0, 2), "2 Umfragen");
  assert.equal(formatRoundContentCounts(0, 0), "0 Fragen");
});

test("aktualisiert nur persistierte Standard-Rundenintros aus dem aktuellen Blockbestand", () => {
  const quiz = quizFixture();
  const stored = [
    {
      quiz_ablauf_element_id: 100,
      typ: "ROUND_INTRO",
      anker_typ: "ROUND_START",
      anker_schluessel: "10",
      quiz_abschnitt_id: 10,
      sortierung: 10,
      ist_sichtbar: true,
      bezeichnung: null,
      konfiguration: { version: 1, title: "Runde 1", subtitle: "0 Fragen" },
      ist_standard: true,
    },
    {
      quiz_ablauf_element_id: 101,
      typ: "LIVE_POLL",
      anker_typ: "BLOCK",
      anker_schluessel: "10",
      quiz_abschnitt_id: 10,
      sortierung: 40,
      ist_sichtbar: true,
      bezeichnung: "Umfrage A",
      konfiguration: { version: 1 },
      ist_standard: false,
      live_poll: {
        version: 1,
        pollId: 1,
        pollRevisionId: 1,
        prompt: "A?",
        type: "SINGLE_CHOICE",
        publicationMode: "AUTOMATIC",
        options: [{ id: "yes", label: "Ja" }, { id: "no", label: "Nein" }],
      },
    },
    {
      quiz_ablauf_element_id: 102,
      typ: "LIVE_POLL",
      anker_typ: "BLOCK",
      anker_schluessel: "10",
      quiz_abschnitt_id: 10,
      sortierung: 41,
      ist_sichtbar: true,
      bezeichnung: "Umfrage B",
      konfiguration: { version: 1 },
      ist_standard: false,
      live_poll: {
        version: 1,
        pollId: 2,
        pollRevisionId: 2,
        prompt: "B?",
        type: "SINGLE_CHOICE",
        publicationMode: "AUTOMATIC",
        options: [{ id: "yes", label: "Ja" }, { id: "no", label: "Nein" }],
      },
    },
  ] as const;
  const intro = resolveQuizFlow(quiz, stored).find(
    (item) => item.type === "ROUND_INTRO" && item.sectionId === 10,
  );
  assert.equal(intro?.config.subtitle, "2 Fragen · 2 Umfragen");
});
