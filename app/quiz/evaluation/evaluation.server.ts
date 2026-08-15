import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";
import { prisma } from "@/app/lib/prisma";
import { resolveQuizQuestionAnswerMode } from "@/app/quiz/quizQuestionAnswerMode";
import { evaluateBaseAnswer } from "./evaluateBaseAnswer";
import {
  CURRENT_QUIZ_ANSWER_EVALUATION_VERSION,
  isEvaluationComplete,
} from "./evaluationCompleteness";
import { evaluateQuestionPoints } from "./evaluateQuestionPoints";
import { resolveEffectiveSubmission } from "./effectiveSubmission";
import {
  processEvaluationBackfillCandidates,
  QUIZ_EVALUATION_BACKFILL_BATCH_QUESTION_LIMIT,
  selectEvaluationBackfillBatch,
  summarizeIncompleteEvaluations,
} from "./evaluationBackfillPolicy";
import { getQuestionBaseMaximum } from "./questionPointPolicy";
import { allocateRiskQuestionPoints } from "./riskQuestionAllocation";
import {
  isRiskPoolEligible,
  shouldFreezeRiskPool,
} from "./riskQuestionSnapshot";

type EvaluationDb = Prisma.TransactionClient | typeof prisma;

const QUESTION_RECALCULATION_TRANSACTION_TIMEOUT_MS = 30_000;
export { QUIZ_EVALUATION_BACKFILL_BATCH_QUESTION_LIMIT };

export type RecalculationOptions = {
  preserveManualOverrides?: boolean;
  answerIds?: readonly number[];
  refreezeRiskPool?: boolean;
};

export type RecalculationResult = {
  recalculatedAnswers: number;
  recalculatedQuestions: number;
};

export type QuizEvaluationBackfillStatus = {
  isComplete: boolean;
  incompleteAnswers: number;
  affectedQuestions: number;
};

export type QuizEvaluationBackfillBatchResult = RecalculationResult & {
  attemptedQuestions: number;
  failedQuestions: number;
  nextQuestionCursor: number | null;
  status: QuizEvaluationBackfillStatus;
};

function incompleteQuizEvaluationWhere(
  quizId: number,
): Prisma.team_antwortenWhereInput {
  return {
    quiz_id: quizId,
    OR: [
      {
        bewertungs_version: {
          not: CURRENT_QUIZ_ANSWER_EVALUATION_VERSION,
        },
      },
      {
        bewertungsquelle: "AUTO",
        bewertungsdetails: { equals: Prisma.DbNull },
      },
      {
        quiz_fragen: {
          punkte_modus: "risikofrage",
          OR: [
            { risiko_pool_teamanzahl: null },
            { risiko_pool_fixiert_am: null },
          ],
        },
      },
    ],
  };
}

async function getIncompleteQuizEvaluationGroups(
  quizId: number,
) {
  return prisma.team_antworten.groupBy({
    by: ["quiz_fragen_id"],
    where: incompleteQuizEvaluationWhere(quizId),
    _count: { _all: true },
    orderBy: { quiz_fragen_id: "asc" },
  });
}

export async function getQuizEvaluationBackfillStatus(
  quizId: number,
): Promise<QuizEvaluationBackfillStatus> {
  const groups = await getIncompleteQuizEvaluationGroups(quizId);
  return summarizeIncompleteEvaluations(
    groups.map((group) => ({
      quizQuestionId: group.quiz_fragen_id,
      incompleteAnswers: group._count._all,
    })),
  );
}

function orderingItems(config: Prisma.JsonValue | null) {
  const typed = config as QuestionTemplateConfig | null;
  return typed?.templateData?.kind === "ORDERING"
    ? typed.templateData.items.map((item) => item.id)
    : [];
}

async function recalculateQuizQuestionEvaluationInTransaction(
  quizQuestionId: number,
  options: RecalculationOptions,
  db: EvaluationDb,
): Promise<RecalculationResult> {
  const assignment = await db.quiz_fragen.findUnique({
    where: { quiz_fragen_id: quizQuestionId },
    include: {
      fragen: {
        include: {
          vorlage: { select: { code: true } },
          antworten: { select: { antwort_id: true, ist_richtig: true } },
          antwortfelder: {
            orderBy: { sortierung: "asc" },
            include: {
              loesungen: {
                where: { ist_akzeptiert: true },
                orderBy: { sortierung: "asc" },
              },
            },
          },
        },
      },
      team_antworten: {
        include: {
          antwortauswahlen: true,
          antwortfelder: true,
          submissions: {
            orderBy: [
              { submission_version: "desc" },
              { team_answer_submission_id: "desc" },
            ],
          },
          quiz_team_sessions: {
            select: { erstellt_am: true },
          },
        },
      },
    },
  });
  if (!assignment) throw new Error("Quizfrage nicht gefunden.");

  const templateId = assignment.fragen.vorlage?.code ?? null;
  const orderedItemIds = orderingItems(assignment.fragen.template_config_json);
  const maximum = getQuestionBaseMaximum({
    templateId,
    correctAnswerCount: assignment.fragen.antworten.filter(
      (answer) => answer.ist_richtig,
    ).length,
    structuredFieldCount: assignment.fragen.antwortfelder.length,
    orderingItemCount: orderedItemIds.length,
  });
  const answerMode = resolveQuizQuestionAnswerMode({
    templateId,
    answers: assignment.fragen.antworten.map((answer) => ({
      isCorrect: answer.ist_richtig,
    })),
    allowFreeAnswer: assignment.freie_antwort_erlaubt,
  });

  const automatic = assignment.team_antworten.map((answer) => {
    const effectiveSubmission = resolveEffectiveSubmission({
      interactionRunId: answer.interaction_run_id,
      draft: answer,
      submissions: answer.submissions,
    });
    const base = evaluateBaseAnswer({
      templateId,
      effectiveAnswerMode: answerMode.effectiveMode,
      answerOptions: assignment.fragen.antworten.map((option) => ({
        id: option.antwort_id,
        isCorrect: option.ist_richtig,
      })),
      selectedAnswerIds: effectiveSubmission?.selectedAnswerIds ?? [],
      answerText: effectiveSubmission?.answerText ?? null,
      structuredFields: assignment.fragen.antwortfelder.map((field) => ({
        id: field.antwortfeld_id,
        acceptedSolutions: field.loesungen.map(
          (solution) => solution.loesung_text,
        ),
      })),
      structuredAnswers: effectiveSubmission?.structuredAnswers ?? new Map(),
      orderingItems: orderedItemIds,
    });
    return {
      answer,
      hasEffectiveSubmission: effectiveSubmission !== null,
      result: evaluateQuestionPoints(base, assignment.punkte_modus),
    };
  });

  let riskPoolSize = assignment.risiko_pool_teamanzahl;
  let riskPoolFixedAt = assignment.risiko_pool_fixiert_am;
  if (
    assignment.punkte_modus === "risikofrage" &&
    shouldFreezeRiskPool({
      existingTeamCount: riskPoolSize,
      existingFixedAt: riskPoolFixedAt,
      hasEvaluations: automatic.some((entry) => entry.hasEffectiveSubmission),
      refreeze: options.refreezeRiskPool === true,
    })
  ) {
    const candidateFixedAt = new Date();
    const candidatePoolSize = await db.quiz_team_sessions.count({
      where: {
        quiz_id: assignment.quiz_id,
        erstellt_am: { lte: candidateFixedAt },
      },
    });
    if (options.refreezeRiskPool) {
      await db.quiz_fragen.update({
        where: { quiz_fragen_id: quizQuestionId },
        data: {
          risiko_pool_teamanzahl: candidatePoolSize,
          risiko_pool_fixiert_am: candidateFixedAt,
        },
      });
      riskPoolSize = candidatePoolSize;
      riskPoolFixedAt = candidateFixedAt;
    } else {
      const frozen = await db.quiz_fragen.updateMany({
        where: {
          quiz_fragen_id: quizQuestionId,
          OR: [
            { risiko_pool_teamanzahl: null },
            { risiko_pool_fixiert_am: null },
          ],
        },
        data: {
          risiko_pool_teamanzahl: candidatePoolSize,
          risiko_pool_fixiert_am: candidateFixedAt,
        },
      });
      if (frozen.count === 1) {
        riskPoolSize = candidatePoolSize;
        riskPoolFixedAt = candidateFixedAt;
      } else {
        const existingSnapshot = await db.quiz_fragen.findUniqueOrThrow({
          where: { quiz_fragen_id: quizQuestionId },
          select: {
            risiko_pool_teamanzahl: true,
            risiko_pool_fixiert_am: true,
          },
        });
        riskPoolSize = existingSnapshot.risiko_pool_teamanzahl;
        riskPoolFixedAt = existingSnapshot.risiko_pool_fixiert_am;
      }
    }
  }
  const prepared = automatic.map(({ answer, hasEffectiveSubmission, result }) => {
    const legacyManual =
      answer.bewertungsquelle === "LEGACY" &&
      (answer.ist_manuell_richtig ||
        answer.ist_manuell_falsch ||
        answer.bewertung_final ||
        answer.manuelle_punkte !== null);
    const preserveManual =
      hasEffectiveSubmission &&
      options.preserveManualOverrides !== false &&
      (answer.bewertungsquelle === "MANUAL" || legacyManual);
    return {
      answer,
      result,
      preserveManual,
      finalStatus: preserveManual ? answer.bewertungsstatus : result.status,
      finalSource: preserveManual ? "MANUAL" as const : "AUTO" as const,
      effectiveManualPoints:
        preserveManual && legacyManual
          ? (answer.manuelle_punkte ?? answer.vergebene_punkte)
          : preserveManual
            ? answer.manuelle_punkte
            : null,
    };
  });
  const riskAllocation =
    assignment.punkte_modus === "risikofrage" &&
    riskPoolSize !== null &&
    riskPoolFixedAt !== null
      ? allocateRiskQuestionPoints({
          teamPoolSize: riskPoolSize,
          evaluations: prepared.map((entry) => ({
            teamAnswerId: entry.answer.team_antwort_id,
            status: entry.finalStatus,
            source: entry.finalSource,
            manualPoints: entry.effectiveManualPoints,
            isPoolEligible: isRiskPoolEligible(
              entry.answer.quiz_team_sessions.erstellt_am,
              riskPoolFixedAt,
            ),
          })),
        })
      : null;
  const riskAllocationByAnswerId = new Map(
    riskAllocation?.allocations.map((allocation) => [
      allocation.teamAnswerId,
      allocation,
    ]) ?? [],
  );
  const requestedIds = new Set(options.answerIds);
  const evaluationsToPersist =
    assignment.punkte_modus === "risikofrage" || requestedIds.size === 0
      ? prepared
      : prepared.filter(({ answer }) =>
          requestedIds.has(answer.team_antwort_id),
        );

  await db.quiz_fragen.update({
    where: { quiz_fragen_id: quizQuestionId },
    data: { punkte_basis: maximum },
  });

  let recalculatedAnswers = 0;
  for (const {
    answer,
    result,
    preserveManual,
    finalStatus,
    effectiveManualPoints,
  } of evaluationsToPersist) {
    const allocatedRiskPoints = riskAllocationByAnswerId.get(
      answer.team_antwort_id,
    );
    const autoFinal =
      assignment.punkte_modus === "risikofrage"
        ? (allocatedRiskPoints?.autoFinalPoints ?? new Prisma.Decimal(0))
        : result.finalPoints;

    const resultOfUpdate = await db.team_antworten.updateMany({
      where: {
        team_antwort_id: answer.team_antwort_id,
        // Prevent an older automatic run from overwriting a manual update that
        // committed after this answer was loaded.
        bewertungsquelle: answer.bewertungsquelle,
        bewertet_am: answer.bewertet_am,
      },
      data: preserveManual
        ? {
            auto_basis_punkte: result.basePoints,
            auto_endpunkte: autoFinal,
            vergebene_punkte: effectiveManualPoints ?? autoFinal,
            bewertungsstatus: finalStatus,
            bewertungsdetails: result.details,
            bewertungs_version: CURRENT_QUIZ_ANSWER_EVALUATION_VERSION,
            bewertungsquelle: "MANUAL",
            manuelle_punkte: effectiveManualPoints,
          }
        : {
            auto_basis_punkte: result.basePoints,
            auto_endpunkte: autoFinal,
            vergebene_punkte: autoFinal,
            bewertungsstatus: result.status,
            bewertungsquelle: "AUTO",
            bewertungsdetails: result.details,
            bewertungs_version: CURRENT_QUIZ_ANSWER_EVALUATION_VERSION,
            manuelle_punkte: null,
            bewertet_am: null,
            bewertet_von_user_id: null,
            ist_manuell_richtig: false,
            ist_manuell_falsch: false,
            bewertung_final: false,
          },
    });
    recalculatedAnswers += resultOfUpdate.count;
  }

  const [correctAnswers, wrongAnswers] = await Promise.all([
    db.team_antworten.count({
      where: {
        quiz_fragen_id: quizQuestionId,
        bewertungsstatus: "CORRECT",
        ...(assignment.punkte_modus === "risikofrage" &&
        riskPoolFixedAt !== null
          ? {
              quiz_team_sessions: {
                erstellt_am: { lte: riskPoolFixedAt },
              },
            }
          : {}),
      },
    }),
    db.team_antworten.count({
      where: {
        quiz_fragen_id: quizQuestionId,
        bewertungsstatus: { in: ["WRONG", "PARTIAL"] },
        ...(assignment.punkte_modus === "risikofrage" &&
        riskPoolFixedAt !== null
          ? {
              quiz_team_sessions: {
                erstellt_am: { lte: riskPoolFixedAt },
              },
            }
          : {}),
      },
    }),
  ]);
  await db.quiz_fragen.update({
    where: { quiz_fragen_id: quizQuestionId },
    data: {
      richtigeantworten: correctAnswers,
      // PARTIAL is not fully correct; REVIEW_REQUIRED and UNANSWERED are not
      // finalized and are deliberately excluded from both counters.
      falscheantworten: wrongAnswers,
    },
  });
  const questionStatistics = await db.quiz_fragen.aggregate({
    where: { fragen_id: assignment.fragen_id },
    _sum: {
      richtigeantworten: true,
      falscheantworten: true,
    },
  });
  const totalCorrect = questionStatistics._sum.richtigeantworten ?? 0;
  const totalWrong = questionStatistics._sum.falscheantworten ?? 0;
  const totalFinal = totalCorrect + totalWrong;
  await db.fragen.update({
    where: { fragen_id: assignment.fragen_id },
    data: {
      schwierigkeitslevel:
        totalFinal === 0
          ? null
          : new Prisma.Decimal(totalWrong)
              .div(totalFinal)
              .mul(100)
              .toDecimalPlaces(0),
    },
  });
  const manualEvaluations = await db.team_antworten.count({
    where: {
      quiz_id: assignment.quiz_id,
      bewertungsquelle: "MANUAL",
    },
  });
  await db.quiz.update({
    where: { quiz_id: assignment.quiz_id },
    data: { manuelle_bewertungen: manualEvaluations },
  });

  return { recalculatedAnswers, recalculatedQuestions: 1 };
}

export async function recalculateQuizQuestionEvaluation(
  quizQuestionId: number,
  db?: EvaluationDb,
  options: RecalculationOptions = {},
): Promise<RecalculationResult> {
  if (db) {
    return recalculateQuizQuestionEvaluationInTransaction(
      quizQuestionId,
      options,
      db,
    );
  }
  return prisma.$transaction((tx) =>
    recalculateQuizQuestionEvaluationInTransaction(
      quizQuestionId,
      options,
      tx,
    ),
    {
      timeout: QUESTION_RECALCULATION_TRANSACTION_TIMEOUT_MS,
    },
  );
}

export async function recalculateQuizAnswerEvaluation(
  teamAnswerId: number,
  db?: EvaluationDb,
): Promise<RecalculationResult> {
  const execute = async (transaction: EvaluationDb) => {
    const answer = await transaction.team_antworten.findUnique({
      where: { team_antwort_id: teamAnswerId },
      select: { quiz_fragen_id: true },
    });
    if (!answer) throw new Error("Teamantwort nicht gefunden.");
    return recalculateQuizQuestionEvaluationInTransaction(
      answer.quiz_fragen_id,
      { preserveManualOverrides: true, answerIds: [teamAnswerId] },
      transaction,
    );
  };
  return db ? execute(db) : prisma.$transaction(execute);
}

export async function ensureQuizAnswerEvaluation(
  teamAnswerId: number,
): Promise<RecalculationResult> {
  const answer = await prisma.team_antworten.findUnique({
    where: { team_antwort_id: teamAnswerId },
  });
  if (!answer) throw new Error("Teamantwort nicht gefunden.");
  if (isEvaluationComplete(answer)) {
    return { recalculatedAnswers: 0, recalculatedQuestions: 0 };
  }
  return recalculateQuizAnswerEvaluation(teamAnswerId);
}

export async function ensureQuizQuestionEvaluation(
  quizQuestionId: number,
): Promise<RecalculationResult> {
  const incomplete = await prisma.team_antworten.findFirst({
    where: {
      quiz_fragen_id: quizQuestionId,
      OR: [
        {
          bewertungs_version: {
            not: CURRENT_QUIZ_ANSWER_EVALUATION_VERSION,
          },
        },
        {
          bewertungsquelle: "AUTO",
          bewertungsdetails: { equals: Prisma.DbNull },
        },
        {
          quiz_fragen: {
            punkte_modus: "risikofrage",
            OR: [
              { risiko_pool_teamanzahl: null },
              { risiko_pool_fixiert_am: null },
            ],
          },
        },
      ],
    },
    select: { team_antwort_id: true },
  });
  if (!incomplete) {
    return { recalculatedAnswers: 0, recalculatedQuestions: 0 };
  }
  return recalculateQuizQuestionEvaluation(quizQuestionId);
}

export async function ensureQuizEvaluation(
  quizId: number,
): Promise<RecalculationResult> {
  const incomplete = await prisma.team_antworten.findMany({
    where: {
      quiz_id: quizId,
      OR: [
        {
          bewertungs_version: {
            not: CURRENT_QUIZ_ANSWER_EVALUATION_VERSION,
          },
        },
        { bewertungsquelle: "AUTO", bewertungsdetails: { equals: Prisma.DbNull } },
        {
          quiz_fragen: {
            punkte_modus: "risikofrage",
            OR: [
              { risiko_pool_teamanzahl: null },
              { risiko_pool_fixiert_am: null },
            ],
          },
        },
      ],
    },
    select: { quiz_fragen_id: true },
    distinct: ["quiz_fragen_id"],
  });
  if (incomplete.length === 0) {
    return { recalculatedAnswers: 0, recalculatedQuestions: 0 };
  }
  let recalculatedAnswers = 0;
  for (const question of incomplete) {
    const result = await recalculateQuizQuestionEvaluation(
      question.quiz_fragen_id,
      undefined,
      { preserveManualOverrides: true },
    );
    recalculatedAnswers += result.recalculatedAnswers;
  }
  return {
    recalculatedAnswers,
    recalculatedQuestions: incomplete.length,
  };
}

export async function processQuizEvaluationBackfillBatch(
  quizId: number,
  options: {
    afterQuestionId?: number | null;
  } = {},
): Promise<QuizEvaluationBackfillBatchResult> {
  const incompleteGroups = await getIncompleteQuizEvaluationGroups(quizId);
  const candidates = selectEvaluationBackfillBatch(
    incompleteGroups.map((group) => ({
      quizQuestionId: group.quiz_fragen_id,
      incompleteAnswers: group._count._all,
    })),
    options.afterQuestionId ?? null,
  );
  const processed = await processEvaluationBackfillCandidates(
    candidates,
    (quizQuestionId) =>
      recalculateQuizQuestionEvaluation(quizQuestionId, undefined, {
        preserveManualOverrides: true,
      }),
  );
  for (const quizQuestionId of processed.failedQuestionIds) {
    console.error("Quiz evaluation backfill question failed.", {
      quizId,
      quizQuestionId,
    });
  }

  const status = await getQuizEvaluationBackfillStatus(quizId);
  return {
    recalculatedAnswers: processed.recalculatedAnswers,
    recalculatedQuestions: processed.recalculatedQuestions,
    attemptedQuestions: processed.attemptedQuestions,
    failedQuestions: processed.failedQuestionIds.length,
    nextQuestionCursor:
      status.isComplete || candidates.length === 0
        ? null
        : candidates.at(-1)!.quizQuestionId,
    status,
  };
}

export async function recalculateQuizEvaluation(
  quizId: number,
  options: Omit<RecalculationOptions, "answerIds"> = {},
): Promise<RecalculationResult> {
  const questions = await prisma.quiz_fragen.findMany({
    where: { quiz_id: quizId },
    select: { quiz_fragen_id: true },
  });
  let recalculatedAnswers = 0;
  for (const question of questions) {
    const result = await recalculateQuizQuestionEvaluation(
      question.quiz_fragen_id,
      undefined,
      options,
    );
    recalculatedAnswers += result.recalculatedAnswers;
  }
  return {
    recalculatedAnswers,
    recalculatedQuestions: questions.length,
  };
}
