"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/lib/permissions";
import { getCurrentUserId } from "@/app/services/questionService";
import { withSerializableTransaction } from "@/app/roles/serializableTransaction.server";
import {
  CategoryWriteError,
  assertCategoryNameAvailable,
  createCategoryRecord,
} from "@/app/fragen/editor/categoryService.server";
import {
  isValidCategoryName,
  normalizeCategoryName,
} from "@/app/fragen/editor/categoryPolicy";

export type AdminCategoryActionResult =
  | { ok: true; message: string; affectedQuestions?: number }
  | { ok: false; message: string };

function revalidateCategoryPages() {
  revalidatePath("/admin/kategorien");
  revalidatePath("/fragen");
  revalidatePath("/fragen/editor");
}

function categoryFailure(error: unknown, operation: string) {
  if (error instanceof CategoryWriteError) {
    return { ok: false, message: error.message } as const;
  }
  console.error("Kategorienverwaltung fehlgeschlagen", {
    operation,
    errorClass: error instanceof Error ? error.name : "UnknownError",
    errorCode:
      typeof error === "object" && error !== null && "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined,
  });
  return {
    ok: false,
    message: "Die Kategorieaktion konnte nicht abgeschlossen werden.",
  } as const;
}

export async function createAdminCategory(
  name: string,
): Promise<AdminCategoryActionResult> {
  const session = await requireAdmin();
  try {
    await createCategoryRecord({
      name,
      status: "ACTIVE",
      createdByUserId: getCurrentUserId(session),
    });
    revalidateCategoryPages();
    return { ok: true, message: "Kategorie wurde angelegt." };
  } catch (error) {
    return categoryFailure(error, "create");
  }
}

export async function renameAdminCategory(
  categoryId: number,
  name: string,
): Promise<AdminCategoryActionResult> {
  await requireAdmin();
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, message: "Kategorie wurde nicht gefunden." };
  }
  const normalizedName = normalizeCategoryName(name);
  if (!isValidCategoryName(normalizedName)) {
    return { ok: false, message: "Der Kategoriename ist ungültig." };
  }
  try {
    await withSerializableTransaction(async (transaction) => {
      const exists = await transaction.fragenkategorie.count({
        where: { fragenkategorie_id: categoryId },
      });
      if (exists !== 1) {
        throw new CategoryWriteError(
          "INVALID_NAME",
          "Kategorie wurde nicht gefunden.",
        );
      }
      await assertCategoryNameAvailable(
        transaction,
        normalizedName,
        categoryId,
      );
      await transaction.fragenkategorie.update({
        where: { fragenkategorie_id: categoryId },
        data: { kategorie: normalizedName },
      });
    });
    revalidateCategoryPages();
    return { ok: true, message: "Kategorie wurde umbenannt." };
  } catch (error) {
    return categoryFailure(error, "rename");
  }
}

export async function approveSuggestedCategory(
  categoryId: number,
  name: string,
): Promise<AdminCategoryActionResult> {
  await requireAdmin();
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, message: "Kategorie wurde nicht gefunden." };
  }
  const normalizedName = normalizeCategoryName(name);
  if (!isValidCategoryName(normalizedName)) {
    return { ok: false, message: "Der Kategoriename ist ungültig." };
  }
  try {
    await withSerializableTransaction(async (transaction) => {
      const category = await transaction.fragenkategorie.findUnique({
        where: { fragenkategorie_id: categoryId },
        select: { status: true },
      });
      if (!category || category.status !== "PENDING") {
        throw new CategoryWriteError(
          "INVALID_NAME",
          "Der Vorschlag ist nicht mehr zur Prüfung verfügbar.",
        );
      }
      await assertCategoryNameAvailable(
        transaction,
        normalizedName,
        categoryId,
      );
      await transaction.fragenkategorie.update({
        where: { fragenkategorie_id: categoryId },
        data: { kategorie: normalizedName, status: "ACTIVE" },
      });
    });
    revalidateCategoryPages();
    return { ok: true, message: "Vorschlag wurde bestätigt." };
  } catch (error) {
    return categoryFailure(error, "approve");
  }
}

export async function setCategoryArchived(
  categoryId: number,
  archived: boolean,
): Promise<AdminCategoryActionResult> {
  await requireAdmin();
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, message: "Kategorie wurde nicht gefunden." };
  }
  try {
    const updated = await withSerializableTransaction(async (transaction) =>
      transaction.fragenkategorie.updateMany({
        where: { fragenkategorie_id: categoryId },
        data: { status: archived ? "ARCHIVED" : "ACTIVE" },
      }),
    );
    if (updated.count !== 1) {
      return { ok: false, message: "Kategorie wurde nicht gefunden." };
    }
    revalidateCategoryPages();
    return {
      ok: true,
      message: archived
        ? "Kategorie wurde archiviert."
        : "Kategorie wurde reaktiviert.",
    };
  } catch (error) {
    return categoryFailure(error, archived ? "archive" : "reactivate");
  }
}

export async function deleteUnusedCategory(
  categoryId: number,
): Promise<AdminCategoryActionResult> {
  await requireAdmin();
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, message: "Kategorie wurde nicht gefunden." };
  }
  try {
    await withSerializableTransaction(async (transaction) => {
      const category = await transaction.fragenkategorie.findUnique({
        where: { fragenkategorie_id: categoryId },
        select: {
          fragenkategorie_id: true,
          _count: { select: { fragen_kategorien: true } },
        },
      });
      if (!category) {
        throw new CategoryWriteError(
          "INVALID_NAME",
          "Kategorie wurde nicht gefunden.",
        );
      }
      if (category._count.fragen_kategorien > 0) {
        throw new CategoryWriteError(
          "INVALID_NAME",
          `Diese Kategorie wird noch von ${category._count.fragen_kategorien} Fragen verwendet und kann nicht gelöscht werden. Archiviere sie oder führe sie mit einer anderen Kategorie zusammen.`,
        );
      }
      await transaction.fragenkategorie.delete({
        where: { fragenkategorie_id: categoryId },
      });
    });
    revalidateCategoryPages();
    return { ok: true, message: "Ungenutzte Kategorie wurde gelöscht." };
  } catch (error) {
    return categoryFailure(error, "delete_unused");
  }
}

export async function mergeCategories(
  sourceCategoryId: number,
  targetCategoryId: number,
): Promise<AdminCategoryActionResult> {
  await requireAdmin();
  if (
    !Number.isInteger(sourceCategoryId) ||
    !Number.isInteger(targetCategoryId) ||
    sourceCategoryId <= 0 ||
    targetCategoryId <= 0 ||
    sourceCategoryId === targetCategoryId
  ) {
    return { ok: false, message: "Quell- und Zielkategorie sind ungültig." };
  }
  try {
    const affectedQuestions = await withSerializableTransaction(
      async (transaction) => {
        const [source, target] = await Promise.all([
          transaction.fragenkategorie.findUnique({
            where: { fragenkategorie_id: sourceCategoryId },
            select: {
              status: true,
              fragen_kategorien: { select: { fragen_id: true } },
            },
          }),
          transaction.fragenkategorie.findUnique({
            where: { fragenkategorie_id: targetCategoryId },
            select: { status: true },
          }),
        ]);
        if (!source || !target || target.status !== "ACTIVE") {
          throw new CategoryWriteError(
            "INVALID_NAME",
            "Quell- oder aktive Zielkategorie wurde nicht gefunden.",
          );
        }
        const questionIds = source.fragen_kategorien.map(
          ({ fragen_id: questionId }) => questionId,
        );
        if (questionIds.length > 0) {
          await transaction.fragen_kategorien.createMany({
            data: questionIds.map((questionId) => ({
              fragen_id: questionId,
              fragenkategorie_id: targetCategoryId,
            })),
            skipDuplicates: true,
          });
        }
        await transaction.fragen_kategorien.deleteMany({
          where: { fragenkategorie_id: sourceCategoryId },
        });
        await transaction.fragenkategorie.update({
          where: { fragenkategorie_id: sourceCategoryId },
          data: { status: "ARCHIVED" },
        });
        return questionIds.length;
      },
    );
    revalidateCategoryPages();
    return {
      ok: true,
      message: "Kategorien wurden zusammengeführt.",
      affectedQuestions,
    };
  } catch (error) {
    return categoryFailure(error, "merge");
  }
}
