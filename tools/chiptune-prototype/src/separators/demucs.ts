import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { STEM_CONFIG } from "../config";
import { PrototypeInputError } from "../io";
import { createStemCacheKey, fingerprintFile, readStemCache, stemPaths, writeStemCacheManifest, type StemCacheConfiguration } from "./cache";
import type { AudioStemSeparator, StemSeparationResult } from "./types";

type DemucsPayload = {
  model?: unknown;
  demucsVersion?: unknown;
  pythonVersion?: unknown;
  separationDurationMs?: unknown;
  peakRssBytes?: unknown;
  stems?: unknown;
  warnings?: unknown;
};

const defaultPythonPath = fileURLToPath(new URL("../../python/demucs/.runtime/python.exe", import.meta.url));
const runnerPath = fileURLToPath(new URL("../../python/demucs/demucs_stem_separate.py", import.meta.url));
const defaultModelsPath = fileURLToPath(new URL("../../python/demucs/.models", import.meta.url));
const defaultCacheRoot = fileURLToPath(new URL("../../.cache/demucs", import.meta.url));
const configuration: StemCacheConfiguration = {
  separatorVersion: STEM_CONFIG.demucsVersion,
  model: STEM_CONFIG.model,
  parameters: { device: "cpu", shifts: 1, overlap: 0.25, split: true },
};

export function controlledDemucsError(code: number | null, timedOut: boolean) {
  if (timedOut) return new PrototypeInputError("DEMUCS_TIMEOUT", "Die Stem-Separation hat das lokale Zeitlimit überschritten.");
  if (code === 3) return new PrototypeInputError("DEMUCS_MODEL_MISSING", "Das lokale Demucs-Modell fehlt. Führe zuerst python/demucs/setup.ps1 aus.");
  if (code === 4) return new PrototypeInputError("DEMUCS_INPUT_INVALID", "Demucs hat die kontrollierten Ein- oder Ausgabepfade abgewiesen.");
  if (code === 5) return new PrototypeInputError("DEMUCS_OUT_OF_MEMORY", "Für die lokale Stem-Separation war nicht genügend Arbeitsspeicher verfügbar.");
  if (code === 6) return new PrototypeInputError("DEMUCS_STEMS_MISSING", "Demucs hat nicht alle erwarteten Stems erzeugt.");
  return new PrototypeInputError("DEMUCS_SEPARATION_FAILED", "Die lokale Stem-Separation ist fehlgeschlagen.");
}

export function buildDemucsArguments(inputPath: string, outputDirectory: string, modelsPath: string) {
  return [
    runnerPath,
    "--input", inputPath,
    "--output-dir", outputDirectory,
    "--report", join(outputDirectory, "demucs-report.json"),
    "--models-dir", modelsPath,
    "--model", STEM_CONFIG.model,
  ];
}

async function runDemucs(pythonPath: string, modelsPath: string, inputPath: string, outputDirectory: string, timeoutMs: number) {
  const reportPath = join(outputDirectory, "demucs-report.json");
  let timedOut = false;
  const code = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(pythonPath, buildDemucsArguments(inputPath, outputDirectory, modelsPath), {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "ignore", "ignore"],
      env: {
        NODE_ENV: process.env.NODE_ENV,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        PYTHONHASHSEED: "0",
        CUDA_VISIBLE_DEVICES: "-1",
        HF_HOME: modelsPath,
        HF_HUB_OFFLINE: "1",
        HF_HUB_DISABLE_TELEMETRY: "1",
      },
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    timer.unref();
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode);
    });
  }).catch(() => {
    throw new PrototypeInputError("DEMUCS_START_FAILED", "Die isolierte Demucs-Umgebung konnte nicht gestartet werden.");
  });
  if (code !== 0) throw controlledDemucsError(code, timedOut);
  let payload: DemucsPayload;
  try {
    payload = JSON.parse(await readFile(reportPath, "utf8")) as DemucsPayload;
  } catch {
    throw new PrototypeInputError("DEMUCS_OUTPUT_INVALID", "Demucs hat keinen gültigen technischen Bericht erzeugt.");
  }
  if (payload.model !== STEM_CONFIG.model || payload.demucsVersion !== STEM_CONFIG.demucsVersion || typeof payload.pythonVersion !== "string"
    || !Number.isFinite(payload.separationDurationMs) || !Number.isFinite(payload.peakRssBytes)
    || !Array.isArray(payload.stems) || !Array.isArray(payload.warnings)) {
    throw new PrototypeInputError("DEMUCS_OUTPUT_INVALID", "Demucs hat ungültige Metadaten erzeugt.");
  }
  return {
    demucsVersion: payload.demucsVersion,
    pythonVersion: payload.pythonVersion,
    separationDurationMs: Number(payload.separationDurationMs),
    peakRssBytes: Number(payload.peakRssBytes),
    warnings: payload.warnings.filter((warning): warning is string => typeof warning === "string"),
  };
}

export function createDemucsSeparator(options: { pythonPath?: string; modelsPath?: string; cacheRoot?: string; timeoutMs?: number } = {}): AudioStemSeparator {
  const pythonPath = options.pythonPath ?? process.env.CHIPTUNE_DEMUCS_PYTHON ?? defaultPythonPath;
  const modelsPath = options.modelsPath ?? process.env.CHIPTUNE_DEMUCS_MODELS ?? defaultModelsPath;
  const cacheRoot = options.cacheRoot ?? defaultCacheRoot;
  const timeoutMs = options.timeoutMs ?? STEM_CONFIG.separatorTimeoutMs;
  return {
    id: "demucs",
    async separate(inputPath): Promise<StemSeparationResult> {
      try {
        await Promise.all([access(pythonPath), access(modelsPath)]);
      } catch {
        throw new PrototypeInputError("DEMUCS_ENVIRONMENT_MISSING", "Die isolierte Demucs-Umgebung fehlt. Führe zuerst python/demucs/setup.ps1 aus.");
      }
      const invokedAt = performance.now();
      const inputFingerprint = await fingerprintFile(inputPath);
      const cacheKey = createStemCacheKey(inputFingerprint, configuration);
      const finalDirectory = join(cacheRoot, cacheKey);
      const cached = await readStemCache(finalDirectory, cacheKey, configuration);
      if (cached) {
        return {
          separator: "demucs", model: STEM_CONFIG.model, cacheKey, cacheHit: true,
          stems: cached.stems,
          demucsVersion: cached.manifest.metadata.demucsVersion,
          pythonVersion: cached.manifest.metadata.pythonVersion,
          separationDurationMs: cached.manifest.metadata.separationDurationMs,
          invocationDurationMs: Math.round(performance.now() - invokedAt),
          peakRssBytes: cached.manifest.metadata.peakRssBytes,
          warnings: cached.manifest.metadata.warnings,
        };
      }
      await mkdir(cacheRoot, { recursive: true });
      const stagingDirectory = await mkdtemp(join(cacheRoot, `${cacheKey}.tmp-`));
      try {
        const metadata = await runDemucs(pythonPath, modelsPath, inputPath, stagingDirectory, timeoutMs);
        const stems = stemPaths(stagingDirectory);
        await Promise.all(Object.values(stems).map(access));
        await writeStemCacheManifest(stagingDirectory, {
          schemaVersion: 1, cacheKey, inputFingerprint, configuration, metadata,
        });
        try {
          await rename(stagingDirectory, finalDirectory);
        } catch {
          const concurrent = await readStemCache(finalDirectory, cacheKey, configuration);
          if (!concurrent) throw new PrototypeInputError("DEMUCS_CACHE_WRITE_FAILED", "Der lokale Stem-Cache konnte nicht geschrieben werden.");
          await rm(stagingDirectory, { recursive: true, force: true });
        }
        const persisted = await readStemCache(finalDirectory, cacheKey, configuration);
        if (!persisted) throw new PrototypeInputError("DEMUCS_CACHE_INVALID", "Der erzeugte Stem-Cache ist unvollständig.");
        return {
          separator: "demucs", model: STEM_CONFIG.model, cacheKey, cacheHit: false,
          stems: persisted.stems,
          demucsVersion: metadata.demucsVersion,
          pythonVersion: metadata.pythonVersion,
          separationDurationMs: metadata.separationDurationMs,
          invocationDurationMs: Math.round(performance.now() - invokedAt),
          peakRssBytes: metadata.peakRssBytes,
          warnings: metadata.warnings,
        };
      } catch (error) {
        await rm(stagingDirectory, { recursive: true, force: true });
        throw error;
      }
    },
  };
}
