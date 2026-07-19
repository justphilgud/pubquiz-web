import { NextResponse } from "next/server";
import { runQuestionGenerator } from "@/app/fragen/editor/generators/service";
import type { GeneratorId } from "@/app/fragen/editor/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let payload: { questionId?: unknown; generatorId?: unknown; parameters?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "GENERATOR_INPUT_INVALID", messageCode: "GENERATOR_INPUT_INVALID" }, { status: 400 });
  }
  if (!Number.isInteger(payload.questionId) || !["audio_reverse", "audio_bitcrush", "image_pixelate"].includes(String(payload.generatorId))) {
    return NextResponse.json({ ok: false, code: "GENERATOR_CONFIGURATION_INVALID", messageCode: "GENERATOR_CONFIGURATION_INVALID" }, { status: 400 });
  }
  const result = await runQuestionGenerator(payload.questionId as number, payload.generatorId as GeneratorId, payload.parameters);
  return NextResponse.json(result, { status: result.ok ? 200 : result.code === "GENERATOR_ALREADY_RUNNING" ? 409 : 422 });
}
