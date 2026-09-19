import type { QuizPraesentationResult } from "@/app/quiz/actions";
import type { QuizFlowItemType } from "@/app/quiz/flow/quizFlow";
import { DEFAULT_BOOKING } from "@/app/quiz/bookingSlide";
import { questionTemplateIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import type { Slide } from "@/app/quiz/[quizId]/praesentation/buildPraesentationSlides";
import type { PresentationDesignStyle } from "@/app/rendering/templateRegistry";
import { resolveQuizTheme } from "@/app/rendering/theme/quizTheme";
import { buildStorybookExperienceRuntime } from "../presentationTemplates/storybookExperienceFixture";
import { createPresentationStylePreset } from "../presentationTemplates/presentationTemplatePresets";
import { toRuntimeAnswerFormTemplate, toRuntimePresentationTemplate } from "../presentationTemplates/presentationTemplate";
import { resolvePresentationLayout } from "./presentationLayoutResolver";
import type { PresentationSlideDisplayState } from "./PresentationSlideRenderer";

export const qualityScenarios = ["short", "normal", "long", "legacy", "choice2", "choice3", "choice4", "choice6", "choice-long", "choice-mixed", "true-false", "estimate", "image-long", "structured-audio", "structured-empty", "ordering", "story", "story-legacy", "poll", "solution-long", "pixel", "qr", "rules", "rules-legacy", "intro", "lovd-intro", "lovd-countdown", "lovd-ranking", "lovd-final", "lovd-outro", "booking", "sponsor-open", "sponsor-choice", "sponsor-intro"] as const;
export const qualityRules = ["Teamname wählen", "Antworten rechtzeitig absenden", "Keine Suchmaschinen verwenden", "Die Entscheidung der Moderation gilt"];
export type QualityScenario = typeof qualityScenarios[number];
export const longQuestion = "Welche europäische Hauptstadt wird gesucht? Sie liegt an einem Fluss, war über viele Jahrzehnte politisch geteilt und wurde nach der Wiedervereinigung erneut zum Regierungssitz. Nennt die Stadt, in der heute auch das Brandenburger Tor und der Deutsche Bundestag zu finden sind.";
export const longOptions = [
  "Berlin: Die Stadt an der Spree war jahrzehntelang geteilt und ist heute Sitz des Deutschen Bundestages sowie der Bundesregierung.",
  "Wien: Die österreichische Hauptstadt an der Donau ist bekannt für ihre Kaffeehauskultur und die historischen Residenzen der Habsburger.",
  "Prag: Die tschechische Hauptstadt an der Moldau verbindet ihre mittelalterliche Altstadt mit der berühmten Karlsbrücke und der Burg.",
  "Budapest: Die ungarische Hauptstadt entstand aus mehreren Städten und liegt mit ihren historischen Stadtteilen an beiden Ufern der Donau.",
];
export const storyText = "Als wir am frühen Morgen am Bahnhof ankamen, war der Bahnsteig noch fast leer. Nur der kleine Kiosk hatte bereits geöffnet. Wir kauften Kaffee, verglichen unsere Fahrkarten und bemerkten erst dann, dass wir auf unterschiedlichen Seiten des Flusses übernachten würden. Aus dem kleinen Planungsfehler wurde ein gemeinsamer Spaziergang durch die Stadt. Am Abend saßen alle wieder an einem Tisch und erzählten von den Orten, die sie unterwegs entdeckt hatten. Die ungeplanten Umwege blieben uns länger in Erinnerung als das eigentliche Ziel der Reise.";

export function buildPresentationQualityFixture(scenario: QualityScenario, style: PresentationDesignStyle = "NEON") {
  const base = buildStorybookExperienceRuntime({ questionCount: 30, personCount: 1 });
  const original = scenario.startsWith("structured") ? base.quiz.fragen.find((q) => q.antwortfelder.length > 0)! : scenario === "pixel" ? base.quiz.fragen.find((q) => q.templateId === "pixelbild")! : scenario === "ordering" ? base.quiz.fragen.find((q) => q.templateId === "reihenfolge")! : base.quiz.fragen[0];
  const question: QuizPraesentationResult["fragen"][number] = structuredClone(original);
  if (!["pixel", "ordering"].includes(scenario) && !scenario.startsWith("structured")) {
    question.templateId = null;
    question.templateConfig = null;
    question.antwortfelder = [];
    question.medien = [];
    question.bildMedien = [];
    question.antworten = [{ antwort_id: 1, antwort: "Berlin", ist_richtig: true, antworttyp: "Text", medien: [] }];
    question.effektiver_antwortmodus = "OPEN";
  }
  question.frage = scenario === "short" ? "Wie heißt die Hauptstadt von Deutschland?" : scenario === "legacy" ? `${longQuestion} ${longQuestion} ${longQuestion}` : ["long", "image-long", "solution-long"].includes(scenario) ? longQuestion : "Welche dieser Städte ist heute die Hauptstadt von Deutschland?";
  if (scenario === "ordering" || scenario === "pixel") question.frage = original.frage;
  if (scenario === "ordering") {
    question.antworten = ["Ankommen am Bahnhof", "Spaziergang durch die Stadt", "Gemeinsames Abendessen", "Rückfahrt nach Hause"].map((antwort, index) => ({ antwort_id: index + 1, antwort, ist_richtig: true, antworttyp: "Text", medien: [] }));
  }
  if (scenario.startsWith("choice")) {
    question.templateId = "multiple_choice";
    question.effektiver_antwortmodus = "CLOSED";
    const labels = scenario === "choice-long" ? longOptions : scenario === "choice-mixed" ? ["Berlin", longOptions[1], "Prag", longOptions[3]] : ["Berlin", "Wien", "Prag", "Budapest", "Paris", "Rom"].slice(0, Number(scenario.at(-1)));
    question.antworten = labels.map((antwort, index) => ({ antwort_id: index + 1, antwort, ist_richtig: index === 0, antworttyp: "Text", medien: [] }));
  }
  if (scenario === "true-false") {
    question.templateId = questionTemplateIds.trueFalse;
    question.templateConfig = {
      stageDurationsSeconds: { stage3: 15, stage2: 15, stage1: 15 },
      createPixelQuestionByAnswer: { answer1: false, answer2: false },
      templateData: { kind: "TRUE_FALSE", correctAnswer: true, explanation: "Komm.ONE ist die gemeinsame IT-Dienstleisterin für den kommunalen Bereich in Baden-Württemberg." },
    };
    question.effektiver_antwortmodus = "CLOSED";
    question.antworten = [
      { antwort_id: 1, antwort: "Wahr", ist_richtig: true, antworttyp: "Text", medien: [] },
      { antwort_id: 2, antwort: "Falsch", ist_richtig: false, antworttyp: "Text", medien: [] },
    ];
    question.frage = "Wahr oder falsch: Digitale Verwaltungsleistungen können Kommunen gemeinsam bereitstellen.";
  }
  if (scenario === "estimate") {
    question.templateId = questionTemplateIds.estimate;
    question.templateConfig = {
      stageDurationsSeconds: { stage3: 15, stage2: 15, stage1: 15 },
      createPixelQuestionByAnswer: { answer1: false, answer2: false },
      templateData: { kind: "ESTIMATE", correctValue: 1101, unit: "Kommunen", numberFormat: "INTEGER", explanation: "Baden-Württemberg zählt 1.101 Städte und Gemeinden.", tolerance: 25 },
    };
    question.frage = "Wie viele Städte und Gemeinden gibt es in Baden-Württemberg?";
    question.antworten[0].antwort = "1.101 Kommunen";
  }
  question.antwort_reihenfolge = scenario === "ordering"
    ? [3, 1, 4, 2]
    : question.antworten.map((answer) => answer.antwort_id);
  if (scenario === "image-long") {
    question.frage = "Welcher Wolkenkratzer ist auf diesem Bild zu sehen? Das Gebäude steht in der Hauptstadt Taiwans und gehörte bei seiner Eröffnung zu den höchsten Bauwerken der Welt. Seine gestuften Abschnitte erinnern an Bambus. Nennt den Namen dieses bekannten Wahrzeichens.";
    question.antworten[0].antwort = "Taipei 101";
    question.medien = [{ medien_id: 1, datei: "bilder/wahrzeichen/taipei-101_standard.jpg", medientyp: "Bild", sortierung: 1, bemerkung: "Taipei 101 – Bildbeispiel für Text und Medium" }];
  }
  if (scenario.startsWith("structured")) {
    question.templateId = null;
    question.templateConfig = null;
    question.frage = "Welcher Song wurde hier rückwärts abgespielt? Nennt Interpret und Titel.";
    question.antwortfelder = question.antwortfelder.map((field, index) => ({ ...field, label: index === 0 ? "Interpret" : "Titel" }));
    question.medien = scenario === "structured-empty" ? [] : [{ medien_id: 42, datei: "audio/unsortiert/Test.wav", medientyp: "Audio", sortierung: 1, bemerkung: null }];
  }
  if (scenario === "solution-long") question.antworten[0].antwort = longOptions[0] + " Seit dem Umzug aus Bonn finden die Sitzungen des Parlaments im Reichstagsgebäude statt.";
  const layoutInput = { templateId: question.templateId, questionText: question.frage, answerOptionCount: question.effektiver_antwortmodus === "CLOSED" ? question.antworten.length : 0, structuredFieldCount: question.antwortfelder.length, media: question.medien.map((m) => ({ fileName: m.datei, mediaType: m.medientyp, scope: "QUESTION" as const })), templateData: question.templateConfig?.templateData };
  question.presentationLayouts = { question: resolvePresentationLayout({ ...layoutInput, phase: "QUESTION" }), solution: resolvePresentationLayout({ ...layoutInput, phase: "SOLUTION" }) };
  let slide: Slide = { typ: scenario === "solution-long" ? "aufloesung" : "frage", abschnitt: null, frage: question, frageIndexImBlock: 1, fragenAnzahlImBlock: 1 };
  if (scenario.startsWith("story") || scenario === "poll") slide = {
    typ: "ablauf", abschnitt: null, element: { id: "quality-story", persistentId: null, type: scenario === "poll" ? "LIVE_POLL" : "TEXT", anchorType: "BEFORE_QUIZ", anchorKey: "global", sectionId: null, order: 1, enabled: true, label: "AP5 Referenz", config: { version: 1, title: "Ein unerwarteter Umweg", body: scenario === "story-legacy" ? `${storyText}\n\n${storyText}\n\n${storyText}` : storyText }, configVersion: 1, questionAssignmentId: null, isStandard: false },
  };
  const managed = { id: "internal-presentation-quality", name: "AP5 Präsentationsreferenz", config: createPresentationStylePreset(style) };
  if (scenario === "qr") slide = {
    typ: "ablauf", abschnitt: null, element: { id: "quality-qr", persistentId: null, type: "QR_CODE", anchorType: "BEFORE_QUIZ", anchorKey: "QUIZ", sectionId: null, order: 1, enabled: true, label: "Teambeitritt", config: { version: 1, title: "Jetzt mitspielen", body: "QR-Code scannen und Team anmelden." }, configVersion: 1, questionAssignmentId: null, isStandard: true },
  };
  const theme = resolveQuizTheme({ displayName: "AP5 Präsentationsreferenz", presentation: { template: toRuntimePresentationTemplate(managed), source: "QUIZ", requestedId: managed.id, usedFallback: false }, answerForm: { template: toRuntimeAnswerFormTemplate(managed), source: "QUIZ", requestedId: managed.id, usedFallback: false } });
  if (scenario.startsWith("rules")) slide = {
    typ: "ablauf", abschnitt: null, element: { id: "quality-rules", persistentId: null, type: "RULES", anchorType: "BEFORE_QUIZ", anchorKey: "QUIZ", sectionId: null, order: 1, enabled: true, label: "Regeln", config: { version: 1, title: "Die Spielregeln", rules: (scenario === "rules-legacy" ? Array.from({ length: 8 }, (_, index) => `${qualityRules[index % 4]}. ${storyText}`) : qualityRules).map((text, index) => ({ id: String(index), text, enabled: true })) }, configVersion: 1, questionAssignmentId: null, isStandard: true },
  };
  const displayState: PresentationSlideDisplayState = { renderMode: "DESIGN_PREVIEW", templateRevealCount: 1, punktestand: [], intermediateStandings: [], endstandRevealCount: 0, now: Date.UTC(2026, 8, 7, 20), estimationPhase: "HIDDEN", schaetzfrage: null, isSchaetzfrageLoading: false, remoteCountdownDauerSekunden: null, remoteCountdownStartedAt: null, remoteCountdownStatus: null, mediaOverlayActive: false, playbackCommand: null, playbackCommandId: 0,
    livePollState: scenario === "poll" ? { revision: "fixture", runId: 1, pollRevisionId: 1, state: "OPEN", type: "SINGLE_CHOICE", prompt: "Welches Angebot würdet ihr für unseren nächsten gemeinsamen Quizabend bevorzugen?", publicationMode: "AUTOMATIC", totalResponses: 12, options: ["Eine gemischte Runde mit Fragen zu Musik, Geografie und überraschenden Alltagsgeschichten", "Ein Themenabend mit zusätzlichen Bildern und kurzen Hörbeispielen aus verschiedenen Jahrzehnten", "Ein entspannter Abend mit mehr Zeit für Diskussionen und kleinen Pausen zwischen den Runden"].map((label, index) => ({ id: String(index), label, count: 4, share: 100 / 3 })), publicResponses: [] } : null,
  };
  if (scenario === "sponsor-open" || scenario === "sponsor-choice" || scenario === "sponsor-intro") {
    question.templateConfig = { stageDurationsSeconds: { stage3: 15, stage2: 15, stage1: 15 }, createPixelQuestionByAnswer: { answer1: false, answer2: false }, sponsor: { logo: "/branding/sponsors/placeholder.svg", line: "Präsentiert von" } };
    if (scenario === "sponsor-choice") {
      question.effektiver_antwortmodus = "CLOSED";
      question.antworten = ["Berlin", "Wien", "Prag", "Paris"].map((antwort, index) => ({ antwort_id: index + 1, antwort, ist_richtig: index === 0, antworttyp: "Text", medien: [] }));
      question.antwort_reihenfolge = [1, 2, 3, 4];
      question.presentationLayouts = { question: resolvePresentationLayout({ ...layoutInput, answerOptionCount: 4, phase: "QUESTION" }), solution: resolvePresentationLayout({ ...layoutInput, answerOptionCount: 4, phase: "SOLUTION" }) };
    }
  }
  const flowTypes: Partial<Record<QualityScenario, QuizFlowItemType>> = { "intro": "WELCOME", "lovd-intro": "WAITING", "lovd-countdown": "COUNTDOWN", "lovd-ranking": "INTERMEDIATE_STANDINGS", "lovd-final": "FINAL_STANDINGS", "lovd-outro": "CLOSING", "booking": "BOOKING_CONTACT", "sponsor-intro": "IMAGE" };
  const flowType = flowTypes[scenario];
  if (flowType) {
    slide = { typ: "ablauf", abschnitt: null, element: { id: `flow:${scenario}`, persistentId: null, type: flowType, anchorType: "BEFORE_QUIZ", anchorKey: "QUIZ", sectionId: null, order: 1, enabled: true, label: scenario, config: { version: 1, title: scenario === "sponsor-intro" ? "Diese Frage wird präsentiert von" : scenario === "lovd-outro" ? "Danke fürs Mitspielen" : scenario === "intro" ? "Komm.ONE PubQuiz" : "PubQuiz", ...(scenario === "intro" ? { subtitle: "Kommunal. Digital. Gemeinsam.", body: "Wissen teilen, gemeinsam rätseln und einen guten Abend erleben." } : {}), ...(scenario === "sponsor-intro" ? { imageUrl: "/branding/sponsors/placeholder.svg", altText: "Austauschbares Sponsorlogo – Platzhalter" } : {}), ...(scenario === "booking" ? { booking: DEFAULT_BOOKING } : {}), durationSeconds: 60, showCountdown: true }, configVersion: 1, questionAssignmentId: null, isStandard: false } };
    displayState.punktestand = [{ teamname: "Die Wissbegierigen", punkte: 42 }, { teamname: "Kaffee & Köpfe", punkte: 38 }, { teamname: "Abendrunde", punkte: 36 }];
    displayState.intermediateStandings = displayState.punktestand.map((team, index) => ({ key: `fixture-${index}`, place: index + 1, punkte: team.punkte }));
    displayState.endstandRevealCount = 3;
  }
  if (scenario === "sponsor-intro" && slide.typ === "ablauf" && (style === "EDITORIAL" || style === "KOMM_ONE")) {
    slide.presentationRole = { kind: "SPONSOR", questionAssignmentId: question.quiz_fragen_id };
    slide.element.config = { version: 1, title: question.templateConfig!.sponsor!.line, imageUrl: question.templateConfig!.sponsor!.logo };
  }
  return { quiz: { ...base.quiz, sponsorMomentsEnabled: style === "EDITORIAL" || style === "KOMM_ONE", titel: "Präsentationsreferenz", fragen: [question] }, slide, slides: [slide], slideIndex: 0, slideLabel: scenario === "intro" ? "Willkommen" : scenario === "lovd-intro" ? "VOR DEM START" : scenario === "sponsor-intro" ? "Partner" : scenario === "lovd-countdown" ? "Countdown" : scenario === "lovd-ranking" ? "Zwischenstand" : scenario === "lovd-final" ? "Endstand" : scenario === "lovd-outro" ? "Zum Abschluss" : scenario === "booking" ? "Buchung" : scenario === "qr" ? "Teambeitritt" : scenario === "solution-long" ? "Auflösung" : scenario.startsWith("story") ? "Geschichte" : scenario === "poll" ? "Umfrage" : "Frage", theme, displayState };
}
