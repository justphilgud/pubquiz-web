import type { StorybookCompositionVariant } from "./storybookComposition";

export const STORYBOOK_EXPERIENCE_QUESTION_COUNTS = [30, 40, 60] as const;
export const STORYBOOK_EXPERIENCE_PERSON_COUNTS = [1, 2, 3] as const;
export const STORYBOOK_EXPERIENCE_QUESTION_TYPES = [
  "OPEN",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "ESTIMATE",
  "ORDERING",
  "AUDIO",
  "IMAGE",
  "PIXEL_REVEAL",
  "STRUCTURED_RESPONSE",
] as const;

export type StorybookExperienceQuestionCount = (typeof STORYBOOK_EXPERIENCE_QUESTION_COUNTS)[number];
export type StorybookExperiencePersonCount = (typeof STORYBOOK_EXPERIENCE_PERSON_COUNTS)[number];
export type StorybookExperienceQuestionType = (typeof STORYBOOK_EXPERIENCE_QUESTION_TYPES)[number];

export type StorybookStoryBeat =
  | "INTRO"
  | "WARM_UP"
  | "CONNECTION"
  | "SURPRISE"
  | "LAUGHTER"
  | "NOSTALGIA"
  | "CLIMAX"
  | "CLOSING";

export type StorybookExperienceMomentKind = "COVER" | "CHAPTER" | "QUESTION" | "SOLUTION";
export type StorybookImageIntent = "NONE" | "ESTABLISHING" | "CHARACTER" | "RELATIONSHIP" | "CHRONOLOGY" | "REVEAL";
export type StorybookRevealMode = "NONE" | "ANSWER_ONLY" | "ANSWER_WITH_CONTEXT" | "QUOTE" | "IMAGE_MEMORY";

export type StorybookExperienceMoment = {
  id: string;
  kind: StorybookExperienceMomentKind;
  composition: StorybookCompositionVariant;
  beat: StorybookStoryBeat;
  title: string;
  subtitle: string | null;
  questionNumber: number | null;
  questionType: StorybookExperienceQuestionType | null;
  chapterNumber: number | null;
  personSlots: number[];
  imageIntent: StorybookImageIntent;
  revealMode: StorybookRevealMode;
  intensity: 1 | 2 | 3 | 4 | 5;
  durationSeconds: number;
};

export type StorybookExperienceReview = {
  totalMoments: number;
  totalSeconds: number;
  compositionCounts: Record<StorybookCompositionVariant, number>;
  beatCounts: Record<StorybookStoryBeat, number>;
  questionTypeCounts: Record<StorybookExperienceQuestionType, number>;
  memoryQuestions: number[];
  memoryQuestionGaps: number[];
  chapterRanges: { chapterNumber: number; firstQuestion: number; lastQuestion: number; title: string }[];
  longestCompositionRun: number;
  longestQuestionTypeRun: number;
  personExposure: number[];
  quietMomentShare: number;
  visualMomentShare: number;
  issues: string[];
};

export type StorybookExperiencePlan = {
  questionCount: StorybookExperienceQuestionCount;
  personCount: StorybookExperiencePersonCount;
  moments: StorybookExperienceMoment[];
  review: StorybookExperienceReview;
};

type ChapterProfile = {
  title: string;
  subtitle: string;
  beats: readonly StorybookStoryBeat[];
};

const CHAPTER_PROFILES: readonly ChapterProfile[] = [
  {
    title: "Wo alles begann",
    subtitle: "Ein leichter Einstieg in vertraute Geschichten",
    beats: ["WARM_UP", "WARM_UP", "CONNECTION", "WARM_UP", "LAUGHTER", "CONNECTION", "WARM_UP", "LAUGHTER", "CONNECTION", "WARM_UP"],
  },
  {
    title: "Die ersten Abenteuer",
    subtitle: "Orte, Menschen und die ersten gemeinsamen Umwege",
    beats: ["CONNECTION", "WARM_UP", "LAUGHTER", "CONNECTION", "SURPRISE", "LAUGHTER", "CONNECTION", "SURPRISE", "LAUGHTER", "CONNECTION"],
  },
  {
    title: "Ungeplante Geschichten",
    subtitle: "Die Momente, die damals niemand geplant hatte",
    beats: ["LAUGHTER", "SURPRISE", "CONNECTION", "LAUGHTER", "SURPRISE", "LAUGHTER", "NOSTALGIA", "SURPRISE", "LAUGHTER", "CONNECTION"],
  },
  {
    title: "Was uns verbindet",
    subtitle: "Erinnerungen, die mit den Jahren wichtiger wurden",
    beats: ["CONNECTION", "NOSTALGIA", "CONNECTION", "NOSTALGIA", "SURPRISE", "CONNECTION", "NOSTALGIA", "LAUGHTER", "NOSTALGIA", "CONNECTION"],
  },
  {
    title: "Die großen Momente",
    subtitle: "Bilder und Geschichten mit besonderem Gewicht",
    beats: ["SURPRISE", "CONNECTION", "CLIMAX", "NOSTALGIA", "SURPRISE", "CLIMAX", "CONNECTION", "CLIMAX", "NOSTALGIA", "SURPRISE"],
  },
  {
    title: "Was bleibt",
    subtitle: "Ein gemeinsamer Blick auf die Geschichte hinter dem Quiz",
    beats: ["CONNECTION", "NOSTALGIA", "SURPRISE", "NOSTALGIA", "CLIMAX", "CONNECTION", "CLIMAX", "NOSTALGIA", "CLIMAX", "CLOSING"],
  },
];

const CHAPTER_ARCS: Record<StorybookExperienceQuestionCount, readonly number[]> = {
  30: [0, 3, 5],
  40: [0, 2, 4, 5],
  60: [0, 1, 2, 3, 4, 5],
};

const QUESTION_COMPOSITION_ARC: readonly StorybookCompositionVariant[] = [
  "EDITORIAL",
  "PORTRAIT",
  "SPLIT",
  "EDITORIAL",
  "PORTRAIT",
  "SEQUENCE",
  "EDITORIAL",
  "SPLIT",
  "PORTRAIT",
  "EDITORIAL",
];

const QUESTION_TYPE_ARCS: readonly (readonly StorybookExperienceQuestionType[])[] = [
  ["OPEN", "MULTIPLE_CHOICE", "IMAGE", "TRUE_FALSE", "OPEN", "ORDERING", "AUDIO", "MULTIPLE_CHOICE", "STRUCTURED_RESPONSE", "ESTIMATE"],
  ["MULTIPLE_CHOICE", "IMAGE", "OPEN", "TRUE_FALSE", "ESTIMATE", "MULTIPLE_CHOICE", "ORDERING", "PIXEL_REVEAL", "OPEN", "STRUCTURED_RESPONSE"],
  ["OPEN", "TRUE_FALSE", "IMAGE", "MULTIPLE_CHOICE", "STRUCTURED_RESPONSE", "ORDERING", "ESTIMATE", "MULTIPLE_CHOICE", "IMAGE", "OPEN"],
  ["MULTIPLE_CHOICE", "OPEN", "IMAGE", "TRUE_FALSE", "ORDERING", "AUDIO", "MULTIPLE_CHOICE", "ESTIMATE", "STRUCTURED_RESPONSE", "OPEN"],
  ["MULTIPLE_CHOICE", "IMAGE", "OPEN", "TRUE_FALSE", "ESTIMATE", "ORDERING", "OPEN", "PIXEL_REVEAL", "MULTIPLE_CHOICE", "STRUCTURED_RESPONSE"],
  ["MULTIPLE_CHOICE", "OPEN", "IMAGE", "TRUE_FALSE", "STRUCTURED_RESPONSE", "ORDERING", "ESTIMATE", "MULTIPLE_CHOICE", "IMAGE", "OPEN"],
];

const COMPOSITIONS: readonly StorybookCompositionVariant[] = ["COVER", "CHAPTER", "EDITORIAL", "PORTRAIT", "SPLIT", "SEQUENCE", "MEMORY"];
const BEATS: readonly StorybookStoryBeat[] = ["INTRO", "WARM_UP", "CONNECTION", "SURPRISE", "LAUGHTER", "NOSTALGIA", "CLIMAX", "CLOSING"];

function rotate<T>(values: readonly T[], offset: number) {
  if (values.length < 2) return [...values];
  const start = ((offset % values.length) + values.length) % values.length;
  return [...values.slice(start), ...values.slice(0, start)];
}

function imageIntentFor(composition: StorybookCompositionVariant): StorybookImageIntent {
  const intents: Record<StorybookCompositionVariant, StorybookImageIntent> = {
    COVER: "ESTABLISHING",
    CHAPTER: "NONE",
    EDITORIAL: "NONE",
    PORTRAIT: "CHARACTER",
    SPLIT: "RELATIONSHIP",
    SEQUENCE: "CHRONOLOGY",
    MEMORY: "REVEAL",
  };
  return intents[composition];
}

function intensityFor(beat: StorybookStoryBeat, composition: StorybookCompositionVariant, kind: StorybookExperienceMomentKind): 1 | 2 | 3 | 4 | 5 {
  if (kind === "COVER" || kind === "CHAPTER") return 2;
  const beatIntensities: Record<StorybookStoryBeat, 1 | 2 | 3 | 4 | 5> = {
    INTRO: 2,
    WARM_UP: 2,
    CONNECTION: 3,
    SURPRISE: 4,
    LAUGHTER: 4,
    NOSTALGIA: 3,
    CLIMAX: 5,
    CLOSING: 5,
  };
  const beatIntensity = beatIntensities[beat];
  if (kind === "QUESTION" && (beat === "CLIMAX" || beat === "CLOSING")) return 4;
  if (composition === "MEMORY") return Math.min(5, beatIntensity + 1) as 3 | 4 | 5;
  if (kind === "SOLUTION" && composition === "EDITORIAL") return Math.max(1, beatIntensity - 1) as 1 | 2 | 3 | 4;
  if (kind === "SOLUTION") return Math.min(5, beatIntensity + 1) as 2 | 3 | 4 | 5;
  return beatIntensity;
}

function personSlotsFor(
  composition: StorybookCompositionVariant,
  personCount: StorybookExperiencePersonCount,
  cursor: number,
  exposure: readonly number[],
) {
  const all = Array.from({ length: personCount }, (_, index) => index);
  if (["COVER", "CHAPTER", "MEMORY"].includes(composition)) return { slots: all, nextCursor: cursor };
  if (composition === "EDITORIAL") return { slots: [], nextCursor: cursor };
  const tieOrder = rotate(all, cursor);
  const ranked = [...tieOrder].sort((left, right) => exposure[left] - exposure[right] || tieOrder.indexOf(left) - tieOrder.indexOf(right));
  if (composition === "PORTRAIT") return { slots: ranked.slice(0, 1), nextCursor: cursor + 1 };
  if (composition === "SPLIT") return { slots: personCount === 1 ? [0] : ranked.slice(0, 2), nextCursor: cursor + 1 };
  return { slots: rotate(all, cursor), nextCursor: cursor + 1 };
}

function questionTitle(questionNumber: number, beat: StorybookStoryBeat, questionType: StorybookExperienceQuestionType) {
  const typeQuestions: Record<Exclude<StorybookExperienceQuestionType, "OPEN">, readonly string[]> = {
    MULTIPLE_CHOICE: ["Welche Erinnerung gehört zu diesem Sommer?", "Was passierte an diesem Abend wirklich?"],
    TRUE_FALSE: ["Wahr oder falsch: Der erste gemeinsame Urlaub begann mit einem verpassten Zug.", "Wahr oder falsch: Dieses Foto entstand noch vor Sonnenaufgang."],
    ESTIMATE: ["Wie viele Kilometer lagen zwischen Aufbruch und Wiedersehen?", "Wie viele Gäste standen am Ende gemeinsam auf diesem Bild?"],
    ORDERING: ["Bringt diese vier Stationen in die richtige Reihenfolge.", "Wie verlief dieser Tag vom ersten bis zum letzten Moment?"],
    AUDIO: ["Welcher Song lief in diesem Moment?", "Welche Erinnerung beginnt mit diesen ersten Tönen?"],
    IMAGE: ["An welchem Ort entstand dieses Bild?", "Welche Geschichte gehört zu diesem Foto?"],
    PIXEL_REVEAL: ["Welche Erinnerung verbirgt sich hinter diesem Bild?", "Wer erkennt diesen Ort, bevor das Bild klar wird?"],
    STRUCTURED_RESPONSE: ["Nennt die Person und den Ort dieser Geschichte.", "Welche zwei Details machen diese Erinnerung vollständig?"],
  };
  if (questionType !== "OPEN") {
    const candidates = typeQuestions[questionType];
    return candidates[(questionNumber - 1) % candidates.length];
  }
  const subjects: Record<Exclude<StorybookStoryBeat, "INTRO">, string[]> = {
    WARM_UP: ["Welche kleine Gewohnheit kennt hier wirklich jeder?", "Wo begann diese Geschichte?"],
    CONNECTION: ["Welcher Moment brachte alle an einen Tisch?", "Was verbindet diese Menschen bis heute?"],
    SURPRISE: ["Welche unerwartete Wendung kam danach?", "Womit hatte an diesem Tag niemand gerechnet?"],
    LAUGHTER: ["Welche Panne wurde später zur besten Geschichte?", "Wer musste darüber zuerst lachen?"],
    NOSTALGIA: ["Was fühlt sich auf diesem Bild sofort wieder vertraut an?", "Welche Zeit klingt in dieser Erinnerung nach?"],
    CLIMAX: ["Welcher Augenblick veränderte die gemeinsame Geschichte?", "Was machte diesen Tag unvergesslich?"],
    CLOSING: ["Was bleibt von all diesen gemeinsamen Jahren?", "Welche Erinnerung nehmen wir heute mit?"],
  };
  const candidates = subjects[beat === "INTRO" ? "WARM_UP" : beat];
  return candidates[(questionNumber - 1) % candidates.length];
}

function questionDurationSeconds(
  questionType: StorybookExperienceQuestionType,
  composition: StorybookCompositionVariant,
) {
  const durations: Record<StorybookExperienceQuestionType, number> = {
    OPEN: composition === "EDITORIAL" ? 46 : 52,
    MULTIPLE_CHOICE: 32,
    TRUE_FALSE: 28,
    ESTIMATE: 50,
    ORDERING: 52,
    AUDIO: 58,
    IMAGE: 48,
    PIXEL_REVEAL: 58,
    STRUCTURED_RESPONSE: 50,
  };
  return durations[questionType];
}

function revealModeFor(localQuestion: number, featuredMemory: boolean): StorybookRevealMode {
  if (featuredMemory) return "IMAGE_MEMORY";
  if (localQuestion === 2 || localQuestion === 7) return "ANSWER_ONLY";
  if (localQuestion === 5) return "QUOTE";
  return "ANSWER_WITH_CONTEXT";
}

function solutionDurationSeconds(
  beat: StorybookStoryBeat,
  revealMode: StorybookRevealMode,
  questionType: StorybookExperienceQuestionType,
) {
  if (beat === "CLOSING") return 34;
  if (revealMode === "IMAGE_MEMORY") return 30;
  if (beat === "CLIMAX") return 28;
  if (questionType === "PIXEL_REVEAL") return 30;
  if (questionType === "ESTIMATE" || questionType === "ORDERING") return 22;
  if (questionType === "AUDIO" || questionType === "IMAGE") return 20;
  if (questionType === "MULTIPLE_CHOICE" || questionType === "TRUE_FALSE") return 14;
  if (revealMode === "QUOTE") return 24;
  if (beat === "NOSTALGIA") return 22;
  if (revealMode === "ANSWER_ONLY") return 14;
  return 18;
}

function solutionCopy(
  beat: StorybookStoryBeat,
  featuredMemory: boolean,
  questionType: StorybookExperienceQuestionType,
) {
  if (beat === "CLOSING") {
    return {
      title: "Was von all dem bleibt",
      subtitle: "Ein gemeinsames Bild als letzter, offener Nachklang",
    };
  }
  if (beat === "CLIMAX") {
    return {
      title: "Der Moment hinter der Antwort",
      subtitle: "Die Auflösung wird zum emotionalen Höhepunkt der Geschichte",
    };
  }
  if (featuredMemory) {
    return {
      title: "Die Geschichte hinter der Antwort",
      subtitle: "Ein Moment, der mehr erzählt als nur die richtige Lösung",
    };
  }
  const typeCopy: Partial<Record<StorybookExperienceQuestionType, { title: string; subtitle: string | null }>> = {
    AUDIO: { title: "Der Klang hinter der Erinnerung", subtitle: "Erkennen wird zu einem gemeinsamen Wiederhören" },
    ESTIMATE: { title: "Die Zahl hinter der Geschichte", subtitle: "Die Schätzung löst sich in einen konkreten Moment auf" },
    ORDERING: { title: "So geschah es wirklich", subtitle: "Die einzelnen Stationen ergeben wieder eine Geschichte" },
    PIXEL_REVEAL: { title: "Jetzt wird das Bild klar", subtitle: "Aus einer Vermutung wird eine gemeinsame Erinnerung" },
    STRUCTURED_RESPONSE: { title: "Erst zusammen wird es vollständig", subtitle: "Beide Details tragen die richtige Antwort" },
  };
  if (typeCopy[questionType]) return typeCopy[questionType];
  return { title: "Die Auflösung", subtitle: null };
}

function climaxSolutionComposition(
  questionComposition: StorybookCompositionVariant,
  nextQuestionComposition: StorybookCompositionVariant | null,
) {
  const visualResolutions = ["PORTRAIT", "SPLIT", "SEQUENCE"] as const;
  return visualResolutions.find((composition) => composition !== questionComposition && composition !== nextQuestionComposition) ?? "PORTRAIT";
}

function longestCompositionRun(moments: readonly StorybookExperienceMoment[]) {
  let longest = 0;
  let current = 0;
  let previous: StorybookCompositionVariant | null = null;
  for (const moment of moments) {
    current = moment.composition === previous ? current + 1 : 1;
    previous = moment.composition;
    longest = Math.max(longest, current);
  }
  return longest;
}

function longestQuestionTypeRun(moments: readonly StorybookExperienceMoment[]) {
  const questions = moments.filter((moment) => moment.kind === "QUESTION");
  let longest = 0;
  let current = 0;
  let previous: StorybookExperienceQuestionType | null = null;
  for (const question of questions) {
    current = question.questionType === previous ? current + 1 : 1;
    previous = question.questionType;
    longest = Math.max(longest, current);
  }
  return longest;
}

export function reviewStorybookExperience(
  moments: readonly StorybookExperienceMoment[],
  questionCount: StorybookExperienceQuestionCount,
  personCount: StorybookExperiencePersonCount,
): StorybookExperienceReview {
  const compositionCounts = Object.fromEntries(COMPOSITIONS.map((composition) => [composition, 0])) as Record<StorybookCompositionVariant, number>;
  const beatCounts = Object.fromEntries(BEATS.map((beat) => [beat, 0])) as Record<StorybookStoryBeat, number>;
  const questionTypeCounts = Object.fromEntries(STORYBOOK_EXPERIENCE_QUESTION_TYPES.map((questionType) => [questionType, 0])) as Record<StorybookExperienceQuestionType, number>;
  const personExposure = Array.from({ length: personCount }, () => 0);
  const memoryQuestions: number[] = [];
  for (const moment of moments) {
    compositionCounts[moment.composition] += 1;
    beatCounts[moment.beat] += 1;
    if (moment.kind === "QUESTION" && moment.questionType) questionTypeCounts[moment.questionType] += 1;
    if (moment.composition === "MEMORY" && moment.questionNumber !== null) memoryQuestions.push(moment.questionNumber);
    if (["PORTRAIT", "SPLIT", "SEQUENCE", "MEMORY", "COVER"].includes(moment.composition)) {
      for (const personSlot of moment.personSlots) personExposure[personSlot] += 1;
    }
  }
  const chapterMoments = moments.filter((moment) => moment.kind === "CHAPTER");
  const chapterRanges = chapterMoments.map((chapter, index) => ({
    chapterNumber: index + 1,
    firstQuestion: index * 10 + 1,
    lastQuestion: Math.min(questionCount, (index + 1) * 10),
    title: chapter.title,
  }));
  const memoryQuestionGaps = memoryQuestions.slice(1).map((question, index) => question - memoryQuestions[index]);
  const issues = validateStorybookExperience(moments, questionCount, personCount);
  const quietMoments = moments.filter((moment) => moment.composition === "EDITORIAL" || moment.composition === "CHAPTER").length;
  const visualMoments = moments.filter((moment) => ["COVER", "PORTRAIT", "SPLIT", "SEQUENCE", "MEMORY"].includes(moment.composition)).length;
  return {
    totalMoments: moments.length,
    totalSeconds: moments.reduce((total, moment) => total + moment.durationSeconds, 0),
    compositionCounts,
    beatCounts,
    questionTypeCounts,
    memoryQuestions,
    memoryQuestionGaps,
    chapterRanges,
    longestCompositionRun: longestCompositionRun(moments),
    longestQuestionTypeRun: longestQuestionTypeRun(moments),
    personExposure,
    quietMomentShare: quietMoments / moments.length,
    visualMomentShare: visualMoments / moments.length,
    issues,
  };
}

export function validateStorybookExperience(
  moments: readonly StorybookExperienceMoment[],
  questionCount: StorybookExperienceQuestionCount,
  personCount: StorybookExperiencePersonCount,
) {
  const issues: string[] = [];
  if (moments[0]?.composition !== "COVER") issues.push("Der Abend beginnt nicht mit einem Cover.");
  if (moments.at(-1)?.composition !== "MEMORY" || moments.at(-1)?.beat !== "CLOSING") issues.push("Der Abend endet nicht mit einer gemeinsamen Erinnerung.");
  for (const composition of COMPOSITIONS) {
    if (!moments.some((moment) => moment.composition === composition)) issues.push(`${composition} fehlt im Abendbogen.`);
  }
  const questions = moments.filter((moment) => moment.kind === "QUESTION");
  const solutions = moments.filter((moment) => moment.kind === "SOLUTION");
  if (questions.length !== questionCount || solutions.length !== questionCount) issues.push("Fragen und Auflösungen bilden keinen vollständigen Abend.");
  for (const questionType of STORYBOOK_EXPERIENCE_QUESTION_TYPES) {
    if (!questions.some((moment) => moment.questionType === questionType)) issues.push(`${questionType} fehlt im Fragentyp-Rhythmus.`);
  }
  if (longestQuestionTypeRun(moments) > 1) issues.push("Gleiche Fragentypen bilden einen monotonen Fragenblock.");
  const accentQuestions = questions.filter((moment) => moment.questionType === "AUDIO" || moment.questionType === "PIXEL_REVEAL");
  if (accentQuestions.some((moment, index) => index > 0 && (moment.questionNumber ?? 0) - (accentQuestions[index - 1].questionNumber ?? 0) < 8)) {
    issues.push("Audio- und Reveal-Akzente liegen zu dicht beieinander.");
  }
  const chapters = moments.filter((moment) => moment.kind === "CHAPTER");
  if (chapters.length !== questionCount / 10) issues.push("Kapitel teilen den Abend nicht in sinnvolle Zehnerbögen.");
  const memoryQuestions = moments.filter((moment) => moment.composition === "MEMORY").map((moment) => moment.questionNumber).filter((value): value is number => value !== null);
  if (memoryQuestions.slice(1).some((question, index) => question - memoryQuestions[index] < 5)) issues.push("Erinnerungsmomente liegen zu dicht beieinander.");
  for (let index = 1; index < moments.length; index += 1) {
    const previous = moments[index - 1];
    const current = moments[index];
    if (previous.composition === "MEMORY" && current.composition === "MEMORY") issues.push("Zwei emotionale Erinnerungsmomente folgen direkt aufeinander.");
    if (previous.composition === "PORTRAIT" && current.composition === "PORTRAIT") issues.push("Zwei Porträts folgen direkt aufeinander.");
    if (previous.composition === "SEQUENCE" && current.composition === "SEQUENCE") issues.push("Zwei Sequenzen folgen direkt aufeinander.");
  }
  if (longestCompositionRun(moments) > 2) issues.push("Eine Komposition wiederholt sich zu lange ohne Rhythmuswechsel.");
  const reviewExposure = Array.from({ length: personCount }, (_, slot) => moments.filter((moment) => moment.personSlots.includes(slot) && ["PORTRAIT", "SPLIT", "SEQUENCE", "MEMORY", "COVER"].includes(moment.composition)).length);
  if (Math.max(...reviewExposure) - Math.min(...reviewExposure) > 1) issues.push("Die Personen erhalten über den Abend keine gleichwertige Bildpräsenz.");
  return [...new Set(issues)];
}

export function buildStorybookExperiencePlan(input: {
  questionCount: StorybookExperienceQuestionCount;
  personCount: StorybookExperiencePersonCount;
}): StorybookExperiencePlan {
  const { questionCount, personCount } = input;
  if (!STORYBOOK_EXPERIENCE_QUESTION_COUNTS.includes(questionCount)) throw new Error("Unsupported Storybook experience length.");
  if (!STORYBOOK_EXPERIENCE_PERSON_COUNTS.includes(personCount)) throw new Error("Unsupported Storybook person count.");

  const moments: StorybookExperienceMoment[] = [{
    id: "cover",
    kind: "COVER",
    composition: "COVER",
    beat: "INTRO",
    title: "Unsere gemeinsame Geschichte",
    subtitle: "Ein Abend aus Fragen, Bildern und Erinnerungen",
    questionNumber: null,
    questionType: null,
    chapterNumber: null,
    personSlots: Array.from({ length: personCount }, (_, index) => index),
    imageIntent: "ESTABLISHING",
    revealMode: "NONE",
    intensity: 2,
    durationSeconds: 18,
  }];
  const chapterArc = CHAPTER_ARCS[questionCount];
  let visualFocusCursor = 0;
  const visualFocusExposure = Array.from({ length: personCount }, () => 0);

  chapterArc.forEach((profileIndex, chapterIndex) => {
    const profile = CHAPTER_PROFILES[profileIndex];
    const chapterNumber = chapterIndex + 1;
    moments.push({
      id: `chapter-${chapterNumber}`,
      kind: "CHAPTER",
      composition: "CHAPTER",
      beat: profile.beats[0],
      title: profile.title,
      subtitle: profile.subtitle,
      questionNumber: null,
      questionType: null,
      chapterNumber,
      personSlots: Array.from({ length: personCount }, (_, index) => index),
      imageIntent: "NONE",
      revealMode: "NONE",
      intensity: 2,
      durationSeconds: 12,
    });

    for (let localQuestion = 1; localQuestion <= 10; localQuestion += 1) {
      const questionNumber = chapterIndex * 10 + localQuestion;
      const beat = profile.beats[localQuestion - 1];
      const questionType = QUESTION_TYPE_ARCS[chapterIndex % QUESTION_TYPE_ARCS.length][localQuestion - 1];
      const composition = QUESTION_COMPOSITION_ARC[(localQuestion - 1 + chapterIndex * 2) % QUESTION_COMPOSITION_ARC.length];
      const questionPeople = personSlotsFor(composition, personCount, visualFocusCursor, visualFocusExposure);
      visualFocusCursor = questionPeople.nextCursor;
      for (const personSlot of questionPeople.slots) visualFocusExposure[personSlot] += 1;
      moments.push({
        id: `question-${questionNumber}`,
        kind: "QUESTION",
        composition,
        beat,
        title: questionTitle(questionNumber, beat, questionType),
        subtitle: null,
        questionNumber,
        questionType,
        chapterNumber,
        personSlots: questionPeople.slots,
        imageIntent: imageIntentFor(composition),
        revealMode: "NONE",
        intensity: intensityFor(beat, composition, "QUESTION"),
        durationSeconds: questionDurationSeconds(questionType, composition),
      });

      const isLastChapter = chapterIndex === chapterArc.length - 1;
      const featuredMemory = localQuestion === 4 || (!isLastChapter && localQuestion === 9) || (isLastChapter && localQuestion === 10);
      const nextQuestionComposition = localQuestion < 10
        ? QUESTION_COMPOSITION_ARC[(localQuestion + chapterIndex * 2) % QUESTION_COMPOSITION_ARC.length]
        : null;
      const solutionComposition: StorybookCompositionVariant = featuredMemory
        ? "MEMORY"
        : beat === "CLIMAX"
          ? climaxSolutionComposition(composition, nextQuestionComposition)
        : composition === "EDITORIAL"
          ? nextQuestionComposition === "PORTRAIT" ? "SPLIT" : "PORTRAIT"
          : "EDITORIAL";
      const solutionPeople = personSlotsFor(solutionComposition, personCount, visualFocusCursor, visualFocusExposure);
      visualFocusCursor = solutionPeople.nextCursor;
      for (const personSlot of solutionPeople.slots) visualFocusExposure[personSlot] += 1;
      const solutionBeat = isLastChapter && localQuestion === 10 ? "CLOSING" : beat;
      const revealMode = revealModeFor(localQuestion, featuredMemory);
      const copy = solutionCopy(solutionBeat, featuredMemory, questionType);
      moments.push({
        id: `solution-${questionNumber}`,
        kind: "SOLUTION",
        composition: solutionComposition,
        beat: solutionBeat,
        title: copy.title,
        subtitle: copy.subtitle,
        questionNumber,
        questionType,
        chapterNumber,
        personSlots: solutionPeople.slots,
        imageIntent: imageIntentFor(solutionComposition),
        revealMode,
        intensity: intensityFor(solutionBeat, solutionComposition, "SOLUTION"),
        durationSeconds: solutionDurationSeconds(solutionBeat, revealMode, questionType),
      });
    }
  });

  return {
    questionCount,
    personCount,
    moments,
    review: reviewStorybookExperience(moments, questionCount, personCount),
  };
}
