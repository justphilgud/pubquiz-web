import type { MediaSlotKey } from "../types";

export const PIXEL_STAGE_PRESET = "three_stage_default_v1" as const;
export const MAX_PIXEL_OUTPUT_EDGE = 1_600;
export const PIXEL_STAGE_CONFIG = [
  { slotKey: "pixel_stage_3_image", targetLongEdge: 24, stage: 3, points: 3 },
  { slotKey: "pixel_stage_2_image", targetLongEdge: 48, stage: 2, points: 2 },
  { slotKey: "pixel_stage_1_image", targetLongEdge: 96, stage: 1, points: 1 },
] as const satisfies readonly {
  slotKey: MediaSlotKey;
  targetLongEdge: number;
  stage: number;
  points: number;
}[];

export const PIXEL_FINGERPRINT_CONFIGURATION = {
  stagePreset: PIXEL_STAGE_PRESET,
  stageLongEdges: "24,48,96",
  maxOutputEdge: MAX_PIXEL_OUTPUT_EDGE,
  resizeKernel: "nearest",
  formatStrategy: "preserve-jpeg-png-webp",
} as const;
