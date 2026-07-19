import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { performance } from "node:perf_hooks";
import { PROTOTYPE_VERSION } from "./config";
import { cleanTranscription, createArrangement, selectAnalysisWaveform } from "./analysis";
import { decodeLocalAudio, validatePaths, withTemporaryDirectory, writePrototypeOutput } from "./io";
import { synthesizeArrangement } from "./synth";
import { getTranscriber } from "./transcribers/registry";
import type { CleanedTranscription, PrototypeReport, PrototypeVariant, TranscriberId } from "./types";
import { encodePcm16Wav } from "./wav";

export type RunPrototypeOptions = {
  input: string;
  output: string;
  variant: PrototypeVariant;
  transcriber?: TranscriberId;
  debugDirectory?: string;
};

function elapsed(start: number) {
  return Math.round((performance.now() - start) * 10) / 10;
}

async function writeDebugData(directory: string, data: {
  normalizedWav: Buffer;
  rawAnalysis: CleanedTranscription;
  arrangement: ReturnType<typeof createArrangement>;
  finalWav: Buffer;
  report: PrototypeReport;
}) {
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, "normalized-input.wav"), data.normalizedWav),
    writeFile(join(directory, "raw-transcription.json"), JSON.stringify({ rawMelody: data.rawAnalysis.rawMelody, rawBass: data.rawAnalysis.rawBass }, null, 2)),
    writeFile(join(directory, "cleaned-notes.json"), JSON.stringify({ melody: data.rawAnalysis.melody, bass: data.rawAnalysis.bass }, null, 2)),
    writeFile(join(directory, "arrangement.json"), JSON.stringify(data.arrangement, null, 2)),
    writeFile(join(directory, "final-synthesized.wav"), data.finalWav),
    writeFile(join(directory, "report.json"), JSON.stringify(data.report, null, 2)),
  ]);
}

export async function runPrototype(options: RunPrototypeOptions) {
  const paths = await validatePaths(options.input, options.output);
  let peakRssBytes = process.memoryUsage().rss;
  const memorySampler = setInterval(() => {
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
  }, 25);
  memorySampler.unref();
  try {
    return await withTemporaryDirectory(async (temporaryDirectory) => {
      const transcriber = getTranscriber(options.transcriber ?? "fft");
      const timingsMs: Record<string, number> = {};
      let started = performance.now();
      const { audio, normalizedWav } = await decodeLocalAudio(paths.input, temporaryDirectory);
      timingsMs.normalize = elapsed(started);

      started = performance.now();
      const selected = selectAnalysisWaveform(audio, options.variant);
      const transcriptionInputPath = join(temporaryDirectory, "transcription-input.wav");
      await writeFile(transcriptionInputPath, encodePcm16Wav(selected.samples, audio.sampleRate));
      const rawAnalysis = await transcriber.transcribe({
        audioPath: transcriptionInputPath,
        samples: selected.samples,
        sampleRate: audio.sampleRate,
        temporaryDirectory,
      });
      timingsMs.transcription = elapsed(started);

      started = performance.now();
      const analysis = cleanTranscription(rawAnalysis);
      timingsMs.cleanup = elapsed(started);

      started = performance.now();
      const arrangement = createArrangement(analysis, audio.durationSeconds);
      timingsMs.arrangement = elapsed(started);

      started = performance.now();
      const synthesized = synthesizeArrangement(arrangement);
      timingsMs.synthesis = elapsed(started);

      started = performance.now();
      await writePrototypeOutput(synthesized.wav, paths.output, temporaryDirectory);
      timingsMs.output = elapsed(started);
      const warnings = [...selected.warnings, ...analysis.warnings];
      if (analysis.melody.length === 0) warnings.push("NO_RELIABLE_MELODY_DETECTED");
      if (analysis.bass.length === 0) warnings.push("NO_RELIABLE_BASS_DETECTED");
      const nodePeakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
      const transcriberPeakRssBytes = analysis.peakRssBytes ?? 0;
      const report: PrototypeReport = {
        prototypeVersion: PROTOTYPE_VERSION,
        variant: options.variant,
        transcriber: transcriber.id,
        inputDurationSeconds: Math.round(audio.durationSeconds * 100) / 100,
        outputDurationSeconds: Math.round(arrangement.durationSeconds * 100) / 100,
        tempoBpm: arrangement.tempoBpm,
        rawMelodyNotes: analysis.rawMelody.length,
        totalDetectedNotes: analysis.totalDetectedNotes,
        midiEventCount: analysis.midiEventCount,
        cleanedMelodyNotes: analysis.melody.length,
        bassNotes: analysis.bass.length,
        discardedNotes: Math.max(0, analysis.rawMelody.length - analysis.melody.length),
        warnings,
        timingsMs,
        nodePeakRssBytes,
        transcriberPeakRssBytes,
        peakRssBytes: nodePeakRssBytes + transcriberPeakRssBytes,
      };
      if (options.debugDirectory) {
        await writeDebugData(options.debugDirectory, { normalizedWav, rawAnalysis: analysis, arrangement, finalWav: synthesized.wav, report });
      }
      return { report, inputDisplayName: paths.inputDisplayName, outputDisplayName: basename(paths.output) };
    });
  } finally {
    clearInterval(memorySampler);
  }
}
