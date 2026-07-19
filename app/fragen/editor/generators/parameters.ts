import type { GeneratorId, GeneratorParameters } from "../types";
import { PIXEL_STAGE_PRESET } from "./pixelConfiguration";

export function getDefaultGeneratorParameters(generatorId: GeneratorId): GeneratorParameters {
  if (generatorId === "audio_bitcrush") return { preset: "classic" };
  if (generatorId === "image_pixelate") return { stagePreset: PIXEL_STAGE_PRESET };
  return {};
}

export function normalizeGeneratorParameters(
  generatorId: GeneratorId,
  value: unknown,
): GeneratorParameters | null {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (generatorId === "audio_bitcrush") {
    return candidate.preset === undefined || candidate.preset === "classic"
      ? { preset: "classic" }
      : null;
  }
  if (generatorId === "image_pixelate") {
    return candidate.stagePreset === undefined || candidate.stagePreset === PIXEL_STAGE_PRESET
      ? { stagePreset: PIXEL_STAGE_PRESET }
      : null;
  }
  return Object.keys(candidate).length === 0 ? {} : null;
}

export function generatorParametersEqual(left: GeneratorParameters, right: GeneratorParameters) {
  return JSON.stringify(left) === JSON.stringify(right);
}
