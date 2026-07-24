import type { Prisma } from "@/app/generated/prisma/client";
import {
  getQuestionTemplatePersistenceIds,
  questionTemplateIds,
  resolveCanonicalQuestionTemplateId,
} from "./editor/templates/questionTemplateRegistry";
import { questionTemplateDefinitions } from "./editor/templates/questionTemplates";

export type QuestionAnswerMode = "OPEN" | "CLOSED";
export type DerivedQuestionAnswerMode =
  | QuestionAnswerMode
  | "UNCLASSIFIED";

const openSpecialTemplateIds = [
  questionTemplateIds.faceMorph,
  questionTemplateIds.musicReverse,
  questionTemplateIds.musicEightBit,
  questionTemplateIds.pixelImage,
  questionTemplateIds.estimate,
  questionTemplateIds.translationReadAloud,
  questionTemplateIds.anagram,
  questionTemplateIds.googleReviews,
] as const;

const closedSpecialTemplateIds = [
  questionTemplateIds.trueFalse,
  questionTemplateIds.ordering,
] as const;

const openSpecialTemplateIdSet = new Set<string>(
  openSpecialTemplateIds,
);

export function getClosedQuestionTemplatePersistenceIds() {
  return getQuestionTemplatePersistenceIds(
    questionTemplateIds.multipleChoice,
  );
}

function getOpenSpecialTemplatePersistenceIds() {
  return openSpecialTemplateIds.flatMap((templateId) => [
    ...getQuestionTemplatePersistenceIds(templateId),
  ]);
}

function getClosedSpecialTemplatePersistenceIds() {
  return closedSpecialTemplateIds.flatMap((templateId) => [
    ...getQuestionTemplatePersistenceIds(templateId),
  ]);
}

export function getQuestionAnswerMode({
  templateId,
  answers,
  override,
}: {
  templateId: string | null;
  answers: readonly { isCorrect: boolean }[];
  override?: QuestionAnswerMode | "AUTO" | null;
}): DerivedQuestionAnswerMode {
  if (override === "OPEN" || override === "CLOSED") return override;

  const canonicalTemplateId =
    resolveCanonicalQuestionTemplateId(templateId);
  if (canonicalTemplateId === questionTemplateIds.multipleChoice) {
    return "CLOSED";
  }
  if (
    canonicalTemplateId !== null &&
    openSpecialTemplateIdSet.has(canonicalTemplateId)
  ) {
    return "OPEN";
  }
  if (
    canonicalTemplateId !== null &&
    closedSpecialTemplateIds.includes(canonicalTemplateId as never)
  ) {
    return "CLOSED";
  }
  if (canonicalTemplateId !== null) return "UNCLASSIFIED";

  return answers.some((answer) => !answer.isCorrect)
    ? "CLOSED"
    : "OPEN";
}

export function getQuestionAnswerModeWhereInput(
  mode: QuestionAnswerMode,
): Prisma.fragenWhereInput {
  const standardQuestion: Prisma.fragenWhereInput = {
    OR: [
      { vorlage_id: null },
      { vorlage: { code: questionTemplateIds.standard } },
    ],
  };

  if (mode === "CLOSED") {
    return {
      OR: [
        {
          vorlage: {
            code: {
              in: [
                ...getClosedQuestionTemplatePersistenceIds(),
                ...getClosedSpecialTemplatePersistenceIds(),
              ],
            },
          },
        },
        {
          AND: [
            standardQuestion,
            { antworten: { some: { ist_richtig: false } } },
          ],
        },
      ],
    };
  }

  return {
    OR: [
      {
        vorlage: {
          code: {
            in: getOpenSpecialTemplatePersistenceIds(),
          },
        },
      },
      {
        AND: [
          standardQuestion,
          { antworten: { none: { ist_richtig: false } } },
        ],
      },
    ],
  };
}

export function getConfiguredQuestionAnswerMode(templateId: string | null) {
  const canonicalTemplateId =
    resolveCanonicalQuestionTemplateId(templateId) ??
    questionTemplateIds.standard;
  return questionTemplateDefinitions.find(
    (template) => template.id === canonicalTemplateId,
  )?.answerMode ?? null;
}
