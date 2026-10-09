import { readFileSync, writeFileSync } from "node:fs";
import { parseEditorialPool, sha256, type EditorialSource } from "../app/fragen/import/external/editorialImport";
import { runEditorialDatabaseImport } from "../app/fragen/import/external/editorialImportDatabase";

// Fixed approved source and fixed read-only mode. No SQL or mode CLI arguments.
const approved = {
  "anagrams.json": "dc0a2511690b0e4df4cd924dc6000b4d792f03ad95f87990dee24bd5f09cd4f0",
  "estimates.json": "3fc63c06afe83c47c8192f374eeb9206628bbd03dc322e01abf6b6b99008c89f",
};

async function main() {
  if (process.env.CI !== "true" || process.env.DEPLOYMENT_ENV !== "preview") throw new Error("EDITORIAL_PREVIEW_CI_REQUIRED");
  const rows = Object.entries(approved).map(([name, hash]) => {
    const raw = readFileSync(`editorial/paule-oktober-2026/${name}`, "utf8");
    if (sha256(raw) !== hash) throw new Error("EDITORIAL_APPROVED_CHECKSUM_MISMATCH");
    return { name, sha256: hash, candidates: parseEditorialPool(name, raw) };
  });
  const source: EditorialSource = { provider: "Editorial:PR93", files: rows.map(({name,sha256}) => ({name,sha256})), candidates: rows.flatMap(row => row.candidates) };
  const result = await runEditorialDatabaseImport({ connectionString: process.env.DATABASE_URL ?? "", source, mode: "dry-run" });
  writeFileSync("editorial-dry-run.json", JSON.stringify({ source: source.files, ...result }, null, 2), { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ candidates: result.decisions.length, importable: result.decisions.filter(d => d.action === "IMPORTIEREN").length,
    skipped: result.decisions.filter(d => d.action === "ÜBERSPRINGEN").length, manual: result.decisions.filter(d => d.action === "MANUELL PRÜFEN").length,
    existingQuestions: result.before.fragen.count, readOnly: true }));
}
main().catch(() => { console.error("EDITORIAL_READ_ONLY_DRY_RUN_FAILED"); process.exitCode = 1; });
