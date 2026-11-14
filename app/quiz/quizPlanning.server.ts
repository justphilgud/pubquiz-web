import "server-only";

import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";
import { resolvePresentationTemplate } from "@/app/rendering/templateResolver";
import { getPresentationTemplate } from "@/app/rendering/templateRegistry";
import { parseQuizDesignSnapshot } from "@/app/rendering/sharedDesign/sharedDesign";
import { toRuntimePresentationTemplate } from "@/app/rendering/presentationTemplates/presentationTemplate";
import { loadStoredPresentationTemplateConfigs } from "@/app/rendering/presentationTemplates/presentationTemplateRepository.server";
import { storedQuizFlowRelation, toStoredQuizFlowItem } from "./flow/quizFlowRepository.server";
import { isQuizSolutionStrategy } from "./flow/quizFlow";
import { isMemeCaptionQuestionTemplateId } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { parseMemeQuestionConfig } from "./memeCaption";
import { buildPraesentationSlides } from "./[quizId]/praesentation/buildPraesentationSlides";
import { estimateRemainingSeconds, supportsSponsorMoments } from "./presentationTiming";

const planningSelect = {
  quiz_id: true,
  titel: true,
  aufloesungsstrategie: true,
  intro_begruessungstitel: true,
  intro_begruessungstext: true,
  intro_regeln: true,
  intro_preise: true,
  intro_wartetext: true,
  intro_video_url: true,
  intro_startzeit: true,
  intro_musik_url: true,
  intro_startsequenz_text: true,
  outro_bekanntmachungen: true,
  presentation_template_id: true,
  shared_design_template_id: true,
  shared_design_snapshot: true,
  eventreihe: {
    select: { default_presentation_template_id: true, shared_design_template_id: true },
  },
  praesentation_status: { select: { quiz_started_at: true, quiz_stopped_at: true } },
  quiz_abschnitte: true,
  quiz_ablauf_elemente: storedQuizFlowRelation,
  quiz_fragen: {
    select: {
      quiz_fragen_id: true, quiz_abschnitt_id: true, sortierung: true, meme_config_json: true,
      fragen: { select: { vorlage: { select: { code: true } }, template_config_json: true } },
    },
  },
} satisfies Prisma.quizSelect;

type PlanningQuiz = Prisma.quizGetPayload<{ select: typeof planningSelect }>;

function selectedSharedDesign(quiz: PlanningQuiz) {
  const selection = quiz.shared_design_template_id;
  return selection === "INHERIT" ? quiz.eventreihe.shared_design_template_id ?? "phil-gud" : selection;
}

/** Call only with IDs from the caller's authorized quiz read. Reads no answers, teams or submissions. */
export async function loadQuizPlanningDurations(authorizedIds: readonly number[]) {
  if (!authorizedIds.length) return new Map<number, number>();
  const quizzes = await prisma.quiz.findMany({
    where: { quiz_id: { in: [...authorizedIds] } },
    select: planningSelect,
  });
  const configs = await loadStoredPresentationTemplateConfigs(quizzes.flatMap(quiz =>
    [quiz.presentation_template_id, quiz.eventreihe.default_presentation_template_id, selectedSharedDesign(quiz)]
      .filter((id): id is string => Boolean(id)),
  ));
  const customTemplates = Array.from(configs, ([id, config]) => toRuntimePresentationTemplate({ id, name: id, config }));

  return new Map(quizzes.map(quiz => {
    const selection = selectedSharedDesign(quiz);
    const started = quiz.praesentation_status?.quiz_started_at || quiz.praesentation_status?.quiz_stopped_at;
    const style = selection
      ? started
        ? parseQuizDesignSnapshot(quiz.shared_design_snapshot)?.design.config.design.stylePreset
        : getPresentationTemplate(selection)?.design.stylePreset ?? configs.get(selection)?.design.stylePreset
      : resolvePresentationTemplate({
        quizTemplateId: quiz.presentation_template_id,
        eventSeriesTemplateId: quiz.eventreihe.default_presentation_template_id,
        additionalPresentationTemplates: customTemplates,
      }).template.design.stylePreset;

    const slides = buildPraesentationSlides({
      quiz_id: quiz.quiz_id,
      titel: quiz.titel,
      intro_begruessungstitel: quiz.intro_begruessungstitel,
      intro_begruessungstext: quiz.intro_begruessungstext,
      intro_regeln: quiz.intro_regeln,
      intro_preise: quiz.intro_preise,
      intro_wartetext: quiz.intro_wartetext,
      intro_video_url: quiz.intro_video_url,
      intro_startzeit: quiz.intro_startzeit,
      intro_musik_url: quiz.intro_musik_url,
      intro_startsequenz_text: quiz.intro_startsequenz_text,
      outro_bekanntmachungen: quiz.outro_bekanntmachungen,
      sponsorMomentsEnabled: supportsSponsorMoments(style),
      aufloesungsstrategie: isQuizSolutionStrategy(quiz.aufloesungsstrategie) ? quiz.aufloesungsstrategie : undefined,
      abschnitte: quiz.quiz_abschnitte.map(section => ({
        ...section,
        aufloesungsstrategie: isQuizSolutionStrategy(section.aufloesungsstrategie) ? section.aufloesungsstrategie : null,
      })),
      ablaufElemente: quiz.quiz_ablauf_elemente.map(toStoredQuizFlowItem),
      fragen: quiz.quiz_fragen.map(assignment => {
        const templateId = assignment.fragen.vorlage?.code ?? null;
        return {
          quiz_fragen_id: assignment.quiz_fragen_id,
          quiz_abschnitt_id: assignment.quiz_abschnitt_id,
          sortierung: assignment.sortierung,
          templateId,
          templateConfig: assignment.fragen.template_config_json as QuestionTemplateConfig | null,
          memeConfig: isMemeCaptionQuestionTemplateId(templateId) ? parseMemeQuestionConfig(assignment.meme_config_json) : null,
        };
      }),
    });
    return [quiz.quiz_id, estimateRemainingSeconds(slides, {})];
  }));
}
