import type { QuizPraesentationResult } from "@/app/quiz/actions";
import type { Slide } from "@/app/quiz/[quizId]/praesentation/buildPraesentationSlides";
import type { PresentationDesignStyle } from "@/app/rendering/templateRegistry";
import { resolveQuizTheme } from "@/app/rendering/theme/quizTheme";
import { buildStorybookExperienceRuntime } from "../presentationTemplates/storybookExperienceFixture";
import { createPresentationStylePreset } from "../presentationTemplates/presentationTemplatePresets";
import { toRuntimeAnswerFormTemplate, toRuntimePresentationTemplate } from "../presentationTemplates/presentationTemplate";
import { resolvePresentationLayout } from "./presentationLayoutResolver";
import type { PresentationSlideDisplayState } from "./PresentationSlideRenderer";

export const qualityScenarios = ["short", "normal", "long", "legacy", "choice2", "choice3", "choice4", "choice6", "choice-long", "choice-mixed", "image-long", "structured-audio", "structured-empty", "ordering", "story", "story-legacy", "poll", "solution-long", "pixel"] as const;
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
  if (scenario.startsWith("choice")) {
    question.templateId = "multiple_choice";
    question.effektiver_antwortmodus = "CLOSED";
    const labels = scenario === "choice-long" ? longOptions : scenario === "choice-mixed" ? ["Berlin", longOptions[1], "Prag", longOptions[3]] : ["Berlin", "Wien", "Prag", "Budapest", "Paris", "Rom"].slice(0, Number(scenario.at(-1)));
    question.antworten = labels.map((antwort, index) => ({ antwort_id: index + 1, antwort, ist_richtig: index === 0, antworttyp: "Text", medien: [] }));
  }
  question.antwort_reihenfolge = question.antworten.map((answer) => answer.antwort_id);
  if (scenario === "image-long") question.medien = [{ medien_id: 1, datei: "bilder/wahrzeichen/taipei-101_standard.jpg", medientyp: "Bild", sortierung: 1, bemerkung: "Taipei 101 – Bildbeispiel für Text und Medium" }];
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
  const theme = resolveQuizTheme({ displayName: "AP5 Präsentationsreferenz", presentation: { template: toRuntimePresentationTemplate(managed), source: "QUIZ", requestedId: managed.id, usedFallback: false }, answerForm: { template: toRuntimeAnswerFormTemplate(managed), source: "QUIZ", requestedId: managed.id, usedFallback: false } });
  const displayState: PresentationSlideDisplayState = { renderMode: "DESIGN_PREVIEW", templateRevealCount: 1, punktestand: [], intermediateStandings: [], endstandRevealCount: 0, now: Date.UTC(2026, 8, 7, 20), estimationPhase: "HIDDEN", schaetzfrage: null, isSchaetzfrageLoading: false, remoteCountdownDauerSekunden: null, remoteCountdownStartedAt: null, remoteCountdownStatus: null, mediaOverlayActive: false, playbackCommand: null, playbackCommandId: 0,
    livePollState: scenario === "poll" ? { revision: "fixture", runId: 1, pollRevisionId: 1, state: "OPEN", type: "SINGLE_CHOICE", prompt: "Welches Angebot würdet ihr für unseren nächsten gemeinsamen Quizabend bevorzugen?", publicationMode: "AUTOMATIC", totalResponses: 12, options: ["Eine gemischte Runde mit Fragen zu Musik, Geografie und überraschenden Alltagsgeschichten", "Ein Themenabend mit zusätzlichen Bildern und kurzen Hörbeispielen aus verschiedenen Jahrzehnten", "Ein entspannter Abend mit mehr Zeit für Diskussionen und kleinen Pausen zwischen den Runden"].map((label, index) => ({ id: String(index), label, count: 4, share: 100 / 3 })), publicResponses: [] } : null,
  };
  return { quiz: { ...base.quiz, titel: "AP5 Präsentationsreferenz", fragen: [question] }, slide, slides: [slide], slideIndex: 0, slideLabel: scenario === "solution-long" ? "Auflösung" : scenario.startsWith("story") ? "Geschichte" : scenario === "poll" ? "Umfrage" : "Frage", theme, displayState };
}
