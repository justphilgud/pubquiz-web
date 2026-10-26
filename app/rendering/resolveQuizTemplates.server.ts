import { resolveSharedDesign } from "./sharedDesign/sharedDesignRepository.server";
import { parseSharedDesign } from "./sharedDesign/sharedDesign";
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
import {
  getManagedPresentationTemplate,
  loadStoredPresentationTemplateConfigs,
} from "./presentationTemplates/presentationTemplateRepository.server";

export async function resolveQuizTemplates(quizId: number) {
  const quiz = await prisma.quiz.findUnique({
    where: { quiz_id: quizId },
    select: {
      titel: true,
      presentation_template_id: true,
      answer_form_template_id: true, shared_design_template_id: true, shared_design_snapshot: true, praesentation_status: {select:{quiz_started_at:true,quiz_stopped_at:true}},
      eventreihe: {
        select: {
          name: true,
          default_presentation_template_id: true,
          default_answer_form_template_id:true, shared_design_template_id:true,logo_url:true,

        },
      },
    },
  });

  if (!quiz) return null;

  const requestedTemplateIds = [
    quiz.presentation_template_id,
    quiz.eventreihe.default_presentation_template_id,
    quiz.answer_form_template_id, quiz.eventreihe.default_answer_form_template_id,
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

  let presentation = resolvePresentationTemplate({
      quizTemplateId: quiz.presentation_template_id,
      eventSeriesTemplateId:
        quiz.eventreihe.default_presentation_template_id,
      additionalPresentationTemplates,
    });
  const answerForm = resolveAnswerFormTemplate({
      quizTemplateId: quiz.shared_design_template_id ? quiz.answer_form_template_id : quiz.presentation_template_id,
      eventSeriesTemplateId: quiz.shared_design_template_id ? quiz.eventreihe.default_answer_form_template_id : quiz.eventreihe.default_presentation_template_id,
      additionalAnswerFormTemplates,
    });
  if (quiz.shared_design_template_id) {
    const started=Boolean(quiz.praesentation_status?.quiz_started_at||quiz.praesentation_status?.quiz_stopped_at);
    const snapshot=parseSharedDesign(quiz.shared_design_snapshot);
    if(started&&!snapshot)throw new Error("Gemeinsamer Design-Snapshot fehlt oder ist ungültig.");
    const resolved=started?{design:snapshot!,source:"Spielauswahl"}:await prisma.$transaction(tx=>resolveSharedDesign(tx,quiz.shared_design_template_id,quiz.eventreihe));
    presentation={template:toRuntimePresentationTemplate({id:resolved.design.templateId,name:resolved.design.name,config:resolved.design.config}),source:resolved.source==='Reihenstandard'?'EVENT_SERIES':resolved.source==='Systemstandard'?'SYSTEM':'QUIZ',requestedId:quiz.shared_design_template_id,usedFallback:false};
  }
  const managedPresentation = await getManagedPresentationTemplate(
    presentation.template.id,
  );

  return {
    presentation,
    answerForm,
    theme: resolveQuizTheme({
      displayName: quiz.titel ?? `Quiz ${quizId}`,
      presentation,
      answerForm,
    }),
    presentationInfo: {
      id: presentation.template.id,
      name:
        managedPresentation?.name ??
        presentation.template.displayName ??
        presentation.template.id,
      status: managedPresentation?.status ?? "SYSTEM",
      isSystem: managedPresentation?.isSystem ?? true,
      source: presentation.source,
      eventSeriesName: quiz.eventreihe.name,
      usedFallback: presentation.usedFallback,
    },
  };
}
