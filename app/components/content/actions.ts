"use server";

import { requireActor } from "@/app/lib/permissions";
import { searchFragen } from "@/app/fragen/actions";
import { cloneQuestion, setQuestionArchived } from "@/app/fragen/editor/managementActions";
import { addFrageToQuiz } from "@/app/quiz/actions";
import { getAktiveQuizListe } from "@/app/quiz/actions";
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
import { getBerlinDate } from "@/app/lib/berlinDate";
import { getQuestionLifecycleState } from "@/app/fragen/editor/questionLifecycle";
import {
  getAssignableQuestionQuizIds,
  getAssignableStoryQuizIds,
} from "./contentQuizEligibility";
import { listStoryElements } from "@/app/story-elemente/storyElementRepository.server";
import type {
  ContentFiltersState,
  ContentSearchResult,
  ContentSearchItem,
  ContentType,
} from "./contentLibrary";

function questionStatuses(status: ContentFiltersState["status"]) {
  if (status === "DRAFT") return ["MY_DRAFTS"] as const;
  if (status === "ACTIVE") return ["APPROVED"] as const;
  if (status === "ARCHIVED") return ["ARCHIVED"] as const;
  return [];
}

export async function searchContent(filters: ContentFiltersState): Promise<ContentSearchResult> {
  const { actor } = await requireActor();
  const includeQuestions = filters.contentType !== "STORY_ELEMENT";
  const includeStories = filters.contentType !== "QUESTION";
  const [questionResult, stories, quizzes] = await Promise.all([
    includeQuestions
      ? searchFragen({
          suchtext: filters.query,
          kategorieId: null,
          kategorieIds: filters.categoryIds,
          sourceState: null,
          mediaState: filters.media === "ALL" ? null : filters.media === "WITH" ? "with" : "without",
          answerMode: null,
          statuses: [...questionStatuses(filters.status)],
          templateIds: [],
          eventSeriesId: filters.eventSeriesId,
          usageState: filters.usage === "ALL" ? null : filters.usage,
          lifecycleFilter: filters.questionLifecycle,
          limit: 50,
          offset: 0,
        })
      : Promise.resolve({ results: [], hasMore: false, nextOffset: 0, total: 0 }),
    includeStories
      ? listStoryElements(actor, {
          query: filters.query,
          status: filters.status === "ACTIVE" ? "ACTIVE" : filters.status,
          type: isStoryElementType(filters.storyType) ? filters.storyType : undefined,
          mediaState: filters.media,
          usageState: filters.usage,
          eventSeriesId: filters.eventSeriesId === null ? undefined : String(filters.eventSeriesId),
        })
      : Promise.resolve([]),
    getAktiveQuizListe(),
  ]);

  const now = getBerlinDate();

  const questions: ContentSearchItem[] = questionResult.results
    .map((question) => {
      const lifecycle = getQuestionLifecycleState({
        validUntil: question.gueltig_bis,
        reviewFrom: question.pruefen_ab,
        today: now.toISOString().slice(0, 10),
      });
      const lifecycleStatus = lifecycle.isOutdated
        ? "Veraltet"
        : lifecycle.isReviewDue
          ? "Prüfung fällig"
          : lifecycle.isOutdatedSoon
            ? "Bald veraltet"
            : lifecycle.isReviewSoon
              ? "Prüfung demnächst"
              : lifecycle.mode === "TIMELESS"
                ? "Zeitlos"
                : "Aktuell";
      return ({
      key: `QUESTION:${question.fragen_id}`,
      id: question.fragen_id,
      contentType: "QUESTION",
      subtype: "Frage",
      title: question.frage,
      status: question.ist_archiviert ? "Archiviert" : ({ DRAFT: "Entwurf", IN_REVIEW: "Eingereicht", CHANGES_REQUESTED: "Feedback", APPROVED: "Freigegeben" } as const)[question.review_status],
      lifecycleStatus,
      archived: question.ist_archiviert,
      scope: question.geltungsbereich === "GLOBAL" ? "Global" : question.eventreihen.join(", ") || "Eventreihe",
      mediaCount: question.medien_anzahl,
      quizUsages: question.quizze.map((quiz) => ({ quizId: quiz.quiz_id, title: quiz.titel ?? `Quiz ${quiz.quiz_id}`, date: quiz.quiz_datum, archived: quiz.ist_archiviert })),
      assignableQuizIds: getAssignableQuestionQuizIds({
        scope: question.geltungsbereich,
        eventSeriesIds: question.eventreihe_ids,
        createdByUserId: null,
        reviewStatus: question.review_status,
        isApproved: question.freigegeben,
        isArchived: question.ist_archiviert,
        validUntil: question.gueltig_bis ? new Date(`${question.gueltig_bis}T00:00:00.000Z`) : null,
      }, quizzes.map((quiz) => ({ quizId: quiz.quiz_id, eventSeriesId: quiz.eventreihe_id })), now),
      editHref: `/content/questions/${question.fragen_id}`,
      canClone: question.can_clone,
      canArchive: true,
      questionMetrics: {
        answerCount: question.antworten_anzahl,
        difficulty: question.schwierigkeitslevel,
        answerMode: question.answer_mode === "OPEN" ? "Offen" : question.answer_mode === "CLOSED" ? "Geschlossen" : "Nicht eindeutig",
        categories: question.kategorien,
        source: question.quelle,
        template: question.template_id ?? "standard",
        questionMediaCount: question.medien_frage_anzahl,
        answerMediaCount: question.medien_antworten_anzahl,
        storyElementCount: question.story_elemente_anzahl,
      },
    });
    });

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
    assignableQuizIds: getAssignableStoryQuizIds(
      actor,
      story.access,
      quizzes.map((quiz) => ({ quizId: quiz.quiz_id, eventSeriesId: quiz.eventreihe_id })),
    ),
    editHref: `/content/story-elements/${story.id}`,
    canClone: true,
    canArchive: canArchiveStoryElement(actor, story.access),
    storyMetrics: { linkedQuestionCount: story.questionLinkCount, linkedQuestionTitle: story.linkedQuestion?.frage ?? null, revision: story.revisionNumber },
  }));

  return {
    items: [...questions, ...storyItems]
      .sort((left, right) => right.id - left.id || left.contentType.localeCompare(right.contentType))
      .slice(0, 50),
    total: questionResult.total + stories.length,
  };
}

export async function cloneContent(contentType: ContentType, id: number) {
  if (contentType === "QUESTION") {
    const result = await cloneQuestion(id);
    return result.ok
      ? { success: true, href: `/content/questions/${result.questionId}`, message: "Frage wurde geklont." }
      : { success: false, message: "Frage konnte nicht geklont werden." };
  }
  const result = await duplicateStoryElement(id);
  return result.success
    ? { success: true, href: `/content/story-elements/${result.storyElementId}`, message: result.message }
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
  try {
    if (input.contentType === "QUESTION") {
      const result = await addFrageToQuiz({ quizId: input.quizId, fragenId: input.contentId });
      return result.alreadyAssigned
        ? { success: false, message: "Diese Frage ist diesem Quiz bereits zugeordnet." }
        : { success: true, message: "Zum Quiz hinzugefügt. Block: Kein Block." };
    }
    return await addStoryElementToQuiz({ quizId: input.quizId, storyElementId: input.contentId });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error
        ? error.message
        : "Der Inhalt konnte diesem Quiz nicht zugeordnet werden.",
    };
  }
}
