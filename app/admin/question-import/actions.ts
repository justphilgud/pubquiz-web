"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/lib/permissions";
import { getCurrentUserId } from "@/app/services/questionService";
import {
  approveExternalQuestion,
  rejectExternalQuestion,
  saveExternalQuestionPreparation,
  startOpenTdbPilot,
} from "@/app/fragen/import/external/externalQuestionImport.server";

function positiveInteger(value: FormDataEntryValue | null, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name}_INVALID`);
  return parsed;
}

function optionalPositiveInteger(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  return positiveInteger(value, "CATEGORY_ID");
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function startOpenTdbPilotAction() {
  const session = await requireAdmin();
  const result = await startOpenTdbPilot({ userId: getCurrentUserId(session) });
  revalidatePath("/admin/question-import");
  redirect(`/admin/question-import?batch=${result.import_batch_id}`);
}

export async function saveExternalQuestionAction(formData: FormData) {
  await requireAdmin();
  const itemId = positiveInteger(formData.get("itemId"), "ITEM_ID");
  const batchId = positiveInteger(formData.get("batchId"), "BATCH_ID");
  const page = positiveInteger(formData.get("page"), "PAGE");
  await saveExternalQuestionPreparation({
    itemId,
    categoryId: optionalPositiveInteger(formData.get("categoryId")),
    enrichment: {
      question: text(formData, "question"),
      correctAnswer: text(formData, "correctAnswer"),
      incorrectAnswers: [0, 1, 2].map((index) =>
        text(formData, `incorrectAnswer${index}`),
      ),
      explanation: text(formData, "explanation") || null,
      verificationSourceUrl: text(formData, "verificationSourceUrl") || null,
      verificationSourceTitle: text(formData, "verificationSourceTitle") || null,
      suggestedCategoryName: text(formData, "suggestedCategoryName") || null,
    },
  });
  revalidatePath("/admin/question-import");
  redirect(`/admin/question-import?batch=${batchId}&page=${page}&saved=${itemId}`);
}

export async function approveExternalQuestionAction(formData: FormData) {
  const session = await requireAdmin();
  const itemId = positiveInteger(formData.get("itemId"), "ITEM_ID");
  const batchId = positiveInteger(formData.get("batchId"), "BATCH_ID");
  const page = positiveInteger(formData.get("page"), "PAGE");
  const question = await approveExternalQuestion({
    itemId,
    userId: getCurrentUserId(session),
  });
  revalidatePath("/admin/question-import");
  revalidatePath("/fragen");
  redirect(
    `/admin/question-import?batch=${batchId}&page=${page}&approved=${question.fragen_id}`,
  );
}

export async function rejectExternalQuestionAction(formData: FormData) {
  const session = await requireAdmin();
  const itemId = positiveInteger(formData.get("itemId"), "ITEM_ID");
  const batchId = positiveInteger(formData.get("batchId"), "BATCH_ID");
  const page = positiveInteger(formData.get("page"), "PAGE");
  await rejectExternalQuestion({
    itemId,
    userId: getCurrentUserId(session),
    reason: text(formData, "reason"),
  });
  revalidatePath("/admin/question-import");
  redirect(`/admin/question-import?batch=${batchId}&page=${page}&rejected=${itemId}`);
}
