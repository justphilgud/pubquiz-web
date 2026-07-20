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
import { getAssignableQuestionEventSeries, getQuestionActor } from "../questionAccess.server";
import {
  canApproveScopedQuestion,
  canCloneScopedQuestion,
  canEditScopedQuestion,
  canRequestChangesForScopedQuestion,
  canViewScopedQuestion,
} from "../questionScopePolicy";
import { canEditGlobalQuestions, isAdministrator } from "@/app/roles/roleAssignmentPolicy";

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
  const { locale, messages } = getQuestionEditorMessages(getDefaultLocale());
  const [loadedQuestion, categories, actor, eventSeries] = await Promise.all([
    loadQuestionForEditor(questionId),
    prisma.fragenkategorie.findMany({
      orderBy: { kategorie: "asc" },
      select: { fragenkategorie_id: true, kategorie: true },
    }),
    getQuestionActor(session),
    getAssignableQuestionEventSeries(session),
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

  return (
    <QuestionEditor
      capabilities={{
        ...getQuestionEditorCapabilities(actor, loadedQuestion.access),
        canSaveDraft: canEditScopedQuestion(actor, loadedQuestion.access),
        canSubmitForReview: canEditScopedQuestion(actor, loadedQuestion.access) && !isAdministrator(actor),
        canApproveQuestion: canApproveScopedQuestion(actor, loadedQuestion.access),
        canRequestQuestionChanges: canRequestChangesForScopedQuestion(actor, loadedQuestion.access),
        canCloneQuestion: canCloneScopedQuestion(actor, loadedQuestion.access),
        canArchiveQuestion: canEditScopedQuestion(actor, loadedQuestion.access),
        canDeleteQuestion: canApproveScopedQuestion(actor, loadedQuestion.access),
      }}
      editorContext={editorContext}
      mediaUploadPathnamePrefix={getMediaUploadEnvironmentPrefix()}
      locale={locale}
      messages={messages}
      templates={localizeQuestionTemplates(messages)}
      initialDraft={loadedQuestion.draft}
      questionRecord={loadedQuestion.record}
      categories={categories.map((category) => ({
        id: category.fragenkategorie_id,
        name: category.kategorie,
      }))}
      scopeOptions={{
        canSelectGlobal: canEditGlobalQuestions(actor),
        eventSeries: eventSeries.map((series) => ({ id: series.eventreihe_id, name: series.name })),
      }}
    />
  );
}
