import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { estimateTempoFromSamples } from "../analysis";
import { PrototypeInputError } from "../io";
import type { NoteEvent } from "../types";
import type { MusicTranscriber } from "./types";

type BasicPitchPayload = {
  notes?: unknown;
  midiEventCount?: unknown;
  runtime?: unknown;
  peakRssBytes?: unknown;
};

const defaultPythonPath = fileURLToPath(new URL("../../python/.runtime/python.exe", import.meta.url));
const runnerPath = fileURLToPath(new URL("../../python/basic_pitch_transcribe.py", import.meta.url));

function parseNote(value: unknown): NoteEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const note = value as Record<string, unknown>;
  if (![note.startSeconds, note.endSeconds, note.midi, note.confidence].every((entry) => typeof entry === "number" && Number.isFinite(entry))) return null;
  const startSeconds = Number(note.startSeconds);
  const endSeconds = Number(note.endSeconds);
  const midi = Number(note.midi);
  const confidence = Number(note.confidence);
  if (startSeconds < 0 || endSeconds <= startSeconds || !Number.isInteger(midi) || midi < 0 || midi > 127 || confidence < 0 || confidence > 1) return null;
  return { startSeconds, endSeconds, midi, confidence };
}

async function runPython(pythonPath: string, inputPath: string, outputPath: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(pythonPath, [runnerPath, "--input", inputPath, "--output", outputPath], {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, PYTHONHASHSEED: "0", CUDA_VISIBLE_DEVICES: "-1" },
    });
    child.stderr.resume();
    child.once("error", () => reject(new PrototypeInputError("BASIC_PITCH_START_FAILED", "Die isolierte Basic-Pitch-Umgebung konnte nicht gestartet werden.")));
    child.once("close", (code: number | null) => code === 0
      ? resolve()
      : reject(new PrototypeInputError("BASIC_PITCH_TRANSCRIPTION_FAILED", "Basic Pitch konnte die lokale Audiodatei nicht transkribieren.")));
  });
}

export function createBasicPitchTranscriber(pythonPath = process.env.CHIPTUNE_BASIC_PITCH_PYTHON || defaultPythonPath): MusicTranscriber {
  return {
    id: "basic-pitch",
    async transcribe(input) {
      try {
        await access(pythonPath);
      } catch {
        throw new PrototypeInputError("BASIC_PITCH_ENVIRONMENT_MISSING", "Die isolierte Basic-Pitch-Umgebung fehlt. Führe zuerst python/setup.ps1 aus.");
      }
      const outputPath = join(input.temporaryDirectory, "basic-pitch-notes.json");
      await runPython(pythonPath, input.audioPath, outputPath);
      let payload: BasicPitchPayload;
      try {
        payload = JSON.parse(await readFile(outputPath, "utf8")) as BasicPitchPayload;
      } catch {
        throw new PrototypeInputError("BASIC_PITCH_OUTPUT_INVALID", "Basic Pitch hat keine gültigen Notendaten erzeugt.");
      }
      if (!Array.isArray(payload.notes)) throw new PrototypeInputError("BASIC_PITCH_OUTPUT_INVALID", "Basic Pitch hat keine gültigen Notendaten erzeugt.");
      const notes = payload.notes.map(parseNote);
      if (notes.some((note) => note === null)) throw new PrototypeInputError("BASIC_PITCH_OUTPUT_INVALID", "Basic Pitch hat ungültige Notenereignisse erzeugt.");
      const validNotes = notes as NoteEvent[];
      const ordered = [...validNotes].sort((left, right) => left.startSeconds - right.startSeconds || right.confidence - left.confidence || right.midi - left.midi);
      const rawMelody = ordered.filter((note) => note.midi >= 52 && note.midi <= 96);
      const rawBass = ordered.filter((note) => note.midi >= 28 && note.midi <= 60);
      const midiEventCount = Number.isInteger(payload.midiEventCount) && Number(payload.midiEventCount) >= 0
        ? Number(payload.midiEventCount)
        : validNotes.length;
      const peakRssBytes = Number.isInteger(payload.peakRssBytes) && Number(payload.peakRssBytes) > 0
        ? Number(payload.peakRssBytes)
        : undefined;
      return {
        tempoBpm: estimateTempoFromSamples(input.samples, input.sampleRate),
        rawMelody,
        rawBass,
        totalDetectedNotes: validNotes.length,
        midiEventCount,
        warnings: validNotes.length === 0 ? ["BASIC_PITCH_NO_NOTES"] : [],
        peakRssBytes,
      };
    },
  };
}
