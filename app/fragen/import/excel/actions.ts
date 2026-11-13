"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireQuestionEditor } from "@/app/lib/permissions";
import { sessionUserId } from "@/app/roles/roleAssignments.server";
import { maxFileBytes, parseTarget, type ConfirmResult, type Issue, type PreviewResult } from "./format";
import { confirmImport, previewImport } from "./importService";

function readRequest(form: FormData) {
  const file = form.get("file");
  const targetValue = form.get("target");
  const target = typeof targetValue === "string" ? parseTarget(targetValue) : null;
  if (!target) return { issue: { sheet: "Zielbereich", field: "Eventreihe", message: "Bitte einen Zielbereich auswählen." } satisfies Issue };
  if (!(file instanceof File) || !/\.xlsx$/i.test(file.name)) {
    return { issue: { sheet: "Datei", field: "Datei", message: "Bitte eine XLSX-Datei ohne Makros auswählen." } satisfies Issue };
  }
  if (file.size > maxFileBytes) {
    return { issue: { sheet: "Datei", field: "Datei", message: "Die XLSX-Datei überschreitet 768 KiB." } satisfies Issue };
  }
  return { file, target };
}

const serviceUnavailable: Issue = {
  sheet: "Datei", field: "Import", message: "Der Excel-Import konnte nicht verarbeitet werden. Bitte erneut versuchen.",
};

function planSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Excel import signing secret unavailable");
  return secret;
}

export async function previewExcelQuestions(form: FormData): Promise<PreviewResult> {
  const session = await requireQuestionEditor();
  const request = readRequest(form);
  if (request.issue) return { questions: [], warnings: [], errors: [request.issue] };
  try {
    return await previewImport(prisma, sessionUserId(session), request.target,
      Buffer.from(await request.file.arrayBuffer()), planSecret());
  } catch (error) {
    console.error("Excel-Fragenimport: Vorschau fehlgeschlagen", error instanceof Error ? error.name : "");
    return { questions: [], warnings: [], errors: [serviceUnavailable] };
  }
}

export async function confirmExcelQuestions(form: FormData): Promise<ConfirmResult> {
  const session = await requireQuestionEditor();
  const request = readRequest(form);
  if (request.issue) return { ok: false, errors: [request.issue] };
  const token = form.get("token");
  if (typeof token !== "string") return { ok: false, errors: [{ ...serviceUnavailable, message: "Bitte zuerst die Datei prüfen." }] };
  try {
    const result = await confirmImport(prisma, sessionUserId(session), request.target,
      Buffer.from(await request.file.arrayBuffer()), token, planSecret());
    if (result.ok) {
      revalidatePath("/content/questions");
      revalidatePath("/fragen");
    }
    return result;
  } catch (error) {
    console.error("Excel-Fragenimport: Bestätigung fehlgeschlagen", error instanceof Error ? error.name : "");
    return { ok: false, errors: [serviceUnavailable] };
  }
}
