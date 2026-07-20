import type { WidenMessageCatalog } from "../../messageTypes";
import type { deRenderingMessages } from "../de/rendering";

export const enRenderingMessages: WidenMessageCatalog<
  typeof deRenderingMessages
> = {
  templates: {
    presentationDefault: {
      label: "ungegoogelt Default",
      description: "The established, colourful presentation design.",
    },
    presentationDark: {
      label: "ungegoogelt Dark",
      description: "A calmer and distinctly darker projector variant.",
    },
    answerDefault: {
      label: "ungegoogelt Default",
      description: "The familiar mobile-first answer form.",
    },
    answerMinimal: {
      label: "Minimal",
      description: "Reduced branding with especially clear readability.",
    },
  },
  fields: {
    presentationTemplate: "Presentation template",
    answerFormTemplate: "Answer form template",
    defaultPresentation: "Default presentation",
    defaultAnswerForm: "Default answer form",
    eventSeriesDefault: "Event series default",
    systemDefault: "System default",
    effectiveTemplate: "Effective template",
    templateSource: "Template source",
    preview: "Theme preview",
    previewButton: "Example button",
    internalOnly: "Internal only",
    backToQuiz: "Back to quiz management",
  },
  sources: {
    QUIZ: "Quiz override",
    EVENT_SERIES: "Event series default",
    SYSTEM: "System default",
  },
  validation: {
    unknownPresentation: "The selected presentation template is unavailable.",
    unknownAnswerForm: "The selected answer form template is unavailable.",
    fallback: "An unknown saved template ID was replaced with the system default.",
  },
};
