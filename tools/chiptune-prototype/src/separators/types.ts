import type { SeparatorId, StemName } from "../types";

export type StemSeparationResult = {
  separator: Exclude<SeparatorId, "none">;
  model: string;
  demucsVersion: string;
  pythonVersion: string;
  stems: Record<StemName, string>;
  separationDurationMs: number;
  invocationDurationMs: number;
  peakRssBytes: number;
  cacheKey: string;
  cacheHit: boolean;
  warnings: string[];
};

export interface AudioStemSeparator {
  readonly id: Exclude<SeparatorId, "none">;
  separate(inputPath: string): Promise<StemSeparationResult>;
}
