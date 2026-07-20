import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";

const MAX_ATTEMPTS = 3;

export async function withSerializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      const retryable = typeof error === "object" && error !== null &&
        "code" in error && error.code === "P2034";
      if (!retryable || attempt === MAX_ATTEMPTS) throw error;
    }
  }
  throw new Error("Transaktion konnte nicht abgeschlossen werden.");
}
