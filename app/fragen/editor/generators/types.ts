import type { GeneratorId, GeneratorRunStatus, MediaSlotKey } from "../types";

export type GeneratorErrorCode =
  | "GENERATOR_INPUT_MISSING"
  | "GENERATOR_INPUT_INVALID"
  | "GENERATOR_UNSUPPORTED_FORMAT"
  | "GENERATOR_PROCESSING_FAILED"
  | "GENERATOR_OUTPUT_UPLOAD_FAILED"
  | "GENERATOR_OUTPUT_PERSIST_FAILED"
  | "GENERATOR_STALE_INPUT"
  | "GENERATOR_ALREADY_RUNNING"
  | "GENERATOR_NOT_AVAILABLE"
  | "GENERATOR_OUTPUT_MISSING"
  | "GENERATOR_CONFIGURATION_INVALID"
  | "GENERATOR_NOT_AUTHORIZED"
  | "GENERATOR_PARAMETERS_INVALID"
  | "GENERATOR_OUTPUT_FORMAT_INVALID";

export type GeneratorExecutionMode = "SYNCHRONOUS" | "ASYNCHRONOUS";

export type GeneratorDefinition = {
  id: GeneratorId;
  version: number;
  active: boolean;
  labelKey: "audioReverse" | "audioBitcrush" | "imagePixelate" | "reserved";
  descriptionKey: "audioReverse" | "audioBitcrush" | "imagePixelate" | "reserved";
  parameterKind: "NONE";
  inputSlots: readonly MediaSlotKey[];
  outputSlots: readonly MediaSlotKey[];
  supportedTemplates: readonly string[];
  executionMode: GeneratorExecutionMode;
};

export type GeneratorActionResult =
  | { ok: true; reused: boolean; messageCode: "generatorSucceeded" | "generatorReused" }
  | { ok: false; code: GeneratorErrorCode; messageCode: GeneratorErrorCode };

export type GeneratorRunTransition = {
  from: GeneratorRunStatus;
  to: GeneratorRunStatus;
};
