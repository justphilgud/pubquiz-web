import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { withSerializableTransaction } from "@/app/roles/serializableTransaction.server";
import {
  isCategoryDuplicate,
  isValidCategoryName,
  normalizeCategoryName,
} from "./categoryPolicy";

export type CategoryWriteErrorCode =
  | "INVALID_NAME"
  | "CATEGORY_EXISTS";

export class CategoryWriteError extends Error {
  constructor(
    readonly code: CategoryWriteErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CategoryWriteError";
  }
}

type CategoryWriteClient = Pick<
  Prisma.TransactionClient,
  "fragenkategorie"
>;

export async function assertCategoryNameAvailable(
  transaction: CategoryWriteClient,
  name: string,
  excludeCategoryId?: number,
) {
  const categories = await transaction.fragenkategorie.findMany({
    where: excludeCategoryId
      ? { fragenkategorie_id: { not: excludeCategoryId } }
      : undefined,
    select: { kategorie: true },
  });
  if (isCategoryDuplicate(
    categories.map((category) => ({ name: category.kategorie })),
    name,
    "de",
  )) {
    throw new CategoryWriteError(
      "CATEGORY_EXISTS",
      "Eine Kategorie mit diesem Namen existiert bereits.",
    );
  }
}

export async function createCategoryRecord(input: {
  name: string;
  status: "ACTIVE" | "PENDING";
  createdByUserId: number;
}) {
  const normalizedName = normalizeCategoryName(input.name);
  if (!isValidCategoryName(normalizedName)) {
    throw new CategoryWriteError(
      "INVALID_NAME",
      "Der Kategoriename ist ungültig.",
    );
  }

  return withSerializableTransaction(async (transaction) => {
    await assertCategoryNameAvailable(transaction, normalizedName);
    try {
      const category = await transaction.fragenkategorie.create({
        data: {
          kategorie: normalizedName,
          status: input.status,
          created_by_user_id: input.createdByUserId,
        },
        select: {
          fragenkategorie_id: true,
          kategorie: true,
          status: true,
        },
      });
      return {
        id: category.fragenkategorie_id,
        name: category.kategorie,
        status: input.status,
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new CategoryWriteError(
          "CATEGORY_EXISTS",
          "Eine Kategorie mit diesem Namen existiert bereits.",
        );
      }
      throw error;
    }
  });
}
