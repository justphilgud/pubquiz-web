import type { GeneratorErrorCode } from "../types";

export class GeneratorProcessorError extends Error {
  constructor(
    public readonly code: GeneratorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GeneratorProcessorError";
  }
}
