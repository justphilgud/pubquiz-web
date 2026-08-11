import { redirect } from "next/navigation";
import ContentEditorShell from "@/app/components/content/ContentEditorShell";
import { requireActor } from "@/app/lib/permissions";
import { requireQuizEditor, requireQuizSection } from "@/app/quiz/quizAccess.server";
import StoryElementEditor from "../StoryElementEditor";
import { canCreateStoryElement } from "../storyElementPolicy";
import { isStoryQuestionRelationship } from "../storyElement";
import { getStoryElementEditorOptions } from "../storyElementRepository.server";

export default async function NewStoryElementPage({
  searchParams,
}: {
  searchParams: Promise<{
    questionId?: string;
    relationship?: string;
    quizId?: string;
    sectionId?: string;
    returnTo?: string;
  }>;
}) {
  const { actor } = await requireActor();
  if (!canCreateStoryElement(actor)) redirect("/story-elemente");
  const query = await searchParams;
  const questionId = Number(query.questionId);
  const linkedQuestionId = Number.isSafeInteger(questionId) && questionId > 0
    ? questionId
    : undefined;
  const linkRelationship = isStoryQuestionRelationship(query.relationship)
    ? query.relationship
    : "AFTER_SOLUTION";
  const quizId = Number(query.quizId);
  const sectionId = Number(query.sectionId);
  const hasQuizContext =
    Number.isSafeInteger(quizId) && quizId > 0 &&
    Number.isSafeInteger(sectionId) && sectionId > 0;
  if (hasQuizContext) {
    await requireQuizEditor(quizId);
    await requireQuizSection(quizId, sectionId);
  }
  const safeQuestionReturn = query.returnTo?.startsWith("/content/questions/");
  const safeQuizReturn = hasQuizContext &&
    query.returnTo?.startsWith(`/quiz/${quizId}/ablauf`);
  const returnTo = safeQuestionReturn || safeQuizReturn
    ? query.returnTo
    : undefined;
  const options = await getStoryElementEditorOptions(actor);

  return (
    <ContentEditorShell maxWidth="max-w-7xl" eyebrow="Content · Story-Elemente" title="Neues Story-Element" fallbackHref={returnTo ?? "/content"} description={linkedQuestionId ? `Wird nach dem Speichern mit Frage #${linkedQuestionId} verknüpft.` : hasQuizContext ? "Wird nach dem Speichern automatisch im ausgewählten Quizblock platziert." : undefined} footerSpace>
        <StoryElementEditor
          options={options}
          canEdit
          canArchive={false}
          linkQuestionId={linkedQuestionId}
          linkRelationship={linkRelationship}
          returnTo={returnTo}
          quizContext={hasQuizContext ? { quizId, sectionId } : undefined}
        />
    </ContentEditorShell>
  );
}
