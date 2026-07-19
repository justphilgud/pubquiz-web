import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { GeneratorProcessorError } from "./errors";

const PROCESS_TIMEOUT_MS = 60_000;

export function isFfmpegAvailable() {
  return typeof ffmpegPath === "string" && ffmpegPath.length > 0;
}

export function runFfmpeg(args: readonly string[]) {
  if (!isFfmpegAvailable()) {
    throw new GeneratorProcessorError("GENERATOR_NOT_AVAILABLE", "FFmpeg-Binary ist in dieser Runtime nicht verfügbar.");
  }
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath!, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let diagnostic = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (diagnostic.length < 4_000) diagnostic += chunk;
    });
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new GeneratorProcessorError("GENERATOR_PROCESSING_FAILED", "FFmpeg-Zeitlimit überschritten."));
    }, PROCESS_TIMEOUT_MS);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(new GeneratorProcessorError("GENERATOR_NOT_AVAILABLE", error.message));
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new GeneratorProcessorError("GENERATOR_PROCESSING_FAILED", diagnostic.trim() || `FFmpeg exit ${code}`));
    });
  });
}
