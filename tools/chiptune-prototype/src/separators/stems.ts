import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { STEM_CONFIG } from "../config";
import { PrototypeInputError } from "../io";
import type { PcmAudio, StemName, StemSelection } from "../types";
import { decodePcm16Wav, encodePcm16Wav } from "../wav";
import type { StemSeparationResult } from "./types";

function monoSamples(audio: PcmAudio) {
  if (audio.channels.length === 1) return audio.channels[0];
  const output = new Float32Array(audio.channels[0].length);
  for (let index = 0; index < output.length; index += 1) output[index] = (audio.channels[0][index] + audio.channels[1][index]) / 2;
  return output;
}

export function mixStemSamples(vocals: PcmAudio, other: PcmAudio) {
  if (vocals.sampleRate !== other.sampleRate) throw new PrototypeInputError("STEM_SAMPLE_RATE_MISMATCH", "Die Stem-Sampleraten stimmen nicht überein.");
  const vocalsSamples = monoSamples(vocals);
  const otherSamples = monoSamples(other);
  const length = Math.min(vocalsSamples.length, otherSamples.length);
  if (length === 0) throw new PrototypeInputError("STEM_EMPTY", "Ein benötigter Stem ist leer.");
  const output = new Float32Array(length);
  let peak = 0;
  for (let index = 0; index < length; index += 1) {
    output[index] = vocalsSamples[index] * STEM_CONFIG.vocalsMixGain + otherSamples[index] * STEM_CONFIG.otherMixGain;
    peak = Math.max(peak, Math.abs(output[index]));
  }
  if (peak < 1e-6) throw new PrototypeInputError("STEM_EMPTY", "Der kombinierte Stem enthält kein verwertbares Audiosignal.");
  const scale = peak > STEM_CONFIG.mixedStemPeak ? STEM_CONFIG.mixedStemPeak / peak : 1;
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Math.max(-STEM_CONFIG.mixedStemPeak, Math.min(STEM_CONFIG.mixedStemPeak, output[index] * scale));
  }
  return { samples: output, sampleRate: vocals.sampleRate };
}

export async function createVocalsOtherMix(stems: Record<StemName, string>, temporaryDirectory: string) {
  let vocals: PcmAudio;
  let other: PcmAudio;
  try {
    [vocals, other] = await Promise.all([
      readFile(stems.vocals).then(decodePcm16Wav),
      readFile(stems.other).then(decodePcm16Wav),
    ]);
  } catch {
    throw new PrototypeInputError("STEM_DECODE_FAILED", "Die benötigten Stems konnten nicht dekodiert werden.");
  }
  const mixed = mixStemSamples(vocals, other);
  const output = join(temporaryDirectory, "vocals-other.wav");
  await writeFile(output, encodePcm16Wav(mixed.samples, mixed.sampleRate));
  return output;
}

export async function resolveStemInput(selection: StemSelection, originalPath: string, separation: StemSeparationResult | null, temporaryDirectory: string) {
  if (selection === "full") return originalPath;
  if (!separation) throw new PrototypeInputError("STEM_SEPARATOR_REQUIRED", "Für diese Stem-Auswahl ist Demucs erforderlich.");
  if (selection === "vocals-other") return createVocalsOtherMix(separation.stems, temporaryDirectory);
  const path = separation.stems[selection];
  try {
    const audio = decodePcm16Wav(await readFile(path));
    if (!audio.channels.some((channel) => channel.some((sample) => Math.abs(sample) > 1e-5))) {
      throw new PrototypeInputError("STEM_EMPTY", "Der ausgewählte Stem enthält kein verwertbares Audiosignal.");
    }
  } catch (error) {
    if (error instanceof PrototypeInputError) throw error;
    throw new PrototypeInputError("STEM_DECODE_FAILED", "Der ausgewählte Stem konnte nicht dekodiert werden.");
  }
  return path;
}
