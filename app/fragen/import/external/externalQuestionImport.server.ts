import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { getLogicalEnvironment } from "@/config/environment";
import { normalizeCategoryComparisonKey } from "@/app/fragen/editor/categoryPolicy";
import { prepareExternalQuestion } from "./pipeline";
import { validateExternalQuestionEnrichment } from "./normalize";
import { OpenTdbProvider } from "./opentdbProvider";
import { canWriteOpenTdbPilot } from "./policy";
import type {
  DuplicateCandidate,
  ExternalQuestionIssueCode,
  PreparedExternalQuestion,
} from "./types";
import { EXTERNAL_QUESTION_PROVIDER } from "./types";

const PILOT_SIZE = 100;
const BLOCKING_APPROVAL_ISSUES = new Set<ExternalQuestionIssueCode>([
  "DUPLICATE_ANSWER",
  "MALFORMED_CONTENT",
  "MISSING_FACT_SOURCE",
  "MISSING_TRANSLATION",
  "POTENTIAL_EXACT_DUPLICATE",
  "UNSUPPORTED_TYPE",
]);

export function assertOpenTdbPilotEnvironment() {
  const environment = getLogicalEnvironment();
  if (!canWriteOpenTdbPilot({
    environment,
    allowLocal: process.env.OPENTDB_PILOT_ALLOW_LOCAL === "true",
  })) {
    throw new Error("OPENTDB_PILOT_PREVIEW_ONLY");
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function stringArray(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function duplicateArray(value: Prisma.JsonValue | null): DuplicateCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      typeof entry.questionId !== "number" ||
      typeof entry.question !== "string" ||
      typeof entry.similarity !== "number" ||
      (entry.kind !== "EXACT" && entry.kind !== "SEMANTIC")
    ) {
      return [];
    }
    return [{
      questionId: entry.questionId,
      question: entry.question,
      similarity: entry.similarity,
      kind: entry.kind,
    }];
  });
}

function itemStatus(question: PreparedExternalQuestion) {
  return question.autoRejected ? "AUTO_REJECTED" as const : "REVIEW_REQUIRED" as const;
}

function increment(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function categoryMatch(
  suggestedName: string,
  categories: ReadonlyArray<{ fragenkategorie_id: number; kategorie: string }>,
) {
  const key = normalizeCategoryComparisonKey(suggestedName, "de");
  return categories.find(
    (category) =>
      normalizeCategoryComparisonKey(category.kategorie, "de") === key,
  ) ?? null;
}

export async function startOpenTdbPilot(input: { userId: number }) {
  assertOpenTdbPilotEnvironment();
  const existingPilot = await prisma.external_question_import_batches.findFirst({
    where: {
      provider: EXTERNAL_QUESTION_PROVIDER,
      requested_count: PILOT_SIZE,
      status: { in: ["FETCHING", "PROCESSING", "REVIEW_READY", "COMPLETED"] },
    },
    orderBy: { started_at: "desc" },
    select: { import_batch_id: true, status: true, fetched_count: true },
  });
  if (existingPilot) return { ...existingPilot, reused: true };

  const batch = await prisma.external_question_import_batches.create({
    data: {
      provider: EXTERNAL_QUESTION_PROVIDER,
      requested_count: PILOT_SIZE,
      created_by_user_id: input.userId,
    },
    select: { import_batch_id: true },
  });

  try {
    const provider = new OpenTdbProvider();
    const [previousItems, existingQuestions, categories] = await Promise.all([
      prisma.external_question_import_items.findMany({
        where: { provider: EXTERNAL_QUESTION_PROVIDER },
        select: { external_reference: true },
      }),
      prisma.fragen.findMany({
        where: { ist_archiviert: false },
        select: { fragen_id: true, frage: true },
      }),
      prisma.fragenkategorie.findMany({
        where: { status: "ACTIVE" },
        select: { fragenkategorie_id: true, kategorie: true },
      }),
    ]);
    const questions = await provider.fetchQuestions({
      count: PILOT_SIZE,
      excludeExternalReferences: previousItems.map((item) => item.external_reference),
    });
    await prisma.external_question_import_batches.update({
      where: { import_batch_id: batch.import_batch_id },
      data: { status: "PROCESSING", fetched_count: questions.length },
    });

    let autoRejected = 0;
    let reviewRequired = 0;
    let possibleDuplicates = 0;
    for (const question of questions) {
      const prepared = prepareExternalQuestion({
        question,
        existingQuestions: existingQuestions.map((entry) => ({
          questionId: entry.fragen_id,
          question: entry.frage,
        })),
      });
      const category = categoryMatch(prepared.suggestedCategoryName, categories);
      const status = itemStatus(prepared);
      if (status === "AUTO_REJECTED") autoRejected += 1;
      else reviewRequired += 1;
      if (prepared.duplicateCandidates.length > 0) possibleDuplicates += 1;

      try {
        await prisma.external_question_import_items.create({
          data: {
            import_batch_id: batch.import_batch_id,
            provider: question.provider,
            external_reference: question.externalReference,
            license: question.license,
            license_url: question.licenseUrl,
            original_language: question.originalLanguage,
            original_category: question.category,
            original_difficulty: question.difficulty,
            original_type: question.type,
            original_question: question.question,
            original_correct_answer: question.correctAnswer,
            original_incorrect_answers: toJson(question.incorrectAnswers),
            provider_payload_json: toJson(question.providerPayload),
            suggested_category_id: category?.fragenkategorie_id ?? null,
            suggested_category_name: prepared.suggestedCategoryName,
            mapped_difficulty: prepared.mappedDifficulty,
            status,
            issue_codes: toJson(prepared.issues),
            duplicate_candidates: toJson(prepared.duplicateCandidates),
            content_fingerprint: question.contentFingerprint,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }
        throw error;
      }
    }

    const storedCount = await prisma.external_question_import_items.count({
      where: { import_batch_id: batch.import_batch_id },
    });
    if (storedCount !== PILOT_SIZE) {
      throw new Error(`OPENTDB_PILOT_STORED_COUNT_${storedCount}`);
    }
    const report = {
      fetched: questions.length,
      autoRejected,
      reviewRequired,
      translated: 0,
      factCheckPassed: 0,
      factCheckFailed: reviewRequired,
      possibleDuplicates,
      fullyPrepared: 0,
      approved: 0,
      rejected: 0,
    };
    await prisma.external_question_import_batches.update({
      where: { import_batch_id: batch.import_batch_id },
      data: {
        status: "REVIEW_READY",
        completed_at: new Date(),
        report_json: toJson(report),
      },
    });
    return {
      import_batch_id: batch.import_batch_id,
      status: "REVIEW_READY" as const,
      fetched_count: questions.length,
      reused: false,
    };
  } catch (error) {
    await prisma.external_question_import_batches.update({
      where: { import_batch_id: batch.import_batch_id },
      data: {
        status: "FAILED",
        completed_at: new Date(),
        error_message: error instanceof Error ? error.message.slice(0, 1000) : "UNKNOWN",
      },
    });
    throw error;
  }
}

export async function saveExternalQuestionPreparation(input: {
  itemId: number;
  enrichment: unknown;
  categoryId: number | null;
}) {
  assertOpenTdbPilotEnvironment();
  const enrichment = validateExternalQuestionEnrichment(input.enrichment);
  if (!enrichment) throw new Error("EXTERNAL_ENRICHMENT_INVALID");
  const item = await prisma.external_question_import_items.findUnique({
    where: { import_item_id: input.itemId },
  });
  if (!item || item.provider !== EXTERNAL_QUESTION_PROVIDER || item.question_id !== null) {
    throw new Error("EXTERNAL_IMPORT_ITEM_NOT_EDITABLE");
  }
  const existingQuestions = await prisma.fragen.findMany({
    where: { ist_archiviert: false },
    select: { fragen_id: true, frage: true },
  });
  const prepared = prepareExternalQuestion({
    question: {
      provider: EXTERNAL_QUESTION_PROVIDER,
      externalReference: item.external_reference,
      license: "CC BY-SA 4.0",
      licenseUrl: item.license_url as "https://creativecommons.org/licenses/by-sa/4.0/",
      originalLanguage: "en",
      category: item.original_category,
      difficulty: item.original_difficulty as "easy" | "medium" | "hard",
      type: "multiple",
      question: item.original_question,
      correctAnswer: item.original_correct_answer,
      incorrectAnswers: stringArray(item.original_incorrect_answers),
      providerPayload: item.provider_payload_json as never,
      contentFingerprint: item.content_fingerprint,
    },
    enrichment,
    existingQuestions: existingQuestions.map((entry) => ({
      questionId: entry.fragen_id,
      question: entry.frage,
    })),
  });
  const category = input.categoryId === null
    ? null
    : await prisma.fragenkategorie.findFirst({
        where: { fragenkategorie_id: input.categoryId, status: "ACTIVE" },
        select: { fragenkategorie_id: true, kategorie: true },
      });
  if (input.categoryId !== null && !category) throw new Error("CATEGORY_NOT_ACTIVE");

  await prisma.external_question_import_items.update({
    where: { import_item_id: input.itemId },
    data: {
      prepared_question: enrichment.question,
      prepared_correct_answer: enrichment.correctAnswer,
      prepared_incorrect_answers: toJson(enrichment.incorrectAnswers),
      explanation: enrichment.explanation,
      verification_source_url: enrichment.verificationSourceUrl,
      verification_source_title: enrichment.verificationSourceTitle,
      verified_at: enrichment.verificationSourceUrl ? new Date() : null,
      suggested_category_id: category?.fragenkategorie_id ?? null,
      suggested_category_name:
        category?.kategorie ?? enrichment.suggestedCategoryName ?? prepared.suggestedCategoryName,
      status: itemStatus(prepared),
      issue_codes: toJson(prepared.issues),
      duplicate_candidates: toJson(prepared.duplicateCandidates),
    },
  });
}

function attributionSource(item: {
  verification_source_title: string | null;
  verification_source_url: string | null;
  external_reference: string;
}) {
  const factSource = item.verification_source_url
    ? `${item.verification_source_title ?? "Fachquelle"}: ${item.verification_source_url}`
    : "";
  return [
    factSource,
    `Adaptiert/übersetzt aus OpenTDB (${item.external_reference}), CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/`,
  ].filter(Boolean).join(" · ").slice(0, 1000);
}

export async function approveExternalQuestion(input: { itemId: number; userId: number }) {
  assertOpenTdbPilotEnvironment();
  return prisma.$transaction(async (tx) => {
    const item = await tx.external_question_import_items.findUnique({
      where: { import_item_id: input.itemId },
    });
    if (!item || item.question_id !== null || item.status === "REJECTED") {
      throw new Error("EXTERNAL_IMPORT_ITEM_NOT_APPROVABLE");
    }
    const issues = stringArray(item.issue_codes) as ExternalQuestionIssueCode[];
    const blocking = issues.filter((issue) => BLOCKING_APPROVAL_ISSUES.has(issue));
    if (blocking.length > 0) {
      throw new Error(`EXTERNAL_IMPORT_BLOCKED:${blocking.join(",")}`);
    }
    if (!item.prepared_question || !item.prepared_correct_answer) {
      throw new Error("EXTERNAL_IMPORT_PREPARATION_MISSING");
    }
    const incorrectAnswers = stringArray(item.prepared_incorrect_answers);
    if (incorrectAnswers.length !== 3) throw new Error("EXTERNAL_IMPORT_ANSWERS_INVALID");
    const standardAnswerType = await tx.antworttyp.findFirst({
      where: { antworttyp: { equals: "Standard", mode: "insensitive" } },
      select: { antworttyp_id: true },
    });
    if (!standardAnswerType) throw new Error("STANDARD_ANSWER_TYPE_MISSING");

    const now = new Date();
    const question = await tx.fragen.create({
      data: {
        frage: item.prepared_question,
        quelle: attributionSource(item),
        fragentyp: "Multiple Choice",
        schwierigkeitslevel: item.mapped_difficulty,
        created_by_user_id: input.userId,
        last_modified_by_user_id: input.userId,
        freigegeben: false,
        ist_unfertig: false,
        review_status: "IN_REVIEW",
        submitted_at: now,
        submitted_by_user_id: input.userId,
        moderationsnotizen: item.explanation,
        kategorienwunsch: item.suggested_category_id === null
          ? item.suggested_category_name
          : null,
        antworten: {
          create: [
            {
              antwort: item.prepared_correct_answer,
              ist_richtig: true,
              antworttyp_id: standardAnswerType.antworttyp_id,
            },
            ...incorrectAnswers.map((answer) => ({
              antwort: answer,
              ist_richtig: false,
              antworttyp_id: standardAnswerType.antworttyp_id,
            })),
          ],
        },
        ...(item.suggested_category_id !== null
          ? {
              fragen_kategorien: {
                create: { fragenkategorie_id: item.suggested_category_id },
              },
            }
          : {}),
      },
      select: { fragen_id: true },
    });
    await tx.external_question_import_items.update({
      where: { import_item_id: item.import_item_id },
      data: {
        status: "APPROVED",
        question_id: question.fragen_id,
        reviewed_at: now,
        reviewed_by_user_id: input.userId,
      },
    });
    return question;
  });
}

export async function rejectExternalQuestion(input: {
  itemId: number;
  userId: number;
  reason: string;
}) {
  assertOpenTdbPilotEnvironment();
  const reason = input.reason.trim();
  if (!reason || reason.length > 1000) throw new Error("REJECTION_REASON_INVALID");
  await prisma.external_question_import_items.updateMany({
    where: { import_item_id: input.itemId, question_id: null },
    data: {
      status: "REJECTED",
      rejection_reason: reason,
      reviewed_at: new Date(),
      reviewed_by_user_id: input.userId,
    },
  });
}

export async function loadOpenTdbImportOverview(input: {
  batchId?: number;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
  const page = Math.max(1, input.page ?? 1);
  const batches = await prisma.external_question_import_batches.findMany({
    where: { provider: EXTERNAL_QUESTION_PROVIDER },
    orderBy: { started_at: "desc" },
    take: 10,
  });
  const batch = input.batchId
    ? batches.find((candidate) => candidate.import_batch_id === input.batchId) ?? null
    : batches[0] ?? null;
  if (!batch) {
    return {
      batches,
      batch: null,
      items: [],
      total: 0,
      page,
      pageSize,
      categories: [],
      counts: {} as Record<string, number>,
      summary: null,
    };
  }

  const where = { import_batch_id: batch.import_batch_id };
  const [items, total, grouped, categories, metricItems] = await Promise.all([
    prisma.external_question_import_items.findMany({
      where,
      orderBy: { import_item_id: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { suggested_category: true, question: { select: { fragen_id: true } } },
    }),
    prisma.external_question_import_items.count({ where }),
    prisma.external_question_import_items.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.fragenkategorie.findMany({
      where: { status: "ACTIVE" },
      orderBy: { kategorie: "asc" },
      select: { fragenkategorie_id: true, kategorie: true },
    }),
    prisma.external_question_import_items.findMany({
      where,
      select: {
        status: true,
        issue_codes: true,
        duplicate_candidates: true,
        prepared_question: true,
        verified_at: true,
        imported_at: true,
        reviewed_at: true,
        rejection_reason: true,
      },
    }),
  ]);
  const issueCounts: Record<string, number> = {};
  const rejectionReasonCounts: Record<string, number> = {};
  let possibleDuplicates = 0;
  let translated = 0;
  let verified = 0;
  let fullyPrepared = 0;
  let reviewedMinutes = 0;
  let reviewedCount = 0;
  for (const item of metricItems) {
    const issues = stringArray(item.issue_codes);
    for (const issue of issues) increment(issueCounts, issue);
    if (duplicateArray(item.duplicate_candidates).length > 0) possibleDuplicates += 1;
    if (item.prepared_question) translated += 1;
    if (item.verified_at) verified += 1;
    if (
      item.prepared_question &&
      item.verified_at &&
      !issues.some((issue) => BLOCKING_APPROVAL_ISSUES.has(issue as ExternalQuestionIssueCode))
    ) {
      fullyPrepared += 1;
    }
    if (item.rejection_reason) increment(rejectionReasonCounts, item.rejection_reason);
    if (item.reviewed_at) {
      reviewedMinutes += Math.max(
        0,
        (item.reviewed_at.getTime() - item.imported_at.getTime()) / 60_000,
      );
      reviewedCount += 1;
    }
  }
  const counts = Object.fromEntries(
    grouped.map((entry) => [entry.status, entry._count._all]),
  ) as Record<string, number>;
  return {
    batches,
    batch,
    items: items.map((item) => ({
      ...item,
      originalIncorrectAnswers: stringArray(item.original_incorrect_answers),
      preparedIncorrectAnswers: stringArray(item.prepared_incorrect_answers),
      issues: stringArray(item.issue_codes),
      duplicates: duplicateArray(item.duplicate_candidates),
    })),
    total,
    page,
    pageSize,
    categories,
    counts,
    summary: {
      fetched: batch.fetched_count,
      autoRejected: counts.AUTO_REJECTED ?? 0,
      translated,
      verified,
      factCheckFailed: total - verified,
      possibleDuplicates,
      reviewRequired: counts.REVIEW_REQUIRED ?? 0,
      fullyPrepared,
      approved: counts.APPROVED ?? 0,
      rejected: counts.REJECTED ?? 0,
      acceptanceRate: total > 0 ? (counts.APPROVED ?? 0) / total : 0,
      averageReviewMinutes: reviewedCount > 0 ? reviewedMinutes / reviewedCount : null,
      issueCounts,
      rejectionReasonCounts,
    },
  };
}
