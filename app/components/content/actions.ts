"use server";

import { requireActor } from "@/app/lib/permissions";
import { searchFragen } from "@/app/fragen/actions";
import { cloneQuestion, setQuestionArchived } from "@/app/fragen/editor/managementActions";
import { addFrageToQuiz } from "@/app/quiz/actions";
import {
  addStoryElementToQuiz,
  duplicateStoryElement,
  setStoryElementArchived,
} from "@/app/story-elemente/actions";
import {
  getStoryElementScopeLabel,
  getStoryElementStatusLabel,
  getStoryElementTypeLabel,
  isStoryElementType,
} from "@/app/story-elemente/storyElement";
import { canArchiveStoryElement } from "@/app/story-elemente/storyElementPolicy";
import { listStoryElements } from "@/app/story-elemente/storyElementRepository.server";
import type {
  ContentFiltersState,
  ContentSearchItem,
  ContentType,
} from "./contentLibrary";

function questionStatuses(status: ContentFiltersState["status"]) {
  if (status === "DRAFT") return ["MY_DRAFTS"] as const;
  if (status === "ACTIVE") return ["APPROVED"] as const;
  if (status === "ARCHIVED") return ["ARCHIVED"] as const;
  return [];
}

export async function searchContent(filters: ContentFiltersState): Promise<ContentSearchItem[]> {
  const { actor } = await requireActor();
  const includeQuestions = filters.contentType !== "STORY_ELEMENT";
  const includeStories = filters.contentType !== "QUESTION";
  const [questionResult, stories] = await Promise.all([
    includeQuestions
      ? searchFragen({
          suchtext: filters.query,
          kategorieId: null,
          sourceState: null,
          mediaState: filters.media === "ALL" ? null : filters.media === "WITH" ? "with" : "without",
          answerMode: null,
          statuses: [...questionStatuses(filters.status)],
          templateIds: [],
          limit: 50,
          offset: 0,
        })
      : Promise.resolve({ results: [], hasMore: false, nextOffset: 0 }),
    includeStories
      ? listStoryElements(actor, {
          query: filters.query,
          status: filters.status === "ACTIVE" ? "ACTIVE" : filters.status,
          type: isStoryElementType(filters.storyType) ? filters.storyType : undefined,
          mediaState: filters.media,
          usageState: filters.usage,
        })
      : Promise.resolve([]),
  ]);

  const questions: ContentSearchItem[] = questionResult.results
    .filter((question) => filters.usage === "ALL" || (filters.usage === "USED" ? question.quiz_anzahl > 0 : question.quiz_anzahl === 0))
    .map((question) => ({
      key: `QUESTION:${question.fragen_id}`,
      id: question.fragen_id,
      contentType: "QUESTION",
      subtype: "Frage",
      title: question.frage,
      status: question.ist_archiviert ? "Archiviert" : ({ DRAFT: "Entwurf", IN_REVIEW: "Eingereicht", CHANGES_REQUESTED: "Feedback", APPROVED: "Freigegeben" } as const)[question.review_status],
      archived: question.ist_archiviert,
      scope: question.geltungsbereich === "GLOBAL" ? "Global" : question.eventreihen.join(", ") || "Eventreihe",
      mediaCount: question.medien_anzahl,
      quizUsages: question.quizze.map((quiz) => ({ quizId: quiz.quiz_id, title: quiz.titel ?? `Quiz ${quiz.quiz_id}`, date: quiz.quiz_datum, archived: quiz.ist_archiviert })),
      editHref: `/fragen/editor/${question.fragen_id}`,
      canClone: question.can_clone,
      canArchive: true,
      questionMetrics: {
        answerCount: question.antworten_anzahl,
        difficulty: question.schwierigkeitslevel,
        answerMode: question.answer_mode === "OPEN" ? "Offen" : question.answer_mode === "CLOSED" ? "Geschlossen" : "Nicht eindeutig",
      },
    }));

  const storyItems: ContentSearchItem[] = stories.map((story) => ({
    key: `STORY_ELEMENT:${story.id}`,
    id: story.id,
    contentType: "STORY_ELEMENT",
    subtype: getStoryElementTypeLabel(story.type),
    title: story.title,
    status: getStoryElementStatusLabel(story.status),
    archived: story.status === "ARCHIVED",
    scope: story.eventSeriesName ?? getStoryElementScopeLabel(story.scope),
    mediaCount: story.mediaCount,
    quizUsages: story.quizUsages,
    editHref: `/story-elemente/${story.id}`,
    canClone: true,
    canArchive: canArchiveStoryElement(actor, story.access),
    storyMetrics: { linkedQuestionCount: story.questionLinkCount, revision: story.revisionNumber },
  }));

  return [...questions, ...storyItems].sort((left, right) => right.id - left.id || left.contentType.localeCompare(right.contentType));
}

export async function cloneContent(contentType: ContentType, id: number) {
  if (contentType === "QUESTION") {
    const result = await cloneQuestion(id);
    return result.ok
      ? { success: true, href: `/fragen/editor/${result.questionId}`, message: "Frage wurde geklont." }
      : { success: false, message: "Frage konnte nicht geklont werden." };
  }
  const result = await duplicateStoryElement(id);
  return result.success
    ? { success: true, href: `/story-elemente/${result.storyElementId}`, message: result.message }
    : { success: false, message: result.message };
}

export async function setContentArchived(contentType: ContentType, id: number, archived: boolean, reason = "") {
  if (contentType === "QUESTION") {
    const result = await setQuestionArchived(id, archived, reason);
    return result.ok ? { success: true, message: archived ? "Frage archiviert." : "Frage reaktiviert." } : { success: false, message: "Aktion nicht erlaubt." };
  }
  const result = await setStoryElementArchived(id, archived);
  return { success: result.success, message: result.message };
}

export async function assignContentToQuiz(input: { contentType: ContentType; contentId: number; quizId: number }) {
  if (input.contentType === "QUESTION") {
    await addFrageToQuiz({ quizId: input.quizId, fragenId: input.contentId });
    return { success: true, message: "Zum Quiz hinzugefügt. Block: Kein Block." };
  }
  return addStoryElementToQuiz({ quizId: input.quizId, storyElementId: input.contentId });
}
