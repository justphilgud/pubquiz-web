import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StemName } from "../types";

export const STEM_NAMES: readonly StemName[] = ["vocals", "bass", "drums", "other"];

export type StemCacheConfiguration = {
  separatorVersion: string;
  model: string;
  parameters: Record<string, string | number | boolean>;
};

export type StemCacheManifest = {
  schemaVersion: 1;
  cacheKey: string;
  inputFingerprint: string;
  configuration: StemCacheConfiguration;
  metadata: {
    demucsVersion: string;
    pythonVersion: string;
    separationDurationMs: number;
    peakRssBytes: number;
    warnings: string[];
  };
};

export async function fingerprintFile(path: string) {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return hash.digest("hex");
}

export function createStemCacheKey(inputFingerprint: string, configuration: StemCacheConfiguration) {
  return createHash("sha256")
    .update(JSON.stringify({ inputFingerprint, configuration }))
    .digest("hex");
}

export function stemPaths(directory: string): Record<StemName, string> {
  return {
    vocals: join(directory, "vocals.wav"),
    bass: join(directory, "bass.wav"),
    drums: join(directory, "drums.wav"),
    other: join(directory, "other.wav"),
  };
}

export async function readStemCache(directory: string, expectedKey: string, configuration: StemCacheConfiguration) {
  try {
    const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")) as StemCacheManifest;
    if (manifest.schemaVersion !== 1 || manifest.cacheKey !== expectedKey || JSON.stringify(manifest.configuration) !== JSON.stringify(configuration)) return null;
    const stems = stemPaths(directory);
    await Promise.all(STEM_NAMES.map(async (name) => {
      await access(stems[name]);
      if ((await stat(stems[name])).size <= 44) throw new Error("empty stem");
    }));
    return { manifest, stems };
  } catch {
    return null;
  }
}

export async function writeStemCacheManifest(directory: string, manifest: StemCacheManifest) {
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2), { encoding: "utf8", flag: "wx" });
}
