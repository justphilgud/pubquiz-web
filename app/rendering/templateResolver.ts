import {
  SYSTEM_ANSWER_FORM_TEMPLATE_ID,
  SYSTEM_PRESENTATION_TEMPLATE_ID,
  getAnswerFormTemplate,
  getPresentationTemplate,
  type AnswerFormTemplate,
  type PresentationTemplate,
  type TemplateSource,
} from "./templateRegistry";

export type ResolvedTemplate<T> = {
  template: T;
  source: TemplateSource;
  requestedId: string | null;
  usedFallback: boolean;
};

type ResolveInput = {
  quizTemplateId?: string | null;
  eventSeriesTemplateId?: string | null;
};

export function resolvePresentationTemplate(
  input: ResolveInput,
): ResolvedTemplate<PresentationTemplate> {
  const quizTemplate = getPresentationTemplate(input.quizTemplateId);
  if (quizTemplate) {
    return {
      template: quizTemplate,
      source: "QUIZ",
      requestedId: input.quizTemplateId ?? null,
      usedFallback: false,
    };
  }

  const eventSeriesTemplate = getPresentationTemplate(
    input.eventSeriesTemplateId,
  );
  if (eventSeriesTemplate) {
    return {
      template: eventSeriesTemplate,
      source: "EVENT_SERIES",
      requestedId: input.eventSeriesTemplateId ?? null,
      usedFallback: Boolean(input.quizTemplateId),
    };
  }

  return {
    template: getPresentationTemplate(SYSTEM_PRESENTATION_TEMPLATE_ID)!,
    source: "SYSTEM",
    requestedId:
      input.quizTemplateId ?? input.eventSeriesTemplateId ?? null,
    usedFallback: Boolean(
      input.quizTemplateId || input.eventSeriesTemplateId,
    ),
  };
}

export function resolveAnswerFormTemplate(
  input: ResolveInput,
): ResolvedTemplate<AnswerFormTemplate> {
  const quizTemplate = getAnswerFormTemplate(input.quizTemplateId);
  if (quizTemplate) {
    return {
      template: quizTemplate,
      source: "QUIZ",
      requestedId: input.quizTemplateId ?? null,
      usedFallback: false,
    };
  }

  const eventSeriesTemplate = getAnswerFormTemplate(
    input.eventSeriesTemplateId,
  );
  if (eventSeriesTemplate) {
    return {
      template: eventSeriesTemplate,
      source: "EVENT_SERIES",
      requestedId: input.eventSeriesTemplateId ?? null,
      usedFallback: Boolean(input.quizTemplateId),
    };
  }

  return {
    template: getAnswerFormTemplate(SYSTEM_ANSWER_FORM_TEMPLATE_ID)!,
    source: "SYSTEM",
    requestedId:
      input.quizTemplateId ?? input.eventSeriesTemplateId ?? null,
    usedFallback: Boolean(
      input.quizTemplateId || input.eventSeriesTemplateId,
    ),
  };
}
