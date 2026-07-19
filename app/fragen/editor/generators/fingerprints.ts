import { createHash } from "node:crypto";
import type { GeneratorId } from "../types";

export type GeneratorInputIdentity = {
  mediaId: number;
  slotKey: string;
  pathname: string;
  size: number;
  contentType: string;
  etag: string;
};

export function createGeneratorFingerprint(input: {
  generatorId: GeneratorId;
  generatorVersion: number;
  media: readonly GeneratorInputIdentity[];
  parameters?: Readonly<Record<string, string | number | boolean | null | undefined>>;
}) {
  const canonical = JSON.stringify({
    generatorId: input.generatorId,
    generatorVersion: input.generatorVersion,
    media: [...input.media]
      .sort((left, right) => left.slotKey.localeCompare(right.slotKey))
      .map(({ mediaId, slotKey, pathname, size, contentType, etag }) => ({
        mediaId,
        slotKey,
        pathname,
        size,
        contentType,
        etag,
      })),
    parameters: Object.fromEntries(
      Object.entries(input.parameters ?? {}).sort(([left], [right]) => left.localeCompare(right)),
    ),
  });
  return createHash("sha256").update(canonical).digest("hex");
}
