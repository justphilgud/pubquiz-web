import type { QuizQuestion } from "./QuizQuestionItem";
import type {
  QuizStandalonePoll,
  QuizStandaloneStory,
} from "./QuizFragenSortableTable";
import {
  QUIZ_EDITOR_ELEMENT_CAPABILITIES,
  type QuizEditorElementCapabilities,
} from "./QuizEditorElementCard";

type SharedQuizEditorElement = {
  key: string;
  title: string;
  sectionId: number | null;
  order: number;
  capabilities: QuizEditorElementCapabilities;
};

export type QuizEditorElement =
  | (SharedQuizEditorElement & {
      kind: "QUESTION";
      question: QuizQuestion;
    })
  | (SharedQuizEditorElement & {
      kind: "STORY";
      story: QuizStandaloneStory;
    })
  | (SharedQuizEditorElement & {
      kind: "POLL";
      poll: QuizStandalonePoll;
    });

export function buildQuizEditorElements(input: {
  questions: readonly QuizQuestion[];
  stories: readonly QuizStandaloneStory[];
  polls: readonly QuizStandalonePoll[];
}): QuizEditorElement[] {
  return [
    ...input.questions.map((question): QuizEditorElement => ({
      key: `question-${question.quiz_fragen_id}`,
      kind: "QUESTION",
      title: question.frage,
      sectionId: question.quiz_abschnitt_id,
      order: question.flowOrder,
      capabilities: QUIZ_EDITOR_ELEMENT_CAPABILITIES.QUESTION,
      question,
    })),
    ...input.stories.map((story): QuizEditorElement => ({
      key: `story-${story.placementId}`,
      kind: "STORY",
      title: story.title,
      sectionId: story.quiz_abschnitt_id,
      order: story.sortierung,
      capabilities: QUIZ_EDITOR_ELEMENT_CAPABILITIES.STORY,
      story,
    })),
    ...input.polls.map((poll): QuizEditorElement => ({
      key: `poll-${poll.placementId}`,
      kind: "POLL",
      title: poll.title,
      sectionId: poll.quiz_abschnitt_id,
      order: poll.sortierung,
      capabilities: QUIZ_EDITOR_ELEMENT_CAPABILITIES.POLL,
      poll,
    })),
  ].sort((left, right) =>
    left.order - right.order || left.key.localeCompare(right.key),
  );
}
