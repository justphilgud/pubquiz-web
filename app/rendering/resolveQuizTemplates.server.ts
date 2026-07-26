import "server-only";

import { prisma } from "@/app/lib/prisma";
import {
  resolveAnswerFormTemplate,
  resolvePresentationTemplate,
} from "./templateResolver";
import { resolveQuizTheme } from "./theme/quizTheme";

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

  const presentation = resolvePresentationTemplate({
      quizTemplateId: quiz.presentation_template_id,
      eventSeriesTemplateId:
        quiz.eventreihe.default_presentation_template_id,
    });
  const answerForm = resolveAnswerFormTemplate({
      quizTemplateId: quiz.answer_form_template_id,
      eventSeriesTemplateId: quiz.eventreihe.default_answer_form_template_id,
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
