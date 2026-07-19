import type { GeneratorRunStatus } from "../types";

const allowedTransitions: Record<GeneratorRunStatus, readonly GeneratorRunStatus[]> = {
  PENDING: ["PROCESSING", "FAILED", "CANCELLED"],
  PROCESSING: ["SUCCEEDED", "FAILED", "CANCELLED"],
  SUCCEEDED: ["STALE"],
  FAILED: ["STALE"],
  STALE: [],
  CANCELLED: [],
};

export function canTransitionGeneratorRun(from: GeneratorRunStatus, to: GeneratorRunStatus) {
  return allowedTransitions[from].includes(to);
}

export function assertGeneratorRunTransition(from: GeneratorRunStatus, to: GeneratorRunStatus) {
  if (!canTransitionGeneratorRun(from, to)) throw new Error(`Ungültiger Generatorstatus: ${from} -> ${to}`);
}
