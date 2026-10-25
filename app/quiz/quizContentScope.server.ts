import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { isQuestionScopeCompatibleWithQuiz } from "@/app/fragen/editor/questionScopePolicy";
import { isStoryElementScopeCompatibleWithQuiz } from "@/app/story-elemente/storyElementPolicy";

const contentScopeSelect = { geltungsbereich: true, eventreihe_id: true, quiz_id: true } as const;

/** Scope checks only: existing content/revision/status and live state are never rewritten. */
export async function getQuizSeriesChangeBlocker(
  db: Prisma.TransactionClient, quizId: number, eventSeriesId: number,
): Promise<string | null> {
  const [questions, placements] = await Promise.all([
    db.quiz_fragen.findMany({
      where: { quiz_id: quizId },
      select: {
        verknuepfte_story_elemente_uebernehmen: true,
        fragen: { select: {
          geltungsbereich: true,
          eventreihen: { select: { eventreihe_id: true } },
          story_element_verknuepfungen: { select: { story_element: { select: contentScopeSelect } } },
        } },
      },
    }),
    db.quiz_ablauf_elemente.findMany({
      where: { quiz_id: quizId },
      select: {
        story_element_revision: { select: { story_element: { select: contentScopeSelect } } },
        live_poll_revision: { select: { live_poll: { select: contentScopeSelect } } },
      },
    }),
  ]);
  if (questions.some(({ fragen }) => !isQuestionScopeCompatibleWithQuiz({
    scope: fragen.geltungsbereich,
    eventSeriesIds: fragen.eventreihen.map(row => row.eventreihe_id),
    quizEventSeriesId: eventSeriesId,
  }))) return "Die Eventreihe kann nicht geändert werden: Mindestens eine Frage ist für die Zielreihe nicht zulässig.";

  const linkedStories = questions.flatMap(row => row.verknuepfte_story_elemente_uebernehmen
    ? row.fragen.story_element_verknuepfungen.map(link => link.story_element) : []);
  const content = [...linkedStories, ...placements.flatMap(row => [
    ...(row.story_element_revision ? [row.story_element_revision.story_element] : []),
    ...(row.live_poll_revision ? [row.live_poll_revision.live_poll] : []),
  ])];
  if (content.some(row => !isStoryElementScopeCompatibleWithQuiz({
    scope: row.geltungsbereich, eventSeriesId: row.eventreihe_id, quizId: row.quiz_id,
  }, { quizId, eventSeriesId }))) {
    return "Die Eventreihe kann nicht geändert werden: Mindestens ein Story-Element oder eine Umfrage ist für die Zielreihe nicht zulässig.";
  }
  return null;
}
