import type { PcmAudio } from "./types";

function findChunk(buffer: Buffer, id: string) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (chunkId === id) return { offset: offset + 8, size };
    offset += 8 + size + (size % 2);
  }
  return null;
}

export function decodePcm16Wav(buffer: Buffer): PcmAudio {
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("WAV_INVALID");
  }
  const format = findChunk(buffer, "fmt ");
  const data = findChunk(buffer, "data");
  if (!format || !data || format.size < 16 || data.offset + data.size > buffer.length) throw new Error("WAV_INVALID");
  const audioFormat = buffer.readUInt16LE(format.offset);
  const channelCount = buffer.readUInt16LE(format.offset + 2);
  const sampleRate = buffer.readUInt32LE(format.offset + 4);
  const bitsPerSample = buffer.readUInt16LE(format.offset + 14);
  if (audioFormat !== 1 || bitsPerSample !== 16 || channelCount < 1 || channelCount > 2 || sampleRate < 8_000 || sampleRate > 192_000) {
    throw new Error("WAV_FORMAT_UNSUPPORTED");
  }
  const frameCount = Math.floor(data.size / (channelCount * 2));
  if (frameCount === 0) throw new Error("WAV_EMPTY");
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frameCount));
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sampleOffset = data.offset + (frame * channelCount + channel) * 2;
      channels[channel][frame] = buffer.readInt16LE(sampleOffset) / 32_768;
    }
  }
  return { sampleRate, channels, durationSeconds: frameCount / sampleRate };
}

export function encodePcm16Wav(samples: Float32Array, sampleRate: number): Buffer {
  const dataSize = samples.length * 2;
  const output = Buffer.allocUnsafe(44 + dataSize);
  output.write("RIFF", 0, "ascii");
  output.writeUInt32LE(36 + dataSize, 4);
  output.write("WAVEfmt ", 8, "ascii");
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36, "ascii");
  output.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    output.writeInt16LE(Math.round(sample < 0 ? sample * 32_768 : sample * 32_767), 44 + index * 2);
  }
  return output;
}
