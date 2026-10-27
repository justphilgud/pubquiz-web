import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync, readFileSync } from "node:fs";
import { initRepositoryEvidence, inventoryFromGit } from "./production-preflight-diagnostics";
import { assertPreflightContext, gate, migrationFiles, readProductionDeployment, readProductionMigrations } from "./production-preflight";
import { approvedPreflightPlan, approvedNoDeltaPreflightPlan, assertNoDeltaManifest, hasCompleteNoDeltaHistory } from "./production-preflight-plan";

async function main() {
  assertPreflightContext(process.env);
  if (!/^[a-f0-9]{40}$/.test(process.env.RELEASE_CANDIDATE_SHA ?? "") || !/^[a-f0-9]{40}$/.test(process.env.EXPECTED_PRODUCTION_SHA ?? "")) throw new Error("INVALID_SHA");
  if (!approvedPreflightPlan(process.env.EXPECTED_PRODUCTION_SHA!, process.env.RELEASE_CANDIDATE_SHA!) &&
      !approvedNoDeltaPreflightPlan(process.env.EXPECTED_PRODUCTION_SHA!, process.env.RELEASE_CANDIDATE_SHA!)) throw new Error("RELEASE_PLAN_UNAPPROVED");
  const mode = process.argv[2];
  let result;
  if (mode === "deployment" && process.env.PREFLIGHT_ENVIRONMENT === "production") {
    result = await readProductionDeployment({ token: process.env.VERCEL_TOKEN ?? "", project: process.env.VERCEL_PROJECT_ID ?? "",
      team: process.env.VERCEL_ORG_ID ?? "", alias: process.env.PRODUCTION_ALIAS ?? "", expectedSha: process.env.EXPECTED_PRODUCTION_SHA ?? "" });
  } else if (mode === "database" && process.env.PREFLIGHT_ENVIRONMENT === "operations-backup") {
    const candidate = process.env.RELEASE_CANDIDATE_SHA ?? "";
    const baseline = process.env.EXPECTED_PRODUCTION_SHA ?? "";
    migrationFiles(candidate); migrationFiles(baseline);
    try { execFileSync("git", ["merge-base", "--is-ancestor", baseline, candidate]); }
    catch { result = { gate: gate("BLOCKED", "RELEASE_ANCESTRY_UNVERIFIED") }; }
    if (!result && approvedNoDeltaPreflightPlan(baseline,candidate)) {
      const schema=(revision:string)=>execFileSync("git",["show",`${revision}:prisma/schema.prisma`],{encoding:"utf8"});
      const before=migrationFiles(baseline),after=migrationFiles(candidate);
      const proof=assertNoDeltaManifest(baseline,candidate,before,after,schema(baseline),schema(candidate));
      if (JSON.stringify(JSON.parse(readFileSync("expected-schema.json","utf8"))) !== JSON.stringify(proof)) throw new Error("MANIFEST_ARTIFACT_MISMATCH");
      const history=await readProductionMigrations(process.env.PRODUCTION_BACKUP_DATABASE_URL ?? "",after,before);
      result={...history,repositoryEvidence:proof,
        schemaGate:gate("PASS","REPOSITORY_SCHEMA_IDENTICAL_LIVE_DDL_NOT_RECHECKED"),
        expectedDeltaGate:gate("PASS","REPOSITORY_MIGRATION_DELTA_EMPTY"),deltaGate:gate("PASS","NO_SQL_DELTA_TO_EXECUTE"),
        replayGate:undefined,deltaTest:{status:"NOT_APPLICABLE",code:"NO_SQL_DELTA"},
        newInstallReplay:{status:"NOT_RUN",code:"HISTORICAL_BOOTSTRAP_LIMITATION_UNCHANGED"},
        gate:history.gate.status!=="PASS"?history.gate:gate(hasCompleteNoDeltaHistory(history,after)?"PASS":"FAIL","COMPLETE_NO_DELTA_HISTORY_CHECK")};
    }
    result ??= await readProductionMigrations(process.env.PRODUCTION_BACKUP_DATABASE_URL ?? "", migrationFiles(candidate), migrationFiles(baseline), {candidate:initRepositoryEvidence(candidate),baseline:initRepositoryEvidence(baseline),inventory:inventoryFromGit(baseline),expectedSchema:JSON.parse(readFileSync("expected-schema.json","utf8"))});
  } else throw new Error("CONTEXT_INVALID");
  writeFileSync(`preflight-${mode}.json`, JSON.stringify({ candidateSha: process.env.RELEASE_CANDIDATE_SHA, baselineSha: process.env.EXPECTED_PRODUCTION_SHA,
    checkedAt: new Date().toISOString(), ...result }, null, 2), { flag: "wx" });
  for (const name of ['databaseIdentityGate','privilegesGate','migrationHistoryGate','schemaGate','newInstallReplay','expectedDeltaGate','deltaGate']) {
    const item=(result as Record<string,unknown>)[name] as {status?:string;code?:string}|undefined;
    if(item?.status){const line=`${name}: ${item.status} - ${item.code??'EVIDENCE_RECORDED'}`;console.log(line);if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,line+'\n');}
  }
  if ('gates' in result && Array.isArray(result.gates)) for (const item of result.gates) {
    console.log(`${item.status} � ${item.code}`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${item.status} � ${item.code}\n`);
  }
  console.log(`${result.gate.status} – ${result.gate.code}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${result.gate.status} – ${result.gate.code}\n`);
  if (result.gate.status !== "PASS") process.exitCode = 1;
}
main().catch(() => {
  // Never forward exceptions, network bodies, connection strings or subprocess output.
  writeFileSync("preflight-blocked.json", JSON.stringify({ gate: gate("BLOCKED", "PREFLIGHT_NOT_FULLY_VERIFIABLE") }), { flag: "wx" });
  console.error("BLOCKED – PREFLIGHT_NOT_FULLY_VERIFIABLE"); process.exitCode = 1;
});
