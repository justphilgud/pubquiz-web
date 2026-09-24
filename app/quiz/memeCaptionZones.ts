export const MEME_CAPTION_LAYOUT_VERSION = 1 as const;
export const MEME_CAPTION_ZONE_MIN_COUNT = 1;
export const MEME_CAPTION_ZONE_MAX_COUNT = 4;
export const MEME_CAPTION_ZONE_MIN_SIZE_PERCENT = 8;

export type MemeCaptionZonePlacement =
  | "EXTERNAL_TOP"
  | "EXTERNAL_BOTTOM"
  | "IMAGE";

export type MemeCaptionZone = {
  id: string;
  label: string;
  placement: MemeCaptionZonePlacement;
  x: number;
  y: number;
  width: number;
  height: number;
  order: number;
  maxLines: 1 | 2 | 3;
  required: boolean;
};

export type MemeCaptionLayoutConfig =
  | { version: 1; mode: "STANDARD" }
  | { version: 1; mode: "CUSTOM"; zones: MemeCaptionZone[] };

export type ResolvedMemeCaptionLayout = {
  version: 1;
  mode: "STANDARD" | "CUSTOM";
  zones: MemeCaptionZone[];
};

export const STANDARD_MEME_CAPTION_ZONES: readonly MemeCaptionZone[] = [
  {
    id: "top",
    label: "Text oben",
    placement: "EXTERNAL_TOP",
    x: 0,
    y: 0,
    width: 100,
    height: 21,
    order: 1,
    maxLines: 2,
    required: false,
  },
  {
    id: "bottom",
    label: "Text unten",
    placement: "EXTERNAL_BOTTOM",
    x: 0,
    y: 79,
    width: 100,
    height: 21,
    order: 2,
    maxLines: 2,
    required: false,
  },
];

export const DEFAULT_MEME_CAPTION_LAYOUT: MemeCaptionLayoutConfig = {
  version: MEME_CAPTION_LAYOUT_VERSION,
  mode: "STANDARD",
};

export type MemeCaptionZonePreset = {
  id: string;
  label: string;
  placement: MemeCaptionZonePlacement;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const MEME_CAPTION_ZONE_PRESETS: readonly MemeCaptionZonePreset[] = [
  { id: "external-top", label: "Oben außerhalb", placement: "EXTERNAL_TOP", x: 0, y: 0, width: 100, height: 21 },
  { id: "external-bottom", label: "Unten außerhalb", placement: "EXTERNAL_BOTTOM", x: 0, y: 79, width: 100, height: 21 },
  { id: "image-top", label: "Oben im Bild", placement: "IMAGE", x: 8, y: 5, width: 84, height: 24 },
  { id: "image-bottom", label: "Unten im Bild", placement: "IMAGE", x: 8, y: 71, width: 84, height: 24 },
  { id: "image-top-left", label: "Oben links", placement: "IMAGE", x: 5, y: 5, width: 43, height: 34 },
  { id: "image-top-right", label: "Oben rechts", placement: "IMAGE", x: 52, y: 5, width: 43, height: 34 },
  { id: "image-bottom-left", label: "Unten links", placement: "IMAGE", x: 5, y: 61, width: 43, height: 34 },
  { id: "image-bottom-right", label: "Unten rechts", placement: "IMAGE", x: 52, y: 61, width: 43, height: 34 },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseZone(value: unknown): MemeCaptionZone | null {
  if (!isRecord(value)) return null;
  const placement = value.placement;
  const maxLines = value.maxLines;
  if (
    typeof value.id !== "string" ||
    !/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(value.id) ||
    typeof value.label !== "string" ||
    value.label.trim().length > 80 ||
    !["EXTERNAL_TOP", "EXTERNAL_BOTTOM", "IMAGE"].includes(String(placement)) ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.width) ||
    !isFiniteNumber(value.height) ||
    !Number.isSafeInteger(value.order) ||
    ![1, 2, 3].includes(Number(maxLines)) ||
    typeof value.required !== "boolean"
  ) {
    return null;
  }
  const zone = {
    id: value.id,
    label: value.label.trim() || `Text ${Number(value.order)}`,
    placement: placement as MemeCaptionZonePlacement,
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    order: Number(value.order),
    maxLines: Number(maxLines) as 1 | 2 | 3,
    required: value.required,
  };
  if (
    zone.order < 1 ||
    zone.x < 0 ||
    zone.y < 0 ||
    zone.width < MEME_CAPTION_ZONE_MIN_SIZE_PERCENT ||
    zone.height < MEME_CAPTION_ZONE_MIN_SIZE_PERCENT ||
    zone.x + zone.width > 100 ||
    zone.y + zone.height > 100
  ) {
    return null;
  }
  if (zone.placement === "EXTERNAL_TOP" && (zone.x !== 0 || zone.y !== 0 || zone.width !== 100 || zone.height !== 21)) return null;
  if (zone.placement === "EXTERNAL_BOTTOM" && (zone.x !== 0 || zone.y !== 79 || zone.width !== 100 || zone.height !== 21)) return null;
  return zone;
}

export function parseMemeCaptionLayoutConfig(
  value: unknown,
): MemeCaptionLayoutConfig | null {
  if (value === undefined || value === null) return DEFAULT_MEME_CAPTION_LAYOUT;
  if (!isRecord(value) || value.version !== 1) return null;
  if (value.mode === "STANDARD") return DEFAULT_MEME_CAPTION_LAYOUT;
  if (value.mode !== "CUSTOM" || !Array.isArray(value.zones)) return null;
  if (
    value.zones.length < MEME_CAPTION_ZONE_MIN_COUNT ||
    value.zones.length > MEME_CAPTION_ZONE_MAX_COUNT
  ) return null;
  const zones = value.zones.map(parseZone);
  if (zones.some((zone) => zone === null)) return null;
  const parsed = zones as MemeCaptionZone[];
  if (
    new Set(parsed.map((zone) => zone.id)).size !== parsed.length ||
    new Set(parsed.map((zone) => zone.order)).size !== parsed.length ||
    parsed.filter((zone) => zone.placement === "EXTERNAL_TOP").length > 1 ||
    parsed.filter((zone) => zone.placement === "EXTERNAL_BOTTOM").length > 1
  ) return null;
  return {
    version: 1,
    mode: "CUSTOM",
    zones: [...parsed].sort((left, right) => left.order - right.order),
  };
}

export function resolveMemeCaptionLayout(
  value: unknown,
): ResolvedMemeCaptionLayout {
  const parsed = parseMemeCaptionLayoutConfig(value);
  if (!parsed || parsed.mode === "STANDARD") {
    return { version: 1, mode: "STANDARD", zones: STANDARD_MEME_CAPTION_ZONES.map((zone) => ({ ...zone })) };
  }
  return { ...parsed, zones: parsed.zones.map((zone) => ({ ...zone })) };
}

export function createMemeCaptionZone(
  index: number,
  preset: MemeCaptionZonePreset = MEME_CAPTION_ZONE_PRESETS[2],
): MemeCaptionZone {
  return {
    id: `caption-${index}`,
    label: `Text ${index}`,
    placement: preset.placement,
    x: preset.x,
    y: preset.y,
    width: preset.width,
    height: preset.height,
    order: index,
    maxLines: 3,
    required: false,
  };
}

export function applyMemeCaptionZonePreset(
  zone: MemeCaptionZone,
  preset: MemeCaptionZonePreset,
): MemeCaptionZone {
  return {
    ...zone,
    placement: preset.placement,
    x: preset.x,
    y: preset.y,
    width: preset.width,
    height: preset.height,
  };
}

export function getStrongMemeCaptionZoneOverlaps(
  zones: readonly MemeCaptionZone[],
) {
  const imageZones = zones.filter((zone) => zone.placement === "IMAGE");
  const overlaps: Array<{ firstId: string; secondId: string; ratio: number }> = [];
  for (let firstIndex = 0; firstIndex < imageZones.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < imageZones.length; secondIndex += 1) {
      const first = imageZones[firstIndex];
      const second = imageZones[secondIndex];
      const width = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
      const height = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
      const overlapArea = width * height;
      const ratio = overlapArea / Math.min(first.width * first.height, second.width * second.height);
      if (ratio >= 0.4) overlaps.push({ firstId: first.id, secondId: second.id, ratio });
    }
  }
  return overlaps;
}

export function legacyMemeCaptions(topText: string, bottomText: string) {
  return { top: topText, bottom: bottomText };
}
