"use server";

import { requireAdmin } from "@/app/lib/permissions";
import { getLogicalEnvironment } from "@/config/environment";
import { parseEditorialPool, sha256, type EditorialSource } from "./external/editorialImport";
import { runEditorialDatabaseImport } from "./external/editorialImportDatabase";

const PR93_HASHES: Record<string, string> = {
  "anagrams.json": "631f16376a39a5a6b5d6d98fce593c064ccff7524235809f4740470867988c9b",
  "estimates.json": "85af63d465b2457093fd62be1129241b82d430700ebfa3616d2222ab4058373c",
};
export async function editorialImportAction(input: { sourceKey: string; files: { name: string; raw: string }[]; digest?: string; mode: "dry-run" | "import" }) {
  const session = await requireAdmin();
  if (getLogicalEnvironment() !== "preview") throw new Error("EDITORIAL_PREVIEW_REQUIRED");
  if (!input || !["dry-run", "import"].includes(input.mode) || !/^[-a-zA-Z0-9/]{1,60}$/.test(input.sourceKey) || !Array.isArray(input.files) || !input.files.length || input.files.length > 10) throw new Error("EDITORIAL_REQUEST_INVALID");
  let bytes = 0;
  const files = input.files.map(f => {
    if (typeof f?.name !== "string" || !/^[a-zA-Z0-9_.-]+\.json$/.test(f.name) || typeof f.raw !== "string") throw new Error("EDITORIAL_FILE_INVALID");
    bytes += Buffer.byteLength(f.raw);
    const hash = sha256(f.raw);
    if (input.sourceKey === "PR93" && PR93_HASHES[f.name] !== hash) throw new Error("EDITORIAL_APPROVED_CHECKSUM_MISMATCH");
    return { name: f.name, sha256: hash };
  });
  if (bytes > 500_000 || new Set(files.map(f => f.name)).size !== files.length) throw new Error("EDITORIAL_FILE_LIMIT");
  const source: EditorialSource = { provider: `Editorial:${input.sourceKey}`, files,
    candidates: input.files.flatMap(f => parseEditorialPool(f.name, f.raw)) };
  if (!source.candidates.length || source.candidates.length > 1000) throw new Error("EDITORIAL_CANDIDATE_LIMIT");
  try {
    return await runEditorialDatabaseImport({ connectionString: process.env.DATABASE_URL ?? "", source,
      operatorUserId: session.actor.userId, mode: input.mode, expectedDryRunDigest: input.digest });
  } catch (error) {
    const code = error instanceof Error && /^EDITORIAL_[A-Z_]+$/.test(error.message) ? error.message : "EDITORIAL_DATABASE_OPERATION_FAILED";
    throw new Error(code);
  }
}
