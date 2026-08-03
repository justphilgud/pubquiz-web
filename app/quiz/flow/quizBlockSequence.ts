import {
  getEffectiveQuizSolutionStrategy,
  type QuizFlowItem,
  type QuizSolutionStrategy,
} from "./quizFlow";

export type QuizBlockQuestionIdentity = {
  quiz_fragen_id: number;
  quiz_abschnitt_id: number | null;
  sortierung: number | null;
};

export type QuizBlockSequenceEntry<TQuestion extends QuizBlockQuestionIdentity> =
  | {
      kind: "QUESTION";
      question: TQuestion;
      item: QuizFlowItem | null;
    }
  | {
      kind: "QUESTION_SOLUTION";
      question: TQuestion;
      item: QuizFlowItem | null;
    }
  | {
      kind: "CONTENT";
      item: QuizFlowItem;
    };

type OrderedQuestion<TQuestion extends QuizBlockQuestionIdentity> = {
  order: number;
  question: TQuestion;
  item: QuizFlowItem | null;
};

function compareOrdered(
  left: { order: number; stable: string },
  right: { order: number; stable: string },
) {
  return left.order - right.order || left.stable.localeCompare(right.stable);
}

function resolveOrderedQuestions<TQuestion extends QuizBlockQuestionIdentity>(
  questions: readonly TQuestion[],
  blockItems: readonly QuizFlowItem[],
) {
  const questionById = new Map(
    questions.map((question) => [question.quiz_fragen_id, question]),
  );
  const persisted = blockItems
    .filter(
      (item) =>
        item.type === "QUESTION" &&
        item.questionAssignmentId !== null &&
        questionById.has(item.questionAssignmentId),
    )
    .map((item) => ({
      order: item.order,
      question: questionById.get(item.questionAssignmentId!)!,
      item,
    }));
  const represented = new Set(
    persisted.map((entry) => entry.question.quiz_fragen_id),
  );
  const maximumOrder = Math.max(
    0,
    ...blockItems.map((item) => item.order),
    ...persisted.map((entry) => entry.order),
  );
  const missing = [...questions]
    .filter((question) => !represented.has(question.quiz_fragen_id))
    .sort(
      (left, right) =>
        (left.sortierung ?? 0) - (right.sortierung ?? 0) ||
        left.quiz_fragen_id - right.quiz_fragen_id,
    )
    .map((question, index) => ({
      order:
        persisted.length === 0 && blockItems.length === 0
          ? (index + 1) * 1_000
          : maximumOrder + (index + 1) * 1_000,
      question,
      item: null,
    }));

  return [...persisted, ...missing] satisfies OrderedQuestion<TQuestion>[];
}

function resolveAutomaticSequence<TQuestion extends QuizBlockQuestionIdentity>(
  questions: readonly TQuestion[],
  blockItems: readonly QuizFlowItem[],
  strategy: Exclude<QuizSolutionStrategy, "MANUAL">,
) {
  const orderedQuestions = resolveOrderedQuestions(questions, blockItems);
  const linkedAfterSolution = new Map<number, QuizFlowItem[]>();
  for (const item of blockItems) {
    if (
      item.storyRelationship === "AFTER_SOLUTION" &&
      item.storyQuestionAssignmentId !== null &&
      item.storyQuestionAssignmentId !== undefined
    ) {
      const entries = linkedAfterSolution.get(item.storyQuestionAssignmentId) ?? [];
      entries.push(item);
      linkedAfterSolution.set(item.storyQuestionAssignmentId, entries);
    }
  }
  for (const entries of linkedAfterSolution.values()) {
    entries.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  }
  const core = [
    ...orderedQuestions.map((entry) => ({
      order: entry.order,
      stable: `question:${entry.question.quiz_fragen_id}`,
      value: {
        kind: "QUESTION" as const,
        question: entry.question,
        item: entry.item,
      },
    })),
    ...blockItems
      .filter(
        (item) =>
          item.type !== "QUESTION" &&
          item.type !== "QUESTION_SOLUTION" &&
          item.storyRelationship !== "AFTER_SOLUTION",
      )
      .map((item) => ({
        order: item.order,
        stable: `content:${item.persistentId ?? item.id}`,
        value: { kind: "CONTENT" as const, item },
      })),
  ].sort(compareOrdered);

  const result: QuizBlockSequenceEntry<TQuestion>[] = [];
  const solutions: QuizBlockSequenceEntry<TQuestion>[] = [];
  for (const entry of core) {
    result.push(entry.value);
    if (entry.value.kind === "QUESTION") {
      const solution = {
        kind: "QUESTION_SOLUTION" as const,
        question: entry.value.question,
        item: null,
      };
      const linkedStories = linkedAfterSolution.get(
        entry.value.question.quiz_fragen_id,
      ) ?? [];
      const linkedEntries = linkedStories.map((item) => ({
        kind: "CONTENT" as const,
        item,
      }));
      if (strategy === "AFTER_EACH_QUESTION") {
        result.push(solution, ...linkedEntries);
      } else {
        solutions.push(solution, ...linkedEntries);
      }
    }
  }
  return strategy === "END_OF_BLOCK" ? [...result, ...solutions] : result;
}

function resolveManualSequence<TQuestion extends QuizBlockQuestionIdentity>(
  questions: readonly TQuestion[],
  blockItems: readonly QuizFlowItem[],
) {
  const questionById = new Map(
    questions.map((question) => [question.quiz_fragen_id, question]),
  );
  const result: QuizBlockSequenceEntry<TQuestion>[] = [];
  const seenQuestions = new Set<number>();
  const seenSolutions = new Set<number>();

  for (const item of [...blockItems].sort((left, right) =>
    compareOrdered(
      { order: left.order, stable: left.id },
      { order: right.order, stable: right.id },
    ),
  )) {
    if (item.type === "QUESTION") {
      const question = item.questionAssignmentId === null
        ? null
        : questionById.get(item.questionAssignmentId) ?? null;
      if (!question || seenQuestions.has(question.quiz_fragen_id)) continue;
      seenQuestions.add(question.quiz_fragen_id);
      result.push({ kind: "QUESTION", question, item });
      continue;
    }
    if (item.type === "QUESTION_SOLUTION") {
      const question = item.questionAssignmentId === null
        ? null
        : questionById.get(item.questionAssignmentId) ?? null;
      if (
        !question ||
        !seenQuestions.has(question.quiz_fragen_id) ||
        seenSolutions.has(question.quiz_fragen_id)
      ) {
        continue;
      }
      seenSolutions.add(question.quiz_fragen_id);
      result.push({ kind: "QUESTION_SOLUTION", question, item });
      continue;
    }
    result.push({ kind: "CONTENT", item });
  }

  for (const question of [...questions].sort(
    (left, right) =>
      (left.sortierung ?? 0) - (right.sortierung ?? 0) ||
      left.quiz_fragen_id - right.quiz_fragen_id,
  )) {
    if (!seenQuestions.has(question.quiz_fragen_id)) {
      result.push({ kind: "QUESTION", question, item: null });
      seenQuestions.add(question.quiz_fragen_id);
    }
    if (!seenSolutions.has(question.quiz_fragen_id)) {
      result.push({ kind: "QUESTION_SOLUTION", question, item: null });
      seenSolutions.add(question.quiz_fragen_id);
    }
  }

  return result;
}

export function resolveQuizBlockSequence<
  TQuestion extends QuizBlockQuestionIdentity,
>(input: {
  sectionId: number;
  quizStrategy: unknown;
  sectionStrategy: unknown;
  questions: readonly TQuestion[];
  blockItems: readonly QuizFlowItem[];
  includeDisabledItems?: boolean;
}) {
  const strategy = getEffectiveQuizSolutionStrategy(
    input.quizStrategy,
    input.sectionStrategy,
  );
  const questions = input.questions.filter(
    (question) => question.quiz_abschnitt_id === input.sectionId,
  );
  const blockItems = input.blockItems.filter(
    (item) =>
      item.anchorType === "BLOCK" &&
      item.sectionId === input.sectionId &&
      (input.includeDisabledItems || item.enabled),
  );

  return {
    strategy,
    entries:
      strategy === "MANUAL"
        ? resolveManualSequence(questions, blockItems)
        : resolveAutomaticSequence(questions, blockItems, strategy),
  };
}

export function getQuizBlockSequenceEntryKey<
  TQuestion extends QuizBlockQuestionIdentity,
>(entry: QuizBlockSequenceEntry<TQuestion>) {
  if (entry.kind === "QUESTION") {
    return `question:${entry.question.quiz_fragen_id}:question`;
  }
  if (entry.kind === "QUESTION_SOLUTION") {
    return `question:${entry.question.quiz_fragen_id}:solution`;
  }
  return entry.item.persistentId === null
    ? entry.item.id
    : entry.item.storyElementRevisionId
      ? `story-placement:${entry.item.persistentId}`
      : `block-item:${entry.item.persistentId}`;
}
