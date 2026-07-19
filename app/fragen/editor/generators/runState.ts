import type { GeneratorId, GeneratorParameters, GeneratorRunDraft, GeneratorRunStatus } from "../types";
import { normalizeGeneratorParameters } from "./parameters";

const generatorIds = new Set<GeneratorId>([
  "audio_reverse",
  "audio_bitcrush",
  "audio_chiptune",
  "image_pixelate",
  "image_face_morph",
  "text_to_speech",
]);
const statuses = new Set<GeneratorRunStatus>([
  "PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "STALE", "CANCELLED",
]);

export function mapGeneratorRun(run: {
  generator_lauf_id: number;
  generator_id: string;
  generator_version: number;
  status: string;
  input_fingerprint: string | null;
  error_code: string | null;
  parameters_json: unknown;
  medien: readonly { medien_id: number; rolle: string }[];
}): GeneratorRunDraft | null {
  if (!generatorIds.has(run.generator_id as GeneratorId) || !statuses.has(run.status as GeneratorRunStatus)) {
    return null;
  }
  const generatorId = run.generator_id as GeneratorId;
  const parameters = generatorId === "image_pixelate" && run.generator_version === 1
    ? {}
    : normalizeGeneratorParameters(generatorId, run.parameters_json);
  if (!parameters) return null;
  return {
    id: run.generator_lauf_id,
    generatorId: run.generator_id as GeneratorId,
    generatorVersion: run.generator_version,
    status: run.status as GeneratorRunStatus,
    inputFingerprint: run.input_fingerprint,
    errorCode: run.error_code,
    parameters: parameters as GeneratorParameters,
    inputMediaIds: run.medien.filter((medium) => medium.rolle === "INPUT").map((medium) => medium.medien_id),
    outputMediaIds: run.medien.filter((medium) => medium.rolle === "OUTPUT").map((medium) => medium.medien_id),
  };
}
