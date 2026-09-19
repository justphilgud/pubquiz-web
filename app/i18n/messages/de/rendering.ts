export const deRenderingMessages = {
  templates: {
    presentationDefault: {
      label: "ungegoogelt Neon",
      description: "Mehrfarbige Neonbühne auf Basis des offiziellen ungegoogelt-Logos.",
    },
    presentationDark: {
      label: "ungegoogelt Dunkel",
      description: "Eine ruhigere, deutlich dunklere Beamer-Variante.",
    },
    presentationCorporate: { label: "Corporate", description: "Ruhiges, professionelles Design mit klarer Hierarchie." },
    presentationBirthday: { label: "Storybook", description: "Persönliches Fotobuch-Design mit redaktioneller Bildsprache." },
    presentationEditorial: { label: "LOVD × Phil Gud", description: "Warm-reduziertes Venue-Design mit großzügiger editorialer Hierarchie." },
    presentationKommOne: { label: "Komm.ONE PubQuiz", description: "Moderne Quizbühne mit Midnight, Lagoon und gezielten Amarillo-Akzenten." },
    answerDefault: {
      label: "ungegoogelt Neon",
      description: "Das mobil optimierte Antwortformular in der neuen ungegoogelt-Farbwelt.",
    },
    answerMinimal: {
      label: "Minimal",
      description: "Reduziertes Branding mit besonders klarer Lesbarkeit.",
    },
    answerCorporate: { label: "Corporate", description: "Sachliches Antwortformular für Firmenveranstaltungen." },
    answerBirthday: { label: "Storybook", description: "Ruhiges Antwortformular im persönlichen Fotobuch-Stil." },
    answerEditorial: { label: "LOVD × Phil Gud", description: "Reduziertes Antwortformular in warmer LOVD-Eventoptik." },
    answerKommOne: { label: "Komm.ONE PubQuiz", description: "Klares Antwortformular in der Komm.ONE-Markenwelt." },
  },
  fields: {
    presentationTemplate: "Präsentationstemplate",
    answerFormTemplate: "Antwortformular-Template",
    defaultPresentation: "Standard-Präsentation",
    defaultAnswerForm: "Standard-Antwortformular",
    eventSeriesDefault: "Standard der Eventreihe",
    systemDefault: "Systemstandard",
    effectiveTemplate: "Effektives Template",
    templateSource: "Template-Quelle",
    preview: "Theme-Vorschau",
    previewButton: "Beispielbutton",
    internalOnly: "Nur intern",
    backToQuiz: "Zurück zur Quizverwaltung",
  },
  sources: {
    QUIZ: "Quiz-Override",
    EVENT_SERIES: "Eventreihen-Standard",
    SYSTEM: "Systemstandard",
  },
  validation: {
    unknownPresentation: "Das gewählte Präsentationstemplate ist nicht verfügbar.",
    unknownAnswerForm: "Das gewählte Antwortformular-Template ist nicht verfügbar.",
    fallback: "Eine unbekannte gespeicherte Template-ID wurde durch den Systemstandard ersetzt.",
  },
} as const;
