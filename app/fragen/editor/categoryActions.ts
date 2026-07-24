"use server";

import { revalidatePath } from "next/cache";
import {
  canManageCategories,
  requireQuestionEditor,
} from "@/app/lib/permissions";
import { getCurrentUserId } from "@/app/services/questionService";
import {
  CategoryWriteError,
  createCategoryRecord,
} from "./categoryService.server";

export type CategoryActionErrorCode =
  | "INVALID_NAME"
  | "CATEGORY_EXISTS"
  | "PERMISSION_DENIED"
  | "UNEXPECTED_ERROR";

export type CategoryActionResult =
  | {
      ok: true;
      category: {
        id: number;
        name: string;
        status: "ACTIVE" | "PENDING";
      };
    }
  | { ok: false; code: CategoryActionErrorCode };

export async function createOrSuggestCategory(
  name: string,
): Promise<CategoryActionResult> {
  const session = await requireQuestionEditor();
  const status = canManageCategories(session.actor) ? "ACTIVE" : "PENDING";

  try {
    const category = await createCategoryRecord({
      name,
      status,
      createdByUserId: getCurrentUserId(session),
    });
    revalidatePath("/fragen");
    revalidatePath("/fragen/editor");
    revalidatePath("/admin/kategorien");
    return { ok: true, category };
  } catch (error) {
    if (error instanceof CategoryWriteError) {
      return { ok: false, code: error.code };
    }
    console.error("Kategorie konnte nicht angelegt oder vorgeschlagen werden", {
      operation: "create_or_suggest",
      errorClass: error instanceof Error ? error.name : "UnknownError",
      errorCode:
        typeof error === "object" && error !== null && "code" in error &&
        typeof error.code === "string"
          ? error.code
          : undefined,
    });
    return { ok: false, code: "UNEXPECTED_ERROR" };
  }
}
