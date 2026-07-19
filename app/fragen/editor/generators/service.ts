import "server-only";

import { randomUUID } from "node:crypto";
import { head, put } from "@vercel/blob";
import { prisma } from "@/app/lib/prisma";
import { requireQuestionEditor } from "@/app/lib/permissions";
import { requireQuestionAccess } from "../questionAccess.server";
import { buildMediaUploadPathname, getBlobUploadAuthentication } from "../mediaUploadEnvironment";
import { createQuestionMediaDraftFromStoredMedia } from "../questionMedia";
import { resolveCanonicalQuestionTemplateId } from "../templates/questionTemplateRegistry";
import type { GeneratorId } from "../types";
import { getMediaSlotDefinition } from "../mediaSlots";
import { createGeneratorFingerprint } from "./fingerprints";
import { getGeneratorDefinition } from "./registry";
import { normalizeGeneratorParameters } from "./parameters";
import { mapGeneratorRun } from "./runState";
import type { GeneratorActionResult, GeneratorErrorCode } from "./types";
import { GeneratorProcessorError } from "./processors/errors";
import { getGeneratorProcessor, type GeneratorProcessorOutput } from "./processors/registry.server";
import { PIXEL_FINGERPRINT_CONFIGURATION } from "./pixelConfiguration";
import { validateGeneratorProcessorOutputs } from "./outputValidation";

type ResultState = {
  questionMedia: ReturnType<typeof createQuestionMediaDraftFromStoredMedia>;
  generatorRuns: NonNullable<ReturnType<typeof mapGeneratorRun>>[];
};
export type RunGeneratorResult = GeneratorActionResult & Partial<ResultState>;

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/(?:vercel_blob_rw_|bearer\s+)[A-Za-z0-9._~-]+/gi, "[credential]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 500);
}

async function loadState(questionId: number, templateId: string | null): Promise<ResultState> {
  const question = await prisma.fragen.findUniqueOrThrow({
    where: { fragen_id: questionId },
    select: {
      medien: {
        orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
        select: { medien_id: true, datei: true, slot_key: true, medientyp: { select: { medientyp: true } } },
      },
      generator_laefe: {
        orderBy: { created_at: "desc" },
        select: {
          generator_lauf_id: true, generator_id: true, generator_version: true,
          status: true, input_fingerprint: true, error_code: true,
          parameters_json: true,
          medien: { select: { medien_id: true, rolle: true } },
        },
      },
    },
  });
  return {
    questionMedia: createQuestionMediaDraftFromStoredMedia(question.medien, templateId),
    generatorRuns: question.generator_laefe.map(mapGeneratorRun).filter((run) => run !== null),
  };
}

function failure(code: GeneratorErrorCode): RunGeneratorResult {
  return { ok: false, code, messageCode: code };
}

export async function runQuestionGenerator(
  questionId: number,
  generatorId: GeneratorId,
  rawParameters?: unknown,
): Promise<RunGeneratorResult> {
  await requireQuestionEditor();
  try {
    await requireQuestionAccess(questionId, "EDIT");
  } catch {
    return failure("GENERATOR_NOT_AUTHORIZED");
  }
  const question = await prisma.fragen.findUnique({
    where: { fragen_id: questionId },
    select: {
      created_by_user_id: true,
      review_status: true,
      ist_archiviert: true,
      vorlage: { select: { code: true } },
      medien: {
        where: { fragen_id: questionId },
        select: { medien_id: true, datei: true, slot_key: true },
      },
    },
  });
  if (!question) return failure("GENERATOR_NOT_AUTHORIZED");

  const templateId = resolveCanonicalQuestionTemplateId(question.vorlage?.code ?? null) ?? "standard";
  const definition = getGeneratorDefinition(generatorId);
  if (!definition?.active || !definition.supportedTemplates.includes(templateId as never)) {
    return failure("GENERATOR_CONFIGURATION_INVALID");
  }
  const parameters = normalizeGeneratorParameters(generatorId, rawParameters);
  if (!parameters) return failure("GENERATOR_PARAMETERS_INVALID");
  const inputSlot = definition.inputSlots[0];
  const input = question.medien.find((medium) => medium.slot_key === inputSlot);
  if (!input || !input.datei.startsWith("https://")) return failure("GENERATOR_INPUT_MISSING");

  const authentication = getBlobUploadAuthentication();
  let metadata;
  try {
    metadata = await head(input.datei, authentication);
  } catch (error) {
    console.error("Generatorinput konnte nicht verifiziert werden", { generatorId, questionId, error: sanitizeError(error) });
    return failure("GENERATOR_INPUT_INVALID");
  }
  const inputDefinition = getMediaSlotDefinition(inputSlot);
  if (!inputDefinition.allowedMimeTypes.includes(metadata.contentType)) {
    return failure("GENERATOR_UNSUPPORTED_FORMAT");
  }
  if (metadata.size <= 0 || metadata.size > inputDefinition.maxFileSizeBytes) {
    return failure("GENERATOR_INPUT_INVALID");
  }
  const fingerprint = createGeneratorFingerprint({
    generatorId,
    generatorVersion: definition.version,
    media: [{
      mediaId: input.medien_id,
      slotKey: inputSlot,
      pathname: metadata.pathname,
      size: metadata.size,
      contentType: metadata.contentType,
      etag: metadata.etag,
    }],
    parameters: generatorId === "image_pixelate"
      ? { ...parameters, ...PIXEL_FINGERPRINT_CONFIGURATION }
      : parameters,
  });

  const reusable = await prisma.medien_generator_laefe.findFirst({
    where: { fragen_id: questionId, generator_id: generatorId, generator_version: definition.version, status: "SUCCEEDED", input_fingerprint: fingerprint },
    select: { medien: { where: { rolle: "OUTPUT" }, select: { slot_key: true, medium: { select: { medien_id: true, datei: true } } } } },
  });
  const reusableSlots = reusable?.medien.map((medium) => medium.slot_key).sort() ?? [];
  const expectedSlots = [...definition.outputSlots].sort();
  if (reusable && reusable.medien.length === expectedSlots.length &&
    reusable.medien.every(({ medium }) => Boolean(medium.datei)) &&
    reusableSlots.every((slot, index) => slot === expectedSlots[index])) {
    return { ok: true, reused: true, messageCode: "generatorReused", ...(await loadState(questionId, templateId)) };
  }
  const active = await prisma.medien_generator_laefe.findFirst({
    where: { fragen_id: questionId, generator_id: generatorId, status: { in: ["PENDING", "PROCESSING"] } },
    select: { generator_lauf_id: true },
  });
  if (active) return failure("GENERATOR_ALREADY_RUNNING");

  let runId: number;
  try {
    const run = await prisma.medien_generator_laefe.create({
      data: {
        fragen_id: questionId, generator_id: generatorId, generator_version: definition.version,
        status: "PENDING", input_fingerprint: fingerprint, parameters_json: parameters,
        medien: { create: { medien_id: input.medien_id, rolle: "INPUT", slot_key: inputSlot } },
      },
      select: { generator_lauf_id: true },
    });
    runId = run.generator_lauf_id;
    await prisma.medien_generator_laefe.update({
      where: { generator_lauf_id: runId }, data: { status: "PROCESSING", started_at: new Date() },
    });
  } catch (error) {
    console.error("Generatorlauf konnte nicht gestartet werden", { generatorId, questionId, error: sanitizeError(error) });
    return failure("GENERATOR_ALREADY_RUNNING");
  }

  let outputs: GeneratorProcessorOutput[];
  try {
    const response = await fetch(input.datei, { cache: "no-store" });
    if (!response.ok) throw new Error(`Input download ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const processor = getGeneratorProcessor(generatorId);
    if (!processor) throw new GeneratorProcessorError("GENERATOR_NOT_AVAILABLE", "Kein Prozessor registriert.");
    outputs = (await processor(bytes, { parameters, inputContentType: metadata.contentType })).outputs;
  } catch (error) {
    const code = error instanceof GeneratorProcessorError ? error.code : "GENERATOR_PROCESSING_FAILED";
    await prisma.medien_generator_laefe.update({
      where: { generator_lauf_id: runId },
      data: { status: "FAILED", error_code: code, error_message: sanitizeError(error), finished_at: new Date() },
    });
    console.error("Generatorverarbeitung fehlgeschlagen", { generatorId, questionId, runId, code, error: sanitizeError(error) });
    return failure(code);
  }

  if (!validateGeneratorProcessorOutputs(definition, outputs)) {
    await prisma.medien_generator_laefe.update({ where: { generator_lauf_id: runId }, data: { status: "FAILED", error_code: "GENERATOR_OUTPUT_FORMAT_INVALID", finished_at: new Date() } });
    return failure("GENERATOR_OUTPUT_FORMAT_INVALID");
  }
  const uploadedOutputs: Array<GeneratorProcessorOutput & { pathname: string; url: string }> = [];
  try {
    for (const output of outputs) {
      const outputDefinition = getMediaSlotDefinition(output.slotKey);
      const pathname = buildMediaUploadPathname("question-media", [
        output.slotKey, outputDefinition.mediaType.toLowerCase(), `${randomUUID()}.${output.fileExtension}`,
      ]);
      const uploaded = await put(pathname, output.bytes, {
        ...authentication, access: "public", addRandomSuffix: false, contentType: output.contentType,
      });
      uploadedOutputs.push({ ...output, pathname, url: uploaded.url });
    }
  } catch (error) {
    await prisma.medien_generator_laefe.update({ where: { generator_lauf_id: runId }, data: { status: "FAILED", error_code: "GENERATOR_OUTPUT_UPLOAD_FAILED", error_message: sanitizeError(error), finished_at: new Date() } });
    console.error("Generatoroutputs konnten nicht vollständig hochgeladen werden", { generatorId, questionId, runId, uploadedPathnames: uploadedOutputs.map((output) => output.pathname), error: sanitizeError(error) });
    return failure("GENERATOR_OUTPUT_UPLOAD_FAILED");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.medien_generator_laefe.updateMany({
        where: { fragen_id: questionId, generator_id: generatorId, status: "SUCCEEDED", generator_lauf_id: { not: runId } },
        data: { status: "STALE", finished_at: new Date() },
      });
      await tx.medien.deleteMany({ where: { fragen_id: questionId, slot_key: { in: [...definition.outputSlots] } } });
      for (const [index, output] of uploadedOutputs.entries()) {
        const outputDefinition = getMediaSlotDefinition(output.slotKey);
        const mediaTypeName = outputDefinition.mediaType === "IMAGE" ? "Bild" : outputDefinition.mediaType === "AUDIO" ? "Audio" : "Video";
        const mediaType = await tx.medientyp.findFirst({ where: { medientyp: { equals: mediaTypeName, mode: "insensitive" } }, select: { medientyp_id: true } });
        if (!mediaType) throw new Error(`Medientyp ${mediaTypeName} fehlt`);
        const medium = await tx.medien.create({
          data: { fragen_id: questionId, medientyp_id: mediaType.medientyp_id, datei: output.url, slot_key: output.slotKey, sortierung: index + 1 },
          select: { medien_id: true },
        });
        await tx.medien_generator_lauf_medien.create({
          data: { generator_lauf_id: runId, medien_id: medium.medien_id, rolle: "OUTPUT", slot_key: output.slotKey },
        });
      }
      await tx.medien_generator_laefe.update({
        where: { generator_lauf_id: runId }, data: { status: "SUCCEEDED", finished_at: new Date(), error_code: null, error_message: null },
      });
    });
  } catch (error) {
    await prisma.medien_generator_laefe.update({ where: { generator_lauf_id: runId }, data: { status: "FAILED", error_code: "GENERATOR_OUTPUT_PERSIST_FAILED", error_message: sanitizeError(error), finished_at: new Date() } }).catch(() => undefined);
    console.error("Generatoroutputs konnten nicht persistiert werden; Blobs sind verwaist", { generatorId, questionId, runId, pathnames: uploadedOutputs.map((output) => output.pathname), error: sanitizeError(error) });
    return failure("GENERATOR_OUTPUT_PERSIST_FAILED");
  }

  return { ok: true, reused: false, messageCode: "generatorSucceeded", ...(await loadState(questionId, templateId)) };
}
