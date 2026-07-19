import { basename, dirname, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { stat, writeFile } from "node:fs/promises";
import { PROTOTYPE_VERSION, STEM_CONFIG } from "./config";
import { PrototypeInputError, validatePaths, withTemporaryDirectory } from "./io";
import { runPrototype } from "./pipeline";
import { getSeparator } from "./separators/registry";
import { resolveStemInput } from "./separators/stems";
import type { StemSeparationResult } from "./separators/types";
import type { PrototypeVariant, SeparatorId, StemSelection, TranscriberId } from "./types";

export type CliOptions = {
  input: string;
  output: string;
  variant: PrototypeVariant | "both";
  transcriber: TranscriberId;
  separator: SeparatorId;
  stem: StemSelection;
  compare: boolean;
  compareStems: boolean;
  debug: boolean;
};

const STEM_SELECTIONS: readonly StemSelection[] = ["full", "vocals", "other", "vocals-other", "bass"];

function usage() {
  return [
    "Lokaler PubQuiz Chiptune-Machbarkeitsprototyp",
    "",
    "node --import tsx tools/chiptune-prototype/src/cli.ts --input <lokale-datei> --output <datei.wav|datei.mp3> [--transcriber fft|basic-pitch] [--compare] [--variant direct|center-reduced|both] [--separator none|demucs] [--stem full|vocals|other|vocals-other|bass] [--compare-stems] [--debug]",
    "",
    "Demucs wird nur mit --separator demucs gestartet. Streaming-URLs werden nicht akzeptiert.",
  ].join("\n");
}

export function parseCliArguments(args: readonly string[]): CliOptions {
  const values = new Map<string, string>();
  let debug = false;
  let compare = false;
  let compareStems = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--debug" || argument === "--compare" || argument === "--compare-stems") {
      if (argument === "--debug") debug = true;
      if (argument === "--compare") compare = true;
      if (argument === "--compare-stems") compareStems = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") throw new PrototypeInputError("HELP", usage());
    if (!["--input", "--output", "--variant", "--transcriber", "--separator", "--stem"].includes(argument)) {
      throw new PrototypeInputError("ARGUMENT_UNKNOWN", `Unbekanntes Argument: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new PrototypeInputError("ARGUMENT_MISSING", `Wert für ${argument} fehlt.`);
    values.set(argument, value);
    index += 1;
  }
  const input = values.get("--input");
  const output = values.get("--output");
  const variant = values.get("--variant") ?? "direct";
  const transcriber = values.get("--transcriber") ?? "fft";
  const separator = values.get("--separator") ?? "none";
  const stem = values.get("--stem") ?? "full";
  if (!input || !output) throw new PrototypeInputError("ARGUMENT_MISSING", "--input und --output sind erforderlich.");
  if (variant !== "direct" && variant !== "center-reduced" && variant !== "both") throw new PrototypeInputError("VARIANT_INVALID", "--variant muss direct, center-reduced oder both sein.");
  if (transcriber !== "fft" && transcriber !== "basic-pitch") throw new PrototypeInputError("TRANSCRIBER_INVALID", "--transcriber muss fft oder basic-pitch sein.");
  if (separator !== "none" && separator !== "demucs") throw new PrototypeInputError("SEPARATOR_INVALID", "--separator muss none oder demucs sein.");
  if (!STEM_SELECTIONS.includes(stem as StemSelection)) throw new PrototypeInputError("STEM_INVALID", "--stem muss full, vocals, other, vocals-other oder bass sein.");
  if (separator === "none" && stem !== "full") throw new PrototypeInputError("STEM_SEPARATOR_REQUIRED", "Eine einzelne Stem-Auswahl erfordert --separator demucs.");
  if (compareStems && separator !== "demucs") throw new PrototypeInputError("STEM_COMPARE_SEPARATOR_REQUIRED", "--compare-stems erfordert --separator demucs.");
  if (compareStems && transcriber !== "basic-pitch") throw new PrototypeInputError("STEM_COMPARE_TRANSCRIBER_REQUIRED", "--compare-stems erfordert --transcriber basic-pitch.");
  if (compareStems && (compare || variant === "both")) throw new PrototypeInputError("COMPARE_MODE_CONFLICT", "--compare-stems kann nicht mit --compare oder --variant both kombiniert werden.");
  return { input, output, variant, transcriber, separator, stem: stem as StemSelection, compare, compareStems, debug };
}

function runOutput(output: string, variant: PrototypeVariant, transcriber: TranscriberId, includeVariant: boolean, includeTranscriber: boolean) {
  if (!includeVariant && !includeTranscriber) return output;
  const extension = extname(output);
  const stem = basename(output, extension);
  const suffixes = [includeVariant ? variant : null, includeTranscriber ? transcriber : null].filter(Boolean);
  return join(dirname(output), `${stem}.${suffixes.join(".")}${extension}`);
}

function stemOutput(output: string, selection: StemSelection) {
  const extension = extname(output);
  return join(dirname(output), `${basename(output, extension)}.${selection}.basic-pitch${extension}`);
}

function summarizeRun(result: Awaited<ReturnType<typeof runPrototype>>, output: string, variant: PrototypeVariant, transcriber: TranscriberId) {
  const totalMs = Object.values(result.report.timingsMs).reduce((sum, value) => sum + value, 0);
  return stat(output).then((outputStats) => ({
    input: result.inputDisplayName,
    output: result.outputDisplayName,
    variant,
    transcriber,
    runtimeMs: Math.round(totalMs),
    peakRamMiB: Math.round(result.report.peakRssBytes / 1024 / 1024),
    nodeRamMiB: Math.round(result.report.nodePeakRssBytes / 1024 / 1024),
    transcriberRamMiB: Math.round(result.report.transcriberPeakRssBytes / 1024 / 1024),
    totalDetectedNotes: result.report.totalDetectedNotes,
    midiEventCount: result.report.midiEventCount,
    melodyNotes: result.report.cleanedMelodyNotes,
    bassNotes: result.report.bassNotes,
    tempoBpm: result.report.tempoBpm,
    outputBytes: outputStats.size,
    durationSeconds: result.report.outputDurationSeconds,
    warnings: result.report.warnings,
  }));
}

async function runStemComparison(options: CliOptions, separation: StemSeparationResult) {
  const results: Array<Record<string, unknown>> = [];
  await withTemporaryDirectory(async (temporaryDirectory) => {
    for (const selection of STEM_SELECTIONS) {
      const output = stemOutput(options.output, selection);
      try {
        const input = await resolveStemInput(selection, options.input, separation, temporaryDirectory);
        const run = await runPrototype({
          input, output, variant: options.variant as PrototypeVariant, transcriber: "basic-pitch",
          debugDirectory: options.debug ? `${output}.debug` : undefined,
        });
        const summary = await summarizeRun(run, output, options.variant as PrototypeVariant, "basic-pitch");
        const arrangementAndSynthesisMs = ["cleanup", "arrangement", "synthesis", "output"]
          .reduce((sum, phase) => sum + (run.report.timingsMs[phase] ?? 0), 0);
        results.push({
          stem: selection,
          ...summary,
          demucsModel: separation.model,
          demucsVersion: separation.demucsVersion,
          pythonVersion: separation.pythonVersion,
          separationMs: separation.separationDurationMs,
          separationInvocationMs: separation.invocationDurationMs,
          separationCacheHit: separation.cacheHit,
          basicPitchMs: run.report.timingsMs.transcription ?? 0,
          arrangementAndSynthesisMs: Math.round(arrangementAndSynthesisMs),
          totalRuntimeMs: Math.round(separation.invocationDurationMs + Number(summary.runtimeMs)),
          separatorPeakRamMiB: Math.round(separation.peakRssBytes / 1024 / 1024),
          pythonPeakRamMiB: Math.round(Math.max(separation.peakRssBytes, run.report.transcriberPeakRssBytes) / 1024 / 1024),
          inputDurationSeconds: run.report.inputDurationSeconds,
          warnings: [...separation.warnings, ...run.report.warnings],
          error: null,
        });
      } catch (error) {
        const controlled = error instanceof PrototypeInputError ? error : null;
        results.push({
          stem: selection,
          transcriber: "basic-pitch",
          demucsModel: separation.model,
          demucsVersion: separation.demucsVersion,
          pythonVersion: separation.pythonVersion,
          separationMs: separation.separationDurationMs,
          separationCacheHit: separation.cacheHit,
          warnings: separation.warnings,
          error: { code: controlled?.code ?? "STEM_VARIANT_FAILED", message: controlled?.message ?? "Die Stem-Variante konnte nicht verarbeitet werden." },
        });
      }
    }
  });
  const reportPath = join(dirname(options.output), `${basename(options.output, extname(options.output))}.stem-comparison.json`);
  await writeFile(reportPath, JSON.stringify({
    prototypeVersion: PROTOTYPE_VERSION,
    separator: "demucs",
    demucsModel: separation.model,
    demucsVersion: separation.demucsVersion,
    pythonVersion: separation.pythonVersion,
    cacheKey: separation.cacheKey,
    cacheHit: separation.cacheHit,
    mix: { vocals: STEM_CONFIG.vocalsMixGain, other: STEM_CONFIG.otherMixGain },
    results,
  }, null, 2));
  console.log(JSON.stringify({ ok: true, comparison: basename(reportPath), variants: results.length }));
}

async function main() {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const validated = await validatePaths(options.input, options.output);
    const separation = options.separator === "demucs" ? await getSeparator("demucs").separate(validated.input) : null;
    if (options.compareStems) {
      await runStemComparison({ ...options, input: validated.input }, separation!);
      return;
    }
    const variants: PrototypeVariant[] = options.variant === "both" ? ["direct", "center-reduced"] : [options.variant];
    const transcribers: TranscriberId[] = options.compare ? ["fft", "basic-pitch"] : [options.transcriber];
    const comparison: Array<Record<string, unknown>> = [];
    await withTemporaryDirectory(async (temporaryDirectory) => {
      const selectedInput = await resolveStemInput(options.stem, validated.input, separation, temporaryDirectory);
      for (const variant of variants) {
        for (const transcriber of transcribers) {
          const output = runOutput(validated.output, variant, transcriber, variants.length > 1, options.compare);
          const result = await runPrototype({ input: selectedInput, output, variant, transcriber, debugDirectory: options.debug ? `${output}.debug` : undefined });
          const summary = await summarizeRun(result, output, variant, transcriber);
          comparison.push({ ...summary, separator: options.separator, stem: options.stem, separationCacheHit: separation?.cacheHit ?? false });
          console.log(JSON.stringify({ ok: true, ...summary, separator: options.separator, stem: options.stem }));
        }
      }
    });
    if (options.compare) {
      const comparisonPath = join(dirname(validated.output), "comparison.json");
      await writeFile(comparisonPath, JSON.stringify({ prototypeVersion: PROTOTYPE_VERSION, results: comparison }, null, 2));
      console.log(JSON.stringify({ ok: true, comparison: basename(comparisonPath) }));
    }
  } catch (error) {
    if (error instanceof PrototypeInputError) {
      if (error.code === "HELP") {
        console.log(error.message);
        return;
      }
      console.error(JSON.stringify({ ok: false, code: error.code, message: error.message }));
      process.exitCode = 1;
      return;
    }
    console.error(JSON.stringify({ ok: false, code: "PROTOTYPE_FAILED", message: "Der lokale Prototyplauf ist fehlgeschlagen." }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
