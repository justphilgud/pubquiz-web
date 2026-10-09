import { readdirSync, writeFileSync } from "node:fs";
import { approvedProductionEditorialSource, assertProductionEditorialContext } from "../app/fragen/import/external/editorialProductionPolicy";
import { runEditorialDatabaseImport } from "../app/fragen/import/external/editorialImportDatabase";

async function main() {
  assertProductionEditorialContext(process.env);
  const result = await runEditorialDatabaseImport({ connectionString: process.env.PRODUCTION_BACKUP_DATABASE_URL ?? "",
    source: approvedProductionEditorialSource(), mode: "dry-run", productionPreflight: true });
  if (result.mode !== "dry-run") throw new Error("EDITORIAL_READ_ONLY_REQUIRED");
  const schema = result.productionSchema as { migrations: { migration_name: string; finished_at: string | null; rolled_back_at: string | null }[];
    difficultyColumn: { data_type: string; is_nullable: string; character_maximum_length: number }[];
    difficultyConstraint: { convalidated: boolean; definition: string }[] };
  const completed = new Set(schema.migrations.filter(row => row.finished_at && !row.rolled_back_at).map(row => row.migration_name));
  const pending = readdirSync("prisma/migrations", { withFileTypes: true }).filter(row => row.isDirectory() && !completed.has(row.name)).map(row => row.name).sort();
  const failed = schema.migrations.filter(row => !row.finished_at && !row.rolled_back_at).map(row => row.migration_name);
  const difficultyCompatible = schema.difficultyColumn.length === 1 && schema.difficultyColumn[0].data_type === "character varying" &&
    schema.difficultyColumn[0].is_nullable === "YES" && schema.difficultyColumn[0].character_maximum_length === 10 &&
    schema.difficultyConstraint.length === 1 && schema.difficultyConstraint[0].convalidated &&
    ["LEICHT", "MITTEL", "SCHWER"].every(value => schema.difficultyConstraint[0].definition.includes(`'${value}'`));
  writeFileSync("editorial-production-preflight.json", JSON.stringify({ sha: process.env.GITHUB_SHA,
    productionSha: process.env.EDITORIAL_PRODUCTION_SHA, productionChanged: false, writeAuthorized: false,
    migrationAssessment: { pending, failed, difficultyCompatible, requiresManualSchemaReview: true }, ...result }, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ candidates: result.decisions.length, importable: result.decisions.filter(row => row.action === "IMPORTIEREN").length,
    conflicts: result.decisions.filter(row => row.action === "MANUELL PRÜFEN").length, existingQuestions: result.before.fragen.count,
    productionChanged: false, writeAuthorized: false }));
}
main().catch(() => { console.error("EDITORIAL_PRODUCTION_PREFLIGHT_FAILED_DETAILS_WITHHELD"); process.exitCode = 1; });
