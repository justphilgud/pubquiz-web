import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import {
  canEditQuestion,
  canReviewQuestions,
  canViewQuestion,
  getQuestionEditorCapabilities,
  requireQuestionEditor,
} from "@/app/lib/permissions";
import { QuestionEditor } from "../components/QuestionEditor";
import { loadQuestionForEditor } from "../questionEditorData";
import type { QuestionEditorContext } from "../types";
import { getMediaUploadPathnamePrefix } from "../mediaUploadEnvironment";

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
  const [loadedQuestion, categories] = await Promise.all([
    loadQuestionForEditor(questionId),
    prisma.fragenkategorie.findMany({
      orderBy: { kategorie: "asc" },
      select: { fragenkategorie_id: true, kategorie: true },
    }),
  ]);

  if (
    !loadedQuestion ||
    !canViewQuestion(session, loadedQuestion.access)
  ) {
    notFound();
  }

  let editorContext: QuestionEditorContext;

  if (
    canReviewQuestions(session) &&
    loadedQuestion.access.reviewStatus === "IN_REVIEW"
  ) {
    editorContext = "review";
  } else if (canEditQuestion(session, loadedQuestion.access)) {
    editorContext = "edit";
  } else {
    editorContext = "readOnly";
  }

  return (
    <QuestionEditor
      capabilities={getQuestionEditorCapabilities(
        session,
        loadedQuestion.access,
      )}
      editorContext={editorContext}
      mediaUploadPathnamePrefix={getMediaUploadPathnamePrefix()}
      initialDraft={loadedQuestion.draft}
      questionRecord={loadedQuestion.record}
      categories={categories.map((category) => ({
        id: category.fragenkategorie_id,
        name: category.kategorie,
      }))}
    />
  );
}
