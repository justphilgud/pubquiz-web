import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { getQuestionEditorCapabilities, requireQuestionEditor } from "@/app/lib/permissions";
import { QuestionEditor } from "../components/QuestionEditor";
import { loadQuestionForEditor } from "../questionEditorData";
import type { QuestionEditorContext } from "../types";
import { getMediaUploadEnvironmentPrefix } from "../mediaUploadEnvironment";
import { getDefaultLocale } from "@/app/i18n/locale";
import { getQuestionEditorMessages } from "@/app/i18n/getMessages";
import { localizeQuestionTemplates } from "../templates/questionTemplates";
import { loadDynamicQuestionTemplates } from "../templates/dynamicQuestionTemplates.server";
import { getAssignableQuestionEventSeries, getQuestionActor } from "../questionAccess.server";
import {
  canApproveScopedQuestion,
  canCloneScopedQuestion,
  canEditScopedQuestion,
  canRequestChangesForScopedQuestion,
  canViewScopedQuestion,
} from "../questionScopePolicy";
import { canEditGlobalQuestions, isAdministrator } from "@/app/roles/roleAssignmentPolicy";
import { resolveGooglePlacesFeature } from "../googlePlacesFeature";
import { canUseQuestionRewrite, isQuestionRewriteEnabled } from "../questionRewriteFeature.server";
import { loadPublicQuestionSubmissionReviewMetadata } from "@/app/frage-einreichen/publicQuestionSubmissionReview.server";
import QuestionStoryElementPanel from "@/app/story-elemente/QuestionStoryElementPanel";
import { loadQuestionStoryElementPanel } from "@/app/story-elemente/questionStoryElements.server";
import { getStoryElementEditorOptions } from "@/app/story-elemente/storyElementRepository.server";
import { getQuizListe } from "@/app/quiz/actions";
import { getAssignableQuestionQuizIds } from "@/app/components/content/contentQuizEligibility";
import QuestionQuizAssignmentPanel from "@/app/components/content/QuestionQuizAssignmentPanel";
import { getBerlinDate } from "@/app/lib/berlinDate";

export default async function ExistingQuestionEditorPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId: questionIdParam } = await params;
  const questionId = Number(questionIdParam);

  if (!Number.isInteger(questionId) || questionId <= 0) {
    notFound();
  }

  const session = await requireQuestionEditor();
  const actor = await getQuestionActor(session);
  const { locale, messages } = getQuestionEditorMessages(getDefaultLocale());
  const [loadedQuestion, categories, eventSeries, publicSubmission] = await Promise.all([
    loadQuestionForEditor(questionId),
    prisma.fragenkategorie.findMany({
      where: {
        OR: [
          { status: "ACTIVE" },
          {
            fragen_kategorien: {
              some: { fragen_id: questionId },
            },
          },
        ],
      },
      orderBy: { kategorie: "asc" },
      select: {
        fragenkategorie_id: true,
        kategorie: true,
        status: true,
      },
    }),
    getAssignableQuestionEventSeries(session),
    loadPublicQuestionSubmissionReviewMetadata(questionId, isAdministrator(actor)),
  ]);

  if (
    !loadedQuestion ||
    !canViewScopedQuestion(actor, loadedQuestion.access)
  ) {
    notFound();
  }

  let editorContext: QuestionEditorContext;

  if (
    canApproveScopedQuestion(actor, loadedQuestion.access) &&
    loadedQuestion.access.reviewStatus === "IN_REVIEW"
  ) {
    editorContext = "review";
  } else if (canEditScopedQuestion(actor, loadedQuestion.access)) {
    editorContext = "edit";
  } else {
    editorContext = "readOnly";
  }
  const [storyElements, storyEditorOptions] = await Promise.all([
    loadQuestionStoryElementPanel(actor, questionId),
    getStoryElementEditorOptions(actor),
  ]);
  const canEditQuestion = canEditScopedQuestion(actor, loadedQuestion.access);
  const baseTemplates = localizeQuestionTemplates(messages);
  const dynamicTemplates = await loadDynamicQuestionTemplates(
    baseTemplates,
    loadedQuestion.draft.sourceTemplateId,
  );
  const quizzes = await getQuizListe();
  const quizOptions = quizzes.filter((quiz) => !quiz.ist_archiviert).map((quiz) => ({
    quizId: quiz.quiz_id,
    title: quiz.titel ?? `Quiz #${quiz.quiz_id}`,
    date: quiz.quiz_datum,
    eventSeriesId: quiz.eventreihe_id,
  }));
  const quizUsages = quizzes.length === 0
    ? []
    : await prisma.quiz_fragen.findMany({
        where: {
          fragen_id: questionId,
          quiz_id: { in: quizzes.map((quiz) => quiz.quiz_id) },
        },
        orderBy: [{ quiz: { quiz_datum: "desc" } }, { quiz_id: "desc" }],
        select: {
          quiz: {
            select: {
              quiz_id: true,
              titel: true,
              quiz_datum: true,
              ist_archiviert: true,
            },
          },
        },
      });
  const assignableQuizIds = getAssignableQuestionQuizIds(
    {
      ...loadedQuestion.access,
      validUntil: loadedQuestion.draft.validUntil
        ? new Date(`${loadedQuestion.draft.validUntil}T00:00:00.000Z`)
        : null,
    },
    quizOptions,
    getBerlinDate(),
  );

  return (
    <>
    <QuestionEditor
      capabilities={{
        ...getQuestionEditorCapabilities(actor, loadedQuestion.access),
        canSaveDraft: canEditQuestion,
        canSubmitForReview: canEditQuestion && !isAdministrator(actor),
        canApproveQuestion: canApproveScopedQuestion(actor, loadedQuestion.access),
        canRequestQuestionChanges: canRequestChangesForScopedQuestion(actor, loadedQuestion.access),
        canCloneQuestion: canCloneScopedQuestion(actor, loadedQuestion.access),
        canArchiveQuestion: canEditQuestion,
        canDeleteQuestion: canApproveScopedQuestion(actor, loadedQuestion.access),
      }}
      editorContext={editorContext}
      mediaUploadPathnamePrefix={getMediaUploadEnvironmentPrefix()}
      locale={locale}
      messages={messages}
      templates={[...baseTemplates, ...dynamicTemplates]}
      initialDraft={loadedQuestion.draft}
      questionRecord={{ ...loadedQuestion.record, publicSubmission }}
      categories={categories.map((category) => ({
        id: category.fragenkategorie_id,
        name: category.kategorie,
        status: category.status,
      }))}
      scopeOptions={{
        canSelectGlobal: canEditGlobalQuestions(actor),
        eventSeries: eventSeries.map((series) => ({ id: series.eventreihe_id, name: series.name })),
      }}
      googlePlacesFeature={resolveGooglePlacesFeature({
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
        explicitlyEnabled: process.env.GOOGLE_PLACES_FEATURE_ENABLED,
      })}
      questionRewriteEnabled={isQuestionRewriteEnabled() && canUseQuestionRewrite(actor)}
    />
    <QuestionQuizAssignmentPanel
      questionId={questionId}
      quizzes={quizOptions}
      usages={quizUsages.map(({ quiz }) => ({
        quizId: quiz.quiz_id,
        title: quiz.titel ?? `Quiz #${quiz.quiz_id}`,
        date: quiz.quiz_datum?.toISOString().slice(0, 10) ?? null,
        archived: quiz.ist_archiviert,
      }))}
      assignableQuizIds={assignableQuizIds}
      disabled={loadedQuestion.access.isArchived}
    />
    <QuestionStoryElementPanel
      questionId={questionId}
      links={storyElements.links}
      options={storyElements.options}
      canEdit={canEditQuestion}
      editorOptions={storyEditorOptions}
    />
    </>
  );
}
