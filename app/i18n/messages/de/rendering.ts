export const deRenderingMessages = {
  templates: {
    presentationDefault: {
      label: "ungegoogelt Standard",
      description: "Das bisherige farbstarke Präsentationsdesign.",
    },
    presentationDark: {
      label: "ungegoogelt Dunkel",
      description: "Eine ruhigere, deutlich dunklere Beamer-Variante.",
    },
    presentationCorporate: { label: "Corporate", description: "Ruhiges, professionelles Design mit klarer Hierarchie." },
    presentationBirthday: { label: "Geburtstag", description: "Persönliches, bildbetontes Design mit festlichen Elementen." },
    answerDefault: {
      label: "ungegoogelt Standard",
      description: "Das vertraute, mobil optimierte Antwortformular.",
    },
    answerMinimal: {
      label: "Minimal",
      description: "Reduziertes Branding mit besonders klarer Lesbarkeit.",
    },
    answerCorporate: { label: "Corporate", description: "Sachliches Antwortformular für Firmenveranstaltungen." },
    answerBirthday: { label: "Geburtstag", description: "Persönlich gebrandetes Antwortformular." },
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
