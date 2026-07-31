import "server-only";

import { prisma } from "@/app/lib/prisma";
import {
  resolveAnswerFormTemplate,
  resolvePresentationTemplate,
} from "./templateResolver";
import { resolveQuizTheme } from "./theme/quizTheme";
import {
  toRuntimeAnswerFormTemplate,
  toRuntimePresentationTemplate,
} from "./presentationTemplates/presentationTemplate";
import { loadStoredPresentationTemplateConfigs } from "./presentationTemplates/presentationTemplateRepository.server";

export async function resolveQuizTemplates(quizId: number) {
  const quiz = await prisma.quiz.findUnique({
    where: { quiz_id: quizId },
    select: {
      titel: true,
      intro_logo_url: true,
      presentation_template_id: true,
      answer_form_template_id: true,
      eventreihe: {
        select: {
          default_presentation_template_id: true,
          default_answer_form_template_id: true,
        },
      },
    },
  });

  if (!quiz) return null;

  const requestedTemplateIds = [
    quiz.presentation_template_id,
    quiz.answer_form_template_id,
    quiz.eventreihe.default_presentation_template_id,
    quiz.eventreihe.default_answer_form_template_id,
  ].filter((id): id is string => Boolean(id));
  const storedConfigs = await loadStoredPresentationTemplateConfigs(
    requestedTemplateIds,
  );
  const storedTemplates = Array.from(storedConfigs, ([id, config]) => ({
    id,
    name: id,
    config,
  }));
  const additionalPresentationTemplates = storedTemplates.map(
    toRuntimePresentationTemplate,
  );
  const additionalAnswerFormTemplates = storedTemplates.map(
    toRuntimeAnswerFormTemplate,
  );

  const presentation = resolvePresentationTemplate({
      quizTemplateId: quiz.presentation_template_id,
      eventSeriesTemplateId:
        quiz.eventreihe.default_presentation_template_id,
      additionalPresentationTemplates,
    });
  const answerForm = resolveAnswerFormTemplate({
      quizTemplateId: quiz.answer_form_template_id,
      eventSeriesTemplateId: quiz.eventreihe.default_answer_form_template_id,
      additionalAnswerFormTemplates,
    });

  return {
    presentation,
    answerForm,
    theme: resolveQuizTheme({
      displayName: quiz.titel ?? `Quiz ${quizId}`,
      logoUrl: quiz.intro_logo_url,
      presentation,
      answerForm,
    }),
  };
}
