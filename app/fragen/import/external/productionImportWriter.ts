import type {
  ExternalImportGuardResult,
  ExternalImportPlan,
  ExternalImportPlanItem,
  ExternalImportPreflight,
  OneTimeExternalImportAuthorization,
} from "./productionImportGuard";

export type ExternalImportItemAuditStatus =
  | "IMPORTED"
  | "ALREADY_PRESENT"
  | "FAILED"
  | "NOT_RUN";

export type ExternalImportItemAudit = Readonly<{
  candidateId: string;
  externalReference: string;
  status: ExternalImportItemAuditStatus;
  questionId: number | null;
  reason: string;
  mediaPrepared: number;
  orphanedMedia: readonly string[];
}>;

export type ExternalImportWriteAudit = Readonly<{
  version: 1;
  batchId: string;
  planDigest: string;
  productionSha: string;
  backupId: string;
  workflowRun: string;
  startedAt: string;
  completedAt: string;
  result: "COMPLETED" | "FAILED" | "ABORTED";
  reviewerGate: "VERIFIED";
  preflight: ExternalImportPreflight["counts"];
  items: readonly ExternalImportItemAudit[];
  writeAuthorized: false;
}>;

export type PreparedExternalImportMedium = Readonly<{
  target: string;
  reference: string;
}>;

export async function runProductionExternalImport(input: {
  guard: ExternalImportGuardResult;
  authorization: OneTimeExternalImportAuthorization;
  plan: ExternalImportPlan;
  planDigest: string;
  productionSha: string;
  backupId: string;
  workflowRun: string;
  preflight: ExternalImportPreflight;
  now?: () => Date;
  signal?: AbortSignal;
  prepareMedia?: (
    item: ExternalImportPlanItem,
  ) => Promise<readonly PreparedExternalImportMedium[]>;
  importItem: (
    item: ExternalImportPlanItem,
    media: readonly PreparedExternalImportMedium[],
  ) => Promise<Readonly<{ questionId: number; alreadyPresent?: boolean }>>;
  recordAudit?: (audit: ExternalImportWriteAudit) => Promise<void>;
  classifyItemError?: (error: unknown) => string;
}): Promise<ExternalImportWriteAudit> {
  const now = input.now ?? (() => new Date());
  const startedAt = now().toISOString();
  return input.authorization.run(input.guard, async () => {
    const audits: ExternalImportItemAudit[] = [];
    let result: ExternalImportWriteAudit["result"] = "COMPLETED";
    let stopped = false;
    for (const item of input.plan.items) {
      const decision = input.preflight.items.find(
        (entry) => entry.candidateId === item.candidateId,
      );
      if (!decision) throw new Error("EXTERNAL_IMPORT_PREFLIGHT_ITEM_MISSING");
      if (stopped) {
        audits.push({
          candidateId: item.candidateId,
          externalReference: item.externalReference,
          status: "NOT_RUN",
          questionId: null,
          reason: result === "ABORTED" ? "BATCH_ABORTED" : "EARLIER_ITEM_FAILED",
          mediaPrepared: 0,
          orphanedMedia: [],
        });
        continue;
      }
      if (input.signal?.aborted) {
        result = "ABORTED";
        stopped = true;
        audits.push({
          candidateId: item.candidateId,
          externalReference: item.externalReference,
          status: "NOT_RUN",
          questionId: null,
          reason: "BATCH_ABORTED",
          mediaPrepared: 0,
          orphanedMedia: [],
        });
        continue;
      }
      if (decision.decision === "ALREADY_PRESENT") {
        audits.push({
          candidateId: item.candidateId,
          externalReference: item.externalReference,
          status: "ALREADY_PRESENT",
          questionId: decision.existingQuestionId,
          reason: decision.reason,
          mediaPrepared: 0,
          orphanedMedia: [],
        });
        continue;
      }
      if (decision.decision !== "CREATE") {
        throw new Error("EXTERNAL_IMPORT_PREFLIGHT_NOT_WRITABLE");
      }

      let media: readonly PreparedExternalImportMedium[] = [];
      try {
        if (item.media.length > 0 && !input.prepareMedia) {
          throw new Error("EXTERNAL_IMPORT_MEDIA_ADAPTER_REQUIRED");
        }
        media = item.media.length > 0 ? await input.prepareMedia!(item) : [];
        if (media.length !== item.media.length) {
          throw new Error("EXTERNAL_IMPORT_MEDIA_PREPARATION_INCOMPLETE");
        }
        const imported = await input.importItem(item, media);
        audits.push({
          candidateId: item.candidateId,
          externalReference: item.externalReference,
          status: imported.alreadyPresent ? "ALREADY_PRESENT" : "IMPORTED",
          questionId: imported.questionId,
          reason: imported.alreadyPresent ? "RACE_RESOLVED_ALREADY_PRESENT" : "ATOMIC_IMPORT_COMMITTED",
          mediaPrepared: media.length,
          orphanedMedia: [],
        });
      } catch (error) {
        result = input.signal?.aborted ? "ABORTED" : "FAILED";
        stopped = true;
        const code = input.classifyItemError
          ? input.classifyItemError(error)
          : error instanceof Error && /^EXTERNAL_IMPORT_[A-Z0-9_]+$/.test(error.message)
            ? error.message
            : "EXTERNAL_IMPORT_ITEM_FAILED_DETAILS_WITHHELD";
        audits.push({
          candidateId: item.candidateId,
          externalReference: item.externalReference,
          status: "FAILED",
          questionId: null,
          reason: code,
          mediaPrepared: media.length,
          orphanedMedia: media.map((medium) => medium.reference),
        });
      }
    }
    const audit: ExternalImportWriteAudit = {
      version: 1,
      batchId: input.plan.batchId,
      planDigest: input.planDigest,
      productionSha: input.productionSha,
      backupId: input.backupId,
      workflowRun: input.workflowRun,
      startedAt,
      completedAt: now().toISOString(),
      result,
      reviewerGate: "VERIFIED",
      preflight: input.preflight.counts,
      items: audits,
      writeAuthorized: false,
    };
    if (input.recordAudit) await input.recordAudit(audit);
    return audit;
  });
}
