/** Offline reference generator. Input is only reviewed migration SQL, never a live database. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const name = "20261028090000_bingo_live";
const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8").replaceAll("\r\n", "\n");
if (/CREATE\s+(?:OR REPLACE\s+)?FUNCTION/i.test(sql)) throw Error("NEW_ROUTINE_REQUIRES_SEPARATE_REVIEW");
const triggers = [...sql.matchAll(/CREATE TRIGGER (bingo_live_\w+) BEFORE (UPDATE(?: OF ([\w,]+))? OR DELETE|UPDATE OF ([\w,]+)|DELETE)\s+ON pubquiz\.(bingo_live_\w+)\s+FOR EACH ROW EXECUTE FUNCTION pubquiz\.bingo_immutable_record\(\);/g)].map(m => ({
  schema: "pubquiz", name: m[1], table: m[5], functionSchema: "pubquiz", functionName: "bingo_immutable_record",
  type: m[2] === "UPDATE OR DELETE" ? 27 : m[2] === "DELETE" ? 11 : 19,
  enabled: "O", deferrable: false, deferred: false, constraint: false, columns: m[3] ?? m[4] ?? "", arguments: "", condition: null,
}));
if (triggers.length !== 4) throw Error("EXACT_FOUR_REVIEWED_TRIGGERS_REQUIRED");
writeFileSync("scripts/operations/schema-reference/bingo-live-routines.json", JSON.stringify({
  migrations: [{ name, sha256: createHash("sha256").update(sql).digest("hex") }],
  tables: ["bingo_live_cards", "bingo_live_events", "bingo_live_runs"],
  triggers: triggers.sort((a, b) => a.name.localeCompare(b.name, "en")),
}, null, 2) + "\n");
