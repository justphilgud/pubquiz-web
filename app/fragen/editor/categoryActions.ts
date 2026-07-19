"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import {
  canManageCategories,
  requireQuestionEditor,
} from "@/app/lib/permissions";
import {
  canDeleteCategoryWithAssignments,
  isValidCategoryName,
  normalizeCategoryName,
} from "./categoryPolicy";

export type CategoryActionErrorCode =
  | "INVALID_NAME"
  | "CATEGORY_EXISTS"
  | "CATEGORY_NOT_FOUND"
  | "CATEGORY_IN_USE"
  | "PERMISSION_DENIED"
  | "UNEXPECTED_ERROR";

type CategoryActionResult =
  | { ok: true; category: { id: number; name: string } }
  | { ok: false; code: CategoryActionErrorCode };

type DeleteCategoryResult =
  | { ok: true; categoryId: number }
  | { ok: false; code: CategoryActionErrorCode };

async function authorizeCategoryManagement() {
  const session = await requireQuestionEditor();
  return canManageCategories(session);
}

async function categoryNameExists(name: string, excludeId?: number) {
  return prisma.fragenkategorie.findFirst({
    where: {
      fragenkategorie_id: excludeId ? { not: excludeId } : undefined,
      kategorie: { equals: name, mode: "insensitive" },
    },
    select: { fragenkategorie_id: true },
  });
}

export async function createCategory(name: string): Promise<CategoryActionResult> {
  if (!await authorizeCategoryManagement()) {
    return { ok: false, code: "PERMISSION_DENIED" };
  }
  const normalizedName = normalizeCategoryName(name);
  if (!isValidCategoryName(normalizedName)) {
    return { ok: false, code: "INVALID_NAME" };
  }
  if (await categoryNameExists(normalizedName)) {
    return { ok: false, code: "CATEGORY_EXISTS" };
  }

  try {
    const category = await prisma.fragenkategorie.create({
      data: { kategorie: normalizedName },
      select: { fragenkategorie_id: true, kategorie: true },
    });
    revalidatePath("/fragen");
    revalidatePath("/fragen/editor");
    return {
      ok: true,
      category: { id: category.fragenkategorie_id, name: category.kategorie },
    };
  } catch (error) {
    console.error("Kategorie konnte nicht angelegt werden", {
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false, code: "UNEXPECTED_ERROR" };
  }
}

export async function renameCategory(
  categoryId: number,
  name: string,
): Promise<CategoryActionResult> {
  if (!await authorizeCategoryManagement()) {
    return { ok: false, code: "PERMISSION_DENIED" };
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, code: "CATEGORY_NOT_FOUND" };
  }
  const normalizedName = normalizeCategoryName(name);
  if (!isValidCategoryName(normalizedName)) {
    return { ok: false, code: "INVALID_NAME" };
  }
  const existing = await prisma.fragenkategorie.findUnique({
    where: { fragenkategorie_id: categoryId },
    select: { fragenkategorie_id: true },
  });
  if (!existing) return { ok: false, code: "CATEGORY_NOT_FOUND" };
  if (await categoryNameExists(normalizedName, categoryId)) {
    return { ok: false, code: "CATEGORY_EXISTS" };
  }

  try {
    const category = await prisma.fragenkategorie.update({
      where: { fragenkategorie_id: categoryId },
      data: { kategorie: normalizedName },
      select: { fragenkategorie_id: true, kategorie: true },
    });
    revalidatePath("/fragen");
    revalidatePath("/fragen/editor");
    return {
      ok: true,
      category: { id: category.fragenkategorie_id, name: category.kategorie },
    };
  } catch (error) {
    console.error("Kategorie konnte nicht umbenannt werden", {
      categoryId,
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false, code: "UNEXPECTED_ERROR" };
  }
}

export async function deleteCategory(categoryId: number): Promise<DeleteCategoryResult> {
  if (!await authorizeCategoryManagement()) {
    return { ok: false, code: "PERMISSION_DENIED" };
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, code: "CATEGORY_NOT_FOUND" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.fragenkategorie.findUnique({
        where: { fragenkategorie_id: categoryId },
        select: {
          fragenkategorie_id: true,
          _count: { select: { fragen_kategorien: true } },
        },
      });
      if (!category) return "CATEGORY_NOT_FOUND" as const;
      if (!canDeleteCategoryWithAssignments(category._count.fragen_kategorien)) {
        return "CATEGORY_IN_USE" as const;
      }
      await tx.fragenkategorie.delete({
        where: { fragenkategorie_id: categoryId },
      });
      return null;
    });
    if (result) return { ok: false, code: result };
    revalidatePath("/fragen");
    revalidatePath("/fragen/editor");
    return { ok: true, categoryId };
  } catch (error) {
    console.error("Kategorie konnte nicht gelöscht werden", {
      categoryId,
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false, code: "UNEXPECTED_ERROR" };
  }
}
