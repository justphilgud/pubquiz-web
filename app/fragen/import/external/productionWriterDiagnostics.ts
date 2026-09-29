export type ProductionWriterPhase =
  | "AUTHORIZATION"
  | "WRITER_SECRET"
  | "DB_CONNECTION"
  | "DB_IDENTITY"
  | "TRANSACTION_BEGIN"
  | "QUESTION_CREATE"
  | "ANSWERS"
  | "CATEGORIES"
  | "SOURCES"
  | "EXTERNAL_MAPPING"
  | "AUDIT"
  | "COMMIT"
  | "SELF_CLOSE";

export type ProductionWriterOperation =
  | "verify"
  | "connect"
  | "read"
  | "insert"
  | "update"
  | "commit"
  | "close";

const allowedRelations = new Set([
  "none",
  "antworten",
  "antworttyp",
  "benutzer_rollenzuweisungen",
  "external_question_import_batches",
  "external_question_import_items",
  "fragen",
  "fragen_kategorien",
  "fragenkategorie",
  "users",
]);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeSqlState(error: unknown) {
  const queue: unknown[] = [error];
  const visited = new Set<unknown>();
  let fallback = "none";
  for (let depth = 0; depth < 6 && queue.length > 0; depth += 1) {
    const value = queue.shift();
    if (!record(value) || visited.has(value)) continue;
    visited.add(value);
    const originalCode = value.originalCode;
    if (typeof originalCode === "string" && /^[0-9A-Z]{5}$/.test(originalCode)) {
      return originalCode;
    }
    const code = value.code;
    if (fallback === "none" && typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      fallback = code;
    }
    for (const key of ["meta", "driverAdapterError", "cause"] as const) {
      if (record(value[key])) queue.push(value[key]);
    }
  }
  return fallback;
}

function safeRelation(error: unknown, fallback: string) {
  const table = record(error) && typeof error.table === "string" ? error.table : fallback;
  return allowedRelations.has(table) ? table : "none";
}

function safeCause(error: unknown) {
  return error instanceof Error && /^EXTERNAL_IMPORT_[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "WITHHELD";
}

function isSafeStructuredFailure(value: string) {
  return /^EXTERNAL_IMPORT_WRITE_PHASE_FAILURE\|phase=[A-Z_]+\|candidate=(?:none|[A-Za-z0-9._:-]{1,128})\|operation=(?:verify|connect|read|insert|update|commit|close)\|relation=(?:none|antworten|antworttyp|benutzer_rollenzuweisungen|external_question_import_batches|external_question_import_items|fragen|fragen_kategorien|fragenkategorie|users)\|sqlstate=(?:none|[0-9A-Z]{5})\|cause=(?:WITHHELD|EXTERNAL_IMPORT_[A-Z0-9_]+)$/.test(value);
}

export class ProductionWriterPhaseError extends Error {
  readonly phase: ProductionWriterPhase;
  readonly sqlState: string;
  readonly relation: string;
  readonly safeCause: string;

  constructor(
    phase: ProductionWriterPhase,
    readonly operation: ProductionWriterOperation,
    readonly candidateId: string,
    relation: string,
    error: unknown,
  ) {
    super("EXTERNAL_IMPORT_WRITE_PHASE_FAILURE", { cause: error });
    this.name = "ProductionWriterPhaseError";
    const resolvedRelation = safeRelation(error, relation);
    this.phase = phase === "QUESTION_CREATE" && resolvedRelation === "antworten"
      ? "ANSWERS"
      : phase === "QUESTION_CREATE" && resolvedRelation === "fragen_kategorien"
        ? "CATEGORIES"
        : phase;
    this.sqlState = safeSqlState(error);
    this.relation = resolvedRelation;
    this.safeCause = safeCause(error);
  }
}

export async function runProductionWriterPhase<T>(
  phase: ProductionWriterPhase,
  input: Readonly<{
    operation: ProductionWriterOperation;
    candidateId?: string;
    relation?: string;
  }>,
  action: () => Promise<T> | T,
) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ProductionWriterPhaseError) throw error;
    throw new ProductionWriterPhaseError(
      phase,
      input.operation,
      input.candidateId && /^[A-Za-z0-9._:-]{1,128}$/.test(input.candidateId)
        ? input.candidateId
        : "none",
      input.relation ?? "none",
      error,
    );
  }
}

export function safeProductionWriterFailure(error: unknown) {
  if (error instanceof ProductionWriterPhaseError) {
    return [
      error.message,
      `phase=${error.phase}`,
      `candidate=${error.candidateId}`,
      `operation=${error.operation}`,
      `relation=${error.relation}`,
      `sqlstate=${error.sqlState}`,
      `cause=${error.safeCause}`,
    ].join("|");
  }
  if (error instanceof Error && isSafeStructuredFailure(error.message)) {
    return error.message;
  }
  return error instanceof Error && /^EXTERNAL_IMPORT_[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "EXTERNAL_IMPORT_WRITE_FAILED_DETAILS_WITHHELD";
}
