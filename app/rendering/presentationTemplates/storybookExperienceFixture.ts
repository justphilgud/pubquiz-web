import type { QuizPraesentationResult } from "@/app/quiz/actions";
import { questionTemplateIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";
import type { Slide } from "@/app/quiz/[quizId]/praesentation/buildPraesentationSlides";
import { resolvePresentationLayout } from "@/app/rendering/presentation/presentationLayoutResolver";
import type { ResolvedQuizTheme } from "@/app/rendering/theme/quizTheme";
import { resolveQuizTheme } from "@/app/rendering/theme/quizTheme";
import type { StorybookMemoryAsset } from "@/app/rendering/templateRegistry";
import {
  toRuntimeAnswerFormTemplate,
  toRuntimePresentationTemplate,
} from "./presentationTemplate";
import { createPresentationStylePreset } from "./presentationTemplatePresets";
import {
  buildStorybookExperiencePlan,
  type StorybookExperienceMoment,
  type StorybookExperiencePersonCount,
  type StorybookExperiencePlan,
  type StorybookExperienceQuestionCount,
} from "./storybookExperience";

export type StorybookExperienceRuntimeMoment = StorybookExperienceMoment & {
  slide: Slide;
  storybookContext: {
    personIds: string[];
    contentKind: "COVER" | "CHAPTER" | "TEXT" | "IMAGE" | "MULTIPLE_CHOICE" | "ORDERING" | "AUDIO";
    composition: StorybookExperienceMoment["composition"];
    preferredAssetRoles: StorybookMemoryAsset["role"][];
  };
};

export type StorybookExperienceRuntime = {
  plan: StorybookExperiencePlan;
  quiz: QuizPraesentationResult;
  theme: ResolvedQuizTheme;
  moments: StorybookExperienceRuntimeMoment[];
  slides: Slide[];
};

const PERSON_NAMES = ["Mara", "Jonas", "Lea"] as const;
const IMAGE_SOURCES = [
  "/medien/bilder/unsortiert/1778762143603-img_20140530_143045.jpg",
  "/medien/bilder/unsortiert/1778762097227-20190714_112415.jpg",
  "/medien/bilder/unsortiert/1778763271536-20220503_095407.jpg",
  "/medien/bilder/unsortiert/1778787404351-2026-4-19-12-45-27.jpg",
  "/medien/bilder/unsortiert/1778787308845-20220503_095407.jpg",
] as const;

const QUESTION_IMAGE = "bilder/unsortiert/1778762143603-img_20140530_143045.jpg";
const AUDIO_SOURCE = "audio/reverse/believe_reverse.wav";
const PIXEL_STAGE_SOURCES = [
  "storybook-experience/pixel-stage-3.svg",
  "storybook-experience/pixel-stage-2.svg",
  "storybook-experience/pixel-stage-1.svg",
] as const;

const baseTemplateConfig = {
  stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 },
  createPixelQuestionByAnswer: { answer1: false, answer2: false },
} satisfies QuestionTemplateConfig;

function answerFor(moment: StorybookExperienceMoment) {
  if (moment.questionType === "AUDIO") return "Believe von Cher";
  if (moment.questionType === "IMAGE") return "Der alte Bahnhof";
  if (moment.questionType === "PIXEL_REVEAL") return "Der alte Bahnhof";
  if (moment.questionType === "ESTIMATE") return "340 Kilometer";
  if (moment.questionType === "ORDERING") return "Bahnhof · See · Berghütte · Heimweg";
  if (moment.questionType === "TRUE_FALSE") return "Falsch";
  if (moment.questionType === "MULTIPLE_CHOICE") return "Die verpasste letzte Straßenbahn";
  if (moment.revealMode === "ANSWER_ONLY") return "Am alten Bahnhof";
  if (moment.revealMode === "QUOTE") return "„Wir dachten, der Weg sei die Abkürzung.“";
  if (moment.revealMode === "IMAGE_MEMORY") return "Der gemeinsame Sommer in Berlin";
  if (moment.beat === "LAUGHTER") return "Die verpasste letzte Straßenbahn";
  if (moment.beat === "NOSTALGIA") return "Das Wochenende am See";
  if (moment.beat === "CLIMAX" || moment.beat === "CLOSING") return "Der Tag, an dem alle zusammenkamen";
  return "Der erste gemeinsame Ausflug";
}

type ExperienceQuestion = QuizPraesentationResult["fragen"][number];
type ExperienceMedium = ExperienceQuestion["medien"][number];
type ExperienceAnswer = ExperienceQuestion["antworten"][number];

function medium(id: number, datei: string, medientyp: string, sortierung: number, bemerkung: string): ExperienceMedium {
  return { medien_id: id, datei, medientyp, sortierung, bemerkung };
}

function answer(id: number, text: string, isCorrect: boolean): ExperienceAnswer {
  return { antwort_id: id, antwort: text, ist_richtig: isCorrect, antworttyp: "Text", medien: [] };
}

function questionFixture(moment: StorybookExperienceMoment, solutionMoment: StorybookExperienceMoment) {
  const questionType = moment.questionType ?? "OPEN";
  const baseAnswerId = (moment.questionNumber ?? 1) * 10;
  const mediaId = (moment.questionNumber ?? 1) * 10;
  const common = {
    templateId: null as string | null,
    templateConfig: null as QuestionTemplateConfig | null,
    media: [] as ExperienceMedium[],
    answers: [answer(baseAnswerId + 1, answerFor(solutionMoment), true)] as ExperienceAnswer[],
    answerOrder: [baseAnswerId + 1],
    answerFields: [] as ExperienceQuestion["antwortfelder"],
    answerMode: "OPEN" as const,
  };

  if (questionType === "MULTIPLE_CHOICE") {
    common.templateId = questionTemplateIds.multipleChoice;
    common.answers = [
      answer(baseAnswerId + 1, "Die verpasste letzte Straßenbahn", true),
      answer(baseAnswerId + 2, "Ein geplatzter Fahrradreifen", false),
      answer(baseAnswerId + 3, "Das verschwundene Geburtstagsgeschenk", false),
      answer(baseAnswerId + 4, "Ein unerwarteter Regenschauer", false),
    ];
    common.answerOrder = common.answers.map((candidate) => candidate.antwort_id);
    return { ...common, answerMode: "CLOSED" as const };
  }
  if (questionType === "TRUE_FALSE") {
    common.templateId = questionTemplateIds.trueFalse;
    common.templateConfig = {
      ...baseTemplateConfig,
      templateData: { kind: "TRUE_FALSE", correctAnswer: false, explanation: "Der Zug fuhr pünktlich – verpasst wurde erst der Anschlussbus." },
    };
    common.answers = [answer(baseAnswerId + 1, "Wahr", false), answer(baseAnswerId + 2, "Falsch", true)];
    common.answerOrder = common.answers.map((candidate) => candidate.antwort_id);
    return { ...common, answerMode: "CLOSED" as const };
  }
  if (questionType === "ESTIMATE") {
    const asksForGuests = /Gäste/i.test(moment.title);
    const correctValue = asksForGuests ? 18 : 340;
    const unit = asksForGuests ? "Personen" : "Kilometern";
    common.templateId = questionTemplateIds.estimate;
    common.templateConfig = {
      ...baseTemplateConfig,
      templateData: {
        kind: "ESTIMATE",
        correctValue,
        unit,
        numberFormat: "INTEGER",
        explanation: asksForGuests
          ? "Auf diesem Bild standen am Ende tatsächlich achtzehn Menschen zusammen."
          : "Genau diese Entfernung wurde später zur festen Wochenendroute.",
        tolerance: asksForGuests ? 2 : 10,
      },
    };
    common.answers = [answer(baseAnswerId + 1, `${correctValue} ${unit}`, true)];
    return common;
  }
  if (questionType === "ORDERING") {
    common.templateId = questionTemplateIds.ordering;
    const items = [
      { id: "station-1", text: "Treffen am Bahnhof", explanation: "Dort begann der Tag." },
      { id: "station-2", text: "Mittagspause am See", explanation: "Die geplante kurze Pause dauerte zwei Stunden." },
      { id: "station-3", text: "Ankunft an der Berghütte", explanation: "Kurz vor Sonnenuntergang." },
      { id: "station-4", text: "Gemeinsamer Heimweg", explanation: "Mit einer Geschichte mehr im Gepäck." },
    ];
    common.templateConfig = { ...baseTemplateConfig, templateData: { kind: "ORDERING", items, scoring: "EXACT" } };
    common.answers = items.map((item, index) => answer(baseAnswerId + index + 1, item.text, true));
    common.answerOrder = [baseAnswerId + 3, baseAnswerId + 1, baseAnswerId + 4, baseAnswerId + 2];
    return { ...common, answerMode: "CLOSED" as const };
  }
  if (questionType === "AUDIO") {
    common.templateId = questionTemplateIds.musicReverse;
    common.media = [medium(mediaId + 1, AUDIO_SOURCE, "Audio", 1, "Kurzer Musikausschnitt für die interne Experience-Simulation")];
    return common;
  }
  if (questionType === "IMAGE") {
    common.media = [medium(mediaId + 1, QUESTION_IMAGE, "Bild", 1, "Der alte Bahnhof als Ausgangspunkt der Geschichte")];
    return common;
  }
  if (questionType === "PIXEL_REVEAL") {
    common.templateId = questionTemplateIds.pixelImage;
    common.templateConfig = baseTemplateConfig;
    common.media = PIXEL_STAGE_SOURCES.map((source, index) => medium(mediaId + index + 1, source, "Bild", index + 1, `Pixelstufe ${index + 1}`));
    return common;
  }
  if (questionType === "STRUCTURED_RESPONSE") {
    common.answers = [];
    common.answerOrder = [];
    common.answerFields = [
      { antwortfeld_id: baseAnswerId + 1, label: "Person", sortierung: 1, ist_pflicht: true, loesungen: [{ loesung_text: "Mara", sortierung: 1, ist_akzeptiert: true }] },
      { antwortfeld_id: baseAnswerId + 2, label: "Ort", sortierung: 2, ist_pflicht: true, loesungen: [{ loesung_text: "Alter Bahnhof", sortierung: 1, ist_akzeptiert: true }] },
    ];
    return common;
  }
  return common;
}

function preferredAssetRoles(moment: StorybookExperienceMoment): StorybookMemoryAsset["role"][] {
  const roles: Record<StorybookExperienceMoment["imageIntent"], StorybookMemoryAsset["role"][]> = {
    NONE: [],
    ESTABLISHING: ["GROUP", "MEMORY"],
    CHARACTER: ["PORTRAIT"],
    RELATIONSHIP: ["GROUP", "MEMORY"],
    CHRONOLOGY: ["MEMORY", "PORTRAIT"],
    REVEAL: ["SOLUTION"],
  };
  return roles[moment.imageIntent];
}

function contentKindFor(moment: StorybookExperienceMoment): StorybookExperienceRuntimeMoment["storybookContext"]["contentKind"] {
  if (moment.kind === "COVER") return "COVER";
  if (moment.kind === "CHAPTER") return "CHAPTER";
  if (moment.questionType === "AUDIO") return "AUDIO";
  if (moment.questionType === "ORDERING") return "ORDERING";
  if (moment.questionType === "MULTIPLE_CHOICE" || moment.questionType === "TRUE_FALSE") return "MULTIPLE_CHOICE";
  if (moment.questionType === "IMAGE" || moment.questionType === "PIXEL_REVEAL") return "IMAGE";
  return "TEXT";
}

function buildQuestion(moment: StorybookExperienceMoment, solutionMoment: StorybookExperienceMoment, sectionId: number) {
  const questionNumber = moment.questionNumber ?? 1;
  const fixture = questionFixture(moment, solutionMoment);
  const layoutInput = {
    templateId: fixture.templateId,
    questionText: moment.title,
    answerOptionCount: fixture.answers.length,
    structuredFieldCount: fixture.answerFields.length,
    media: fixture.media.map((entry) => ({ fileName: entry.datei, mediaType: entry.medientyp, scope: "QUESTION" as const })),
    templateData: fixture.templateConfig?.templateData,
  };
  return {
    quiz_fragen_id: questionNumber,
    quiz_abschnitt_id: sectionId,
    sortierung: questionNumber,
    fragen_id: questionNumber,
    frage: moment.title,
    templateId: fixture.templateId,
    templateConfig: fixture.templateConfig,
    punkte_modus: "standard",
    freie_antwort_erlaubt: fixture.answerMode === "OPEN",
    urspruenglicher_antwortmodus: fixture.answerMode,
    effektiver_antwortmodus: fixture.answerMode,
    quelle: "Interne Storybook-Experience-Simulation",
    kategorien: ["Erinnerung"],
    praesentationslayout: "standard",
    presentationLayouts: {
      question: resolvePresentationLayout({ ...layoutInput, phase: "QUESTION" }),
      solution: resolvePresentationLayout({ ...layoutInput, phase: "SOLUTION" }),
    },
    antwort_reihenfolge: fixture.answerOrder,
    medien: fixture.media,
    antwortfelder: fixture.answerFields,
    antworten: fixture.answers,
    bildMedien: fixture.media.filter((entry) => entry.medientyp === "Bild").map(({ medien_id, datei, medientyp }) => ({ medien_id, datei, medientyp })),
  } satisfies QuizPraesentationResult["fragen"][number];
}

function buildQuiz(plan: StorybookExperiencePlan) {
  const chapterMoments = plan.moments.filter((moment) => moment.kind === "CHAPTER");
  const questionMoments = plan.moments.filter((moment) => moment.kind === "QUESTION");
  const solutionByQuestion = new Map(plan.moments.filter((moment) => moment.kind === "SOLUTION").map((moment) => [moment.questionNumber, moment]));
  const abschnitte: QuizPraesentationResult["abschnitte"] = chapterMoments.map((chapter, index) => ({
    quiz_abschnitt_id: index + 1,
    titel: chapter.title,
    abschnitt_typ: "FRAGEN",
    sortierung: index + 1,
    dauer_sekunden: 300,
    qr_code_url: null,
    medien_datei: null,
    bemerkung: chapter.subtitle,
  }));
  const fragen = questionMoments.map((moment) => buildQuestion(moment, solutionByQuestion.get(moment.questionNumber) ?? moment, moment.chapterNumber ?? 1));
  return {
    quiz_id: 9_001,
    intro_begruessungstitel: "Unsere gemeinsame Geschichte",
    intro_begruessungstext: "Ein Abend aus Fragen, Bildern und Erinnerungen.",
    intro_regeln: "Zuhören · Erinnern · Gemeinsam lachen",
    intro_preise: "Die Geschichten, die wir wieder mit nach Hause nehmen",
    intro_logo_url: null,
    intro_musik_url: null,
    intro_wartetext: null,
    intro_video_url: null,
    intro_startzeit: null,
    intro_startsequenz_text: null,
    outro_bekanntmachungen: "Danke für all die gemeinsamen Geschichten.",
    outro_musik_url: null,
    titel: "Storybook Experience",
    quiz_datum: "2026-08-03",
    ablaufElemente: [],
    abschnitte,
    fragen,
  } satisfies QuizPraesentationResult;
}

function buildTheme(plan: StorybookExperiencePlan) {
  const config = createPresentationStylePreset("BIRTHDAY");
  const storybook = config.design.storybook;
  if (!storybook) throw new Error("Storybook preset is incomplete.");
  storybook.sharedTitle = "Unsere gemeinsame Geschichte";
  storybook.motto = "Ein Abend aus Fragen, Bildern und Erinnerungen";
  storybook.subtitle = "Nicht nur ein Quiz. Eine gemeinsame Reise.";
  storybook.people = PERSON_NAMES.slice(0, plan.personCount).map((name, index) => ({
    id: `person-${index + 1}`,
    name,
    age: null,
    subtitle: ["kennt jede gute Abkürzung", "erinnert sich an jedes Detail", "bringt alle wieder zusammen"][index] ?? null,
    portrait: IMAGE_SOURCES[index],
  }));
  const assets: StorybookMemoryAsset[] = [];
  storybook.people.forEach((person, personIndex) => {
    for (let imageIndex = 0; imageIndex < 3; imageIndex += 1) {
      const sourceIndex = (personIndex + imageIndex) % IMAGE_SOURCES.length;
      assets.push({
        id: `person-${personIndex + 1}-memory-${imageIndex + 1}`,
        source: IMAGE_SOURCES[sourceIndex],
        role: imageIndex === 0 ? "PORTRAIT" : "MEMORY",
        personIds: [person.id],
        alt: `${PERSON_NAMES[personIndex]} in einer gemeinsamen Erinnerung`,
        caption: ["Der Anfang einer langen Geschichte", "Ein ungeplanter Nachmittag", "Ein Wiedersehen, das alle brauchten"][imageIndex],
        year: ["2012", "2017", "2023"][imageIndex],
        order: assets.length,
      });
    }
  });
  assets.push({
    id: "group-establishing",
    source: IMAGE_SOURCES[3],
    role: "GROUP",
    personIds: storybook.people.map((person) => person.id),
    alt: "Die Gruppe am Beginn ihrer gemeinsamen Geschichte",
    caption: "Bevor aus einzelnen Momenten eine gemeinsame Geschichte wurde",
    year: "2014",
    order: assets.length,
  });
  for (let index = 0; index < 4; index += 1) {
    assets.push({
      id: `experience-solution-${index + 1}`,
      source: IMAGE_SOURCES[(index + 1) % IMAGE_SOURCES.length],
      role: "SOLUTION",
      personIds: storybook.people.map((person) => person.id),
      alt: "Gemeinsamer Erinnerungsmoment",
      caption: ["Der Tag, über den heute noch gesprochen wird", "Eine Reise, die anders endete als geplant", "Aus einem Zufall wurde eine Tradition", "Was von diesem Abend bleibt"][index],
      year: ["2016", "2019", "2022", "2026"][index],
      order: assets.length,
    });
  }
  storybook.assets = assets;
  storybook.anecdotes = [
    { id: "rain-story", text: "An diesem Abend hatte niemand einen Regenschirm – aber alle dieselbe Geschichte.", personIds: storybook.people.map((person) => person.id), year: "2016" },
    { id: "train-story", text: "Der verpasste Zug wurde später zum Anfang des besten Wochenendes.", personIds: storybook.people.map((person) => person.id), year: "2019" },
    { id: "closing-story", text: "Aus vielen kleinen Augenblicken wurde etwas, das bis heute trägt.", personIds: storybook.people.map((person) => person.id), year: "Heute" },
  ];
  storybook.chapters = plan.moments.filter((moment) => moment.kind === "CHAPTER").map((chapter, index) => ({
    id: `experience-chapter-${index + 1}`,
    title: chapter.title,
    subtitle: chapter.subtitle,
    personIds: storybook.people.map((person) => person.id),
    order: index,
  }));

  const managed = { id: "internal-storybook-experience", name: "Storybook Experience", config };
  return resolveQuizTheme({
    displayName: "Unsere gemeinsame Geschichte",
    presentation: {
      template: toRuntimePresentationTemplate(managed),
      source: "QUIZ",
      requestedId: managed.id,
      usedFallback: false,
    },
    answerForm: {
      template: toRuntimeAnswerFormTemplate(managed),
      source: "QUIZ",
      requestedId: managed.id,
      usedFallback: false,
    },
  });
}

export function buildStorybookExperienceRuntime(input: {
  questionCount: StorybookExperienceQuestionCount;
  personCount: StorybookExperiencePersonCount;
}): StorybookExperienceRuntime {
  const plan = buildStorybookExperiencePlan(input);
  const quiz = buildQuiz(plan);
  const theme = buildTheme(plan);
  const questionByNumber = new Map(quiz.fragen.map((question) => [question.fragen_id, question]));
  const sectionByNumber = new Map(quiz.abschnitte.map((section, index) => [index + 1, section]));
  const moments: StorybookExperienceRuntimeMoment[] = plan.moments.map((moment) => {
    const section = sectionByNumber.get(moment.chapterNumber ?? 1) ?? quiz.abschnitte[0];
    const question = moment.questionNumber === null ? null : questionByNumber.get(moment.questionNumber) ?? null;
    const coverQuestion = moment.kind === "COVER" ? buildQuestion(moment, moment, 1) : null;
    const slide: Slide = moment.kind === "COVER"
      ? { typ: "frage", abschnitt: section, frage: coverQuestion ?? quiz.fragen[0], frageIndexImBlock: 1, fragenAnzahlImBlock: 1 }
      : moment.kind === "CHAPTER"
        ? { typ: "block", abschnitt: section }
        : moment.kind === "QUESTION" && question
          ? { typ: "frage", abschnitt: section, frage: question, frageIndexImBlock: ((moment.questionNumber ?? 1) - 1) % 10 + 1, fragenAnzahlImBlock: 10 }
          : question
            ? { typ: "aufloesung", abschnitt: section, frage: question, frageIndexImBlock: ((moment.questionNumber ?? 1) - 1) % 10 + 1, fragenAnzahlImBlock: 10 }
            : { typ: "fixer-slide", slideTyp: "begruessung" };
    return {
      ...moment,
      slide,
      storybookContext: {
        personIds: moment.personSlots.map((slot) => theme.design.storybook?.people[slot]?.id).filter((id): id is string => Boolean(id)),
        contentKind: contentKindFor(moment),
        composition: moment.composition,
        preferredAssetRoles: preferredAssetRoles(moment),
      },
    };
  });
  return { plan, quiz, theme, moments, slides: moments.map((moment) => moment.slide) };
}
