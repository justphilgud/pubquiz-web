import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { getLogicalEnvironment } from "@/config/environment";
import { normalizeCategoryComparisonKey } from "@/app/fragen/editor/categoryPolicy";
import { VercelAiGatewayQuestionAutomationAdapter } from "./automation";
import { prepareExternalQuestion } from "./pipeline";
import { validateExternalQuestionEnrichment } from "./normalize";
import { OpenTdbProvider } from "./opentdbProvider";
import { canWriteOpenTdbPilot } from "./policy";
import type {
  DuplicateCandidate,
  ExternalQuestionAutomationAdapter,
  ExternalQuestionAutomationResult,
  ExternalQuestionIssueCode,
  ExternalQuestionQualityStatus,
  ExternalQuestionVerificationSource,
  PreparedExternalQuestion,
} from "./types";
import {
  EXTERNAL_QUESTION_PROVIDER,
  OPENTDB_LICENSE,
  OPENTDB_LICENSE_URL,
} from "./types";

const PILOT_SIZE = 100;
const PHASE_TWO_BATCH_ID = 1;
const PHASE_TWO_CHUNK_SIZE = 5;
const BLOCKING_APPROVAL_ISSUES = new Set<ExternalQuestionIssueCode>([
  "DUPLICATE_ANSWER",
  "MALFORMED_CONTENT",
  "MISSING_FACT_SOURCE",
  "MISSING_TRANSLATION",
  "FACT_AMBIGUOUS",
  "FACT_CONTRADICTED",
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

function verificationSourceArray(
  value: Prisma.JsonValue | null,
): ExternalQuestionVerificationSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      typeof entry.title !== "string" ||
      typeof entry.url !== "string"
    ) {
      return [];
    }
    return [{ title: entry.title, url: entry.url }];
  });
}

function itemStatus(question: PreparedExternalQuestion) {
  return question.qualityStatus;
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

async function refreshOpenTdbPhaseTwoReport(batchId: number) {
  const [batch, items] = await Promise.all([
    prisma.external_question_import_batches.findUniqueOrThrow({
      where: { import_batch_id: batchId },
      select: { fetched_count: true },
    }),
    prisma.external_question_import_items.findMany({
      where: { import_batch_id: batchId },
      select: {
        status: true,
        localization_status: true,
        verification_status: true,
        issue_codes: true,
        duplicate_candidates: true,
        automation_completed_at: true,
        automation_error: true,
      },
    }),
  ]);
  const count = (predicate: (item: (typeof items)[number]) => boolean) =>
    items.filter(predicate).length;
  const report = {
    fetched: batch.fetched_count,
    processed: count((item) => item.automation_completed_at !== null),
    automationFailed: count((item) => item.automation_error !== null),
    localized: count((item) => item.localization_status === "LOCALIZED"),
    localizationProblematic: count((item) =>
      item.localization_status === "REVIEW_REQUIRED" || item.localization_status === "FAILED"),
    verified: count((item) => item.verification_status === "VERIFIED"),
    contradicted: count((item) => item.verification_status === "CONTRADICTED"),
    ambiguous: count((item) => item.verification_status === "AMBIGUOUS"),
    noReliableSource: count((item) => item.verification_status === "NO_RELIABLE_SOURCE"),
    timeSensitive: count((item) => stringArray(item.issue_codes).includes("TIME_SENSITIVE")),
    localContext: count((item) => stringArray(item.issue_codes).includes("LOCALE_SPECIFIC")),
    possibleDuplicates: count((item) => duplicateArray(item.duplicate_candidates).length > 0),
    categoryProblem: count((item) => stringArray(item.issue_codes).includes("CATEGORY_UNMAPPED")),
    readyForReview: count((item) => item.status === "READY_FOR_REVIEW"),
    reviewRequired: count((item) => item.status === "REVIEW_REQUIRED"),
    rejectRecommended: count((item) => item.status === "REJECT_RECOMMENDED"),
  };
  await prisma.external_question_import_batches.update({
    where: { import_batch_id: batchId },
    data: { report_json: toJson(report), status: "REVIEW_READY" },
  });
  return report;
}

export async function processOpenTdbPhaseTwo(input: {
  batchId: number;
  adapter?: ExternalQuestionAutomationAdapter;
  authorizationToken?: string;
  retryFailures?: boolean;
  retryMissingSources?: boolean;
}) {
  assertOpenTdbPilotEnvironment();
  if (input.batchId !== PHASE_TWO_BATCH_ID) {
    throw new Error("OPENTDB_PHASE_TWO_EXISTING_BATCH_ONLY");
  }
  const batch = await prisma.external_question_import_batches.findUnique({
    where: { import_batch_id: input.batchId },
    select: { provider: true, fetched_count: true, status: true },
  });
  if (
    !batch ||
    batch.provider !== EXTERNAL_QUESTION_PROVIDER ||
    batch.fetched_count !== PILOT_SIZE ||
    batch.status === "FAILED"
  ) {
    throw new Error("OPENTDB_PHASE_TWO_BATCH_INVALID");
  }
  const [items, existingQuestions, categories] = await Promise.all([
    prisma.external_question_import_items.findMany({
      where: {
        import_batch_id: input.batchId,
        question_id: null,
        status: { notIn: ["APPROVED", "REJECTED"] },
        ...(input.retryFailures
          ? { automation_error: { not: null } }
          : input.retryMissingSources
            ? {
                automation_error: null,
                verification_status: "NO_RELIABLE_SOURCE" as const,
                review_started_at: null,
                manually_edited: false,
              }
            : { automation_completed_at: null }),
      },
      orderBy: { import_item_id: "asc" },
      take: PHASE_TWO_CHUNK_SIZE,
    }),
    prisma.fragen.findMany({
      where: { ist_archiviert: false },
      select: { fragen_id: true, frage: true },
    }),
    prisma.fragenkategorie.findMany({
      where: { status: "ACTIVE" },
      orderBy: { kategorie: "asc" },
      select: { fragenkategorie_id: true, kategorie: true },
    }),
  ]);
  const adapter = input.adapter ?? new VercelAiGatewayQuestionAutomationAdapter(
    fetch,
    input.authorizationToken,
  );
  const results = await Promise.all(items.map(async (item) => {
    const startedAt = new Date();
    await prisma.external_question_import_items.update({
      where: { import_item_id: item.import_item_id },
      data: {
        automation_started_at: startedAt,
        automation_completed_at: null,
        automation_error: null,
        automation_model: adapter.model,
      },
    });
    try {
      const question = {
        provider: EXTERNAL_QUESTION_PROVIDER,
        externalReference: item.external_reference,
        license: OPENTDB_LICENSE,
        licenseUrl: item.license_url as typeof OPENTDB_LICENSE_URL,
        originalLanguage: "en" as const,
        category: item.original_category,
        difficulty: item.original_difficulty as "easy" | "medium" | "hard",
        type: "multiple" as const,
        question: item.original_question,
        correctAnswer: item.original_correct_answer,
        incorrectAnswers: stringArray(item.original_incorrect_answers),
        providerPayload: item.provider_payload_json as never,
        contentFingerprint: item.content_fingerprint,
      };
      const automation = await adapter.process({
        question,
        availableCategories: categories.map((category) => category.kategorie),
      });
      const prepared = prepareExternalQuestion({
        question,
        automation,
        existingQuestions: existingQuestions.map((entry) => ({
          questionId: entry.fragen_id,
          question: entry.frage,
        })),
      });
      const category = categoryMatch(prepared.suggestedCategoryName, categories);
      await prisma.external_question_import_items.update({
        where: { import_item_id: item.import_item_id },
        data: {
          prepared_question: automation.enrichment.question,
          prepared_correct_answer: automation.enrichment.correctAnswer,
          prepared_incorrect_answers: toJson(automation.enrichment.incorrectAnswers),
          explanation: automation.enrichment.explanation,
          localization_status: automation.localizationStatus,
          localization_note: automation.localizationNote,
          verification_status: automation.verificationStatus,
          verification_note: automation.verificationNote,
          verification_source_url: automation.enrichment.verificationSourceUrl,
          verification_source_title: automation.enrichment.verificationSourceTitle,
          verification_sources: toJson(automation.verificationSources),
          verified_at: automation.verificationStatus === "VERIFIED" ? new Date() : null,
          suggested_category_id: category?.fragenkategorie_id ?? null,
          suggested_category_name: prepared.suggestedCategoryName,
          mapped_difficulty: prepared.mappedDifficulty,
          status: itemStatus(prepared),
          issue_codes: toJson(prepared.issues),
          duplicate_candidates: toJson(prepared.duplicateCandidates),
          automation_changes: toJson(automation.changes),
          automation_model: automation.model,
          automation_rejection_reason: automation.rejectionReason,
          automation_completed_at: new Date(),
          automation_error: null,
        },
      });
      return { itemId: item.import_item_id, ok: true as const };
    } catch (error) {
      const issues = new Set(stringArray(item.issue_codes) as ExternalQuestionIssueCode[]);
      issues.add("AUTOMATION_FAILED");
      const message = error instanceof Error ? error.message.slice(0, 1000) : "OPENTDB_AUTOMATION_UNKNOWN_ERROR";
      await prisma.external_question_import_items.update({
        where: { import_item_id: item.import_item_id },
        data: {
          localization_status: "FAILED",
          verification_status: "NOT_RUN",
          status: "REVIEW_REQUIRED",
          issue_codes: toJson([...issues]),
          automation_completed_at: new Date(),
          automation_error: message,
        },
      });
      return { itemId: item.import_item_id, ok: false as const, error: message };
    }
  }));
  const report = await refreshOpenTdbPhaseTwoReport(input.batchId);
  return {
    processed: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
    report,
  };
}

export async function startExternalQuestionReview(input: {
  itemId: number;
  userId: number;
}) {
  assertOpenTdbPilotEnvironment();
  await prisma.external_question_import_items.updateMany({
    where: {
      import_item_id: input.itemId,
      import_batch_id: PHASE_TWO_BATCH_ID,
      question_id: null,
      review_started_at: null,
    },
    data: {
      review_started_at: new Date(),
      reviewed_by_user_id: input.userId,
    },
  });
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
  const existingIssues = new Set(stringArray(item.issue_codes) as ExternalQuestionIssueCode[]);
  const existingSources = verificationSourceArray(item.verification_sources);
  const manualSources = enrichment.verificationSourceUrl
    ? [
        {
          title: enrichment.verificationSourceTitle ?? new URL(enrichment.verificationSourceUrl).hostname,
          url: enrichment.verificationSourceUrl,
        },
        ...existingSources.filter((source) => source.url !== enrichment.verificationSourceUrl),
      ]
    : [];
  const previousVerificationStatus = item.verification_status;
  const verificationStatus: ExternalQuestionAutomationResult["verificationStatus"] = enrichment.verificationSourceUrl
    ? previousVerificationStatus === "CONTRADICTED" || previousVerificationStatus === "AMBIGUOUS"
      ? previousVerificationStatus
      : "VERIFIED"
    : "NO_RELIABLE_SOURCE";
  const automation: ExternalQuestionAutomationResult = {
    enrichment,
    localizationStatus: "LOCALIZED" as const,
    localizationNote: item.localization_note,
    verificationStatus,
    verificationNote: item.verification_note ?? "Fachquelle im Review manuell gepflegt.",
    verificationSources: manualSources,
    flags: {
      ambiguous: existingIssues.has("AMBIGUOUS_QUESTION"),
      languageDependent: existingIssues.has("LANGUAGE_DEPENDENT"),
      localContext: existingIssues.has("LOCALE_SPECIFIC"),
      poorDistractor: existingIssues.has("POOR_DISTRACTOR"),
      sourceQualityLow: existingIssues.has("SOURCE_QUALITY_LOW"),
      timeSensitive: existingIssues.has("TIME_SENSITIVE"),
    },
    changes: [...stringArray(item.automation_changes), "Manuell im Review bearbeitet"],
    rejectRecommended: item.status === "REJECT_RECOMMENDED",
    rejectionReason: item.automation_rejection_reason,
    model: item.automation_model ?? "manual-review",
  };
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
    automation,
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
      localization_status: "LOCALIZED",
      verification_source_url: enrichment.verificationSourceUrl,
      verification_source_title: enrichment.verificationSourceTitle,
      verification_status: verificationStatus,
      verification_sources: toJson(manualSources),
      verified_at: verificationStatus === "VERIFIED" ? new Date() : null,
      suggested_category_id: category?.fragenkategorie_id ?? null,
      suggested_category_name:
        category?.kategorie ?? enrichment.suggestedCategoryName ?? prepared.suggestedCategoryName,
      status: itemStatus(prepared),
      issue_codes: toJson(prepared.issues),
      duplicate_candidates: toJson(prepared.duplicateCandidates),
      automation_changes: toJson(automation.changes),
      review_started_at: item.review_started_at ?? new Date(),
      review_edit_count: { increment: 1 },
      manually_edited: true,
    },
  });
  await refreshOpenTdbPhaseTwoReport(item.import_batch_id);
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
  const result = await prisma.$transaction(async (tx) => {
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
        review_started_at: item.review_started_at ?? now,
        reviewed_at: now,
        reviewed_by_user_id: input.userId,
      },
    });
    return { question, batchId: item.import_batch_id };
  });
  await refreshOpenTdbPhaseTwoReport(result.batchId);
  return result.question;
}

export async function rejectExternalQuestion(input: {
  itemId: number;
  userId: number;
  reason: string;
}) {
  assertOpenTdbPilotEnvironment();
  const reason = input.reason.trim();
  if (!reason || reason.length > 1000) throw new Error("REJECTION_REASON_INVALID");
  const item = await prisma.external_question_import_items.findUnique({
    where: { import_item_id: input.itemId },
    select: { import_batch_id: true, review_started_at: true },
  });
  if (!item) throw new Error("EXTERNAL_IMPORT_ITEM_NOT_REJECTABLE");
  await prisma.external_question_import_items.updateMany({
    where: { import_item_id: input.itemId, question_id: null },
    data: {
      status: "REJECTED",
      rejection_reason: reason,
      review_started_at: item.review_started_at ?? new Date(),
      reviewed_at: new Date(),
      reviewed_by_user_id: input.userId,
    },
  });
  await refreshOpenTdbPhaseTwoReport(item.import_batch_id);
}

export async function loadOpenTdbImportOverview(input: {
  batchId?: number;
  page?: number;
  pageSize?: number;
  qualityStatus?: ExternalQuestionQualityStatus;
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
      batchTotal: 0,
      qualityStatus: input.qualityStatus ?? null,
    };
  }

  const where = { import_batch_id: batch.import_batch_id };
  const itemWhere = input.qualityStatus
    ? { ...where, status: input.qualityStatus }
    : where;
  const [items, total, batchTotal, grouped, categories, metricItems] = await Promise.all([
    prisma.external_question_import_items.findMany({
      where: itemWhere,
      orderBy: { import_item_id: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { suggested_category: true, question: { select: { fragen_id: true } } },
    }),
    prisma.external_question_import_items.count({ where: itemWhere }),
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
        localization_status: true,
        verification_status: true,
        automation_completed_at: true,
        automation_error: true,
        review_started_at: true,
        review_edit_count: true,
        manually_edited: true,
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
  let localized = 0;
  let localizationProblematic = 0;
  let automationFailed = 0;
  let processed = 0;
  const verificationCounts: Record<string, number> = {};
  for (const item of metricItems) {
    const issues = stringArray(item.issue_codes);
    for (const issue of issues) increment(issueCounts, issue);
    if (duplicateArray(item.duplicate_candidates).length > 0) possibleDuplicates += 1;
    if (item.prepared_question) translated += 1;
    if (item.localization_status === "LOCALIZED") localized += 1;
    if (item.localization_status === "REVIEW_REQUIRED" || item.localization_status === "FAILED") {
      localizationProblematic += 1;
    }
    if (item.automation_completed_at) processed += 1;
    if (item.automation_error) automationFailed += 1;
    increment(verificationCounts, item.verification_status);
    if (item.verified_at) verified += 1;
    if (
      item.prepared_question &&
      item.verified_at &&
      !issues.some((issue) => BLOCKING_APPROVAL_ISSUES.has(issue as ExternalQuestionIssueCode))
    ) {
      fullyPrepared += 1;
    }
    if (item.rejection_reason) increment(rejectionReasonCounts, item.rejection_reason);
    if (item.reviewed_at && item.review_started_at) {
      reviewedMinutes += Math.max(
        0,
        (item.reviewed_at.getTime() - item.review_started_at.getTime()) / 60_000,
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
      verificationSources: verificationSourceArray(item.verification_sources),
      automationChanges: stringArray(item.automation_changes),
    })),
    total,
    batchTotal,
    page,
    pageSize,
    categories,
    counts,
    qualityStatus: input.qualityStatus ?? null,
    summary: {
      fetched: batch.fetched_count,
      autoRejected: counts.AUTO_REJECTED ?? 0,
      translated,
      localized,
      localizationProblematic,
      processed,
      automationFailed,
      verified,
      factCheckFailed: batchTotal - verified,
      verificationCounts,
      possibleDuplicates,
      reviewRequired: counts.REVIEW_REQUIRED ?? 0,
      readyForReview: counts.READY_FOR_REVIEW ?? 0,
      rejectRecommended: counts.REJECT_RECOMMENDED ?? 0,
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
