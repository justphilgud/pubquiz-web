export const INTRO_SLIDES = [
  {
    id: "waiting",
    legacyRoute: "vor-dem-start",
    title: "Wartebildschirm",
    description: "Video, Beginn-Uhrzeit und Wartetext",
  },
  {
    id: "countdown",
    legacyRoute: "startsequenz",
    title: "Countdown bis zum Start",
    description: "Musik und Countdowntext",
  },
  {
    id: "welcome",
    legacyRoute: "begruessung",
    title: "Begrüßung",
    description: "Quizname und Willkommensgruß",
  },
  {
    id: "rules",
    legacyRoute: "regeln",
    title: "Regeln",
    description: "Quizregeln und Ablauf",
  },
  {
    id: "prizes",
    legacyRoute: "preise",
    title: "Preise",
    description: "Preise für Platz 1 bis 3",
  },
] as const;

export type IntroSlideId = (typeof INTRO_SLIDES)[number]["id"];

export const OUTRO_SLIDES = [
  {
    id: "announcements",
    title: "Bekanntmachungen",
    description: "Hinweise, Termine, Abschlussinformationen und Musik",
  },
  {
    id: "calendar",
    title: "PubQuiz-Kalender",
    description: "Allgemeinen öffentlichen Kalender per QR-Code abonnieren",
  },
] as const;

export type OutroSlideId = (typeof OUTRO_SLIDES)[number]["id"];

export const FIXED_SLIDE_FLOW_TYPES = {
  waiting: "WAITING",
  countdown: "START_SEQUENCE",
  welcome: "WELCOME",
  rules: "RULES",
  prizes: "PRIZES",
  announcements: "CLOSING",
  calendar: "CALENDAR_SUBSCRIPTION",
} as const;

export type FixedSlideId = keyof typeof FIXED_SLIDE_FLOW_TYPES;

export function isOutroSlideId(value: string | undefined): value is OutroSlideId {
  return OUTRO_SLIDES.some((slide) => slide.id === value);
}

export type FixedSlideStatus = "configured" | "notice";

export function isIntroSlideId(value: string | undefined): value is IntroSlideId {
  return INTRO_SLIDES.some((slide) => slide.id === value);
}

function normalizePrizeText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

export function parsePrizeSlots(value: string | null | undefined) {
  const lines = (value ?? "").replace(/\r\n?/g, "\n").split("\n");

  return Array.from({ length: 3 }, (_, index) =>
    normalizePrizeText(lines[index] ?? ""),
  );
}

export function serializePrizeSlots(values: readonly string[]) {
  const slots = Array.from({ length: 3 }, (_, index) =>
    normalizePrizeText(values[index] ?? ""),
  );

  return slots.some(Boolean) ? slots.join("\n") : "";
}

type IntroStatusSource = {
  intro_video_url?: string | null;
  intro_startzeit?: string | null;
  intro_musik_url?: string | null;
  intro_startsequenz_text?: string | null;
  intro_begruessungstitel?: string | null;
  intro_begruessungstext?: string | null;
  intro_regeln?: string | null;
  intro_preise?: string | null;
};

export function getIntroSlideStatus(
  slideId: IntroSlideId,
  quiz: IntroStatusSource,
): FixedSlideStatus {
  switch (slideId) {
    case "waiting":
      return quiz.intro_video_url?.trim() || quiz.intro_startzeit?.trim()
        ? "configured"
        : "notice";
    case "countdown":
      return quiz.intro_musik_url?.trim() ||
        quiz.intro_startsequenz_text?.trim()
        ? "configured"
        : "notice";
    case "welcome":
      return quiz.intro_begruessungstitel?.trim() ||
        quiz.intro_begruessungstext?.trim()
        ? "configured"
        : "notice";
    case "rules":
      return quiz.intro_regeln?.trim() ? "configured" : "notice";
    case "prizes":
      return parsePrizeSlots(quiz.intro_preise).some(Boolean)
        ? "configured"
        : "notice";
  }
}
