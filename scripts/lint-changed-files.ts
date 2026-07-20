import { appendFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ESLint } from "eslint";

type TransitionBaseline = Readonly<{
  version: number;
  findings: Readonly<Record<string, Readonly<Record<string, number>>>>;
}>;

type ComparableFinding = Readonly<{
  filePath: string;
  ruleId: string | null;
  severity: number;
}>;

const relevantPatterns = [
  "*.js",
  "*.jsx",
  "*.mjs",
  "*.cjs",
  "*.ts",
  "*.tsx",
  "*.mts",
  "*.cts",
] as const;

const baseline = JSON.parse(
  readFileSync(new URL("../config/eslint-transition-baseline.json", import.meta.url), "utf8"),
) as TransitionBaseline;

function runGit(args: readonly string[], options?: { allowFailure?: boolean }) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.status !== 0 && !options?.allowFailure) {
    throw new Error(`Git-Befehl fehlgeschlagen: git ${args[0] ?? ""}`);
  }

  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
  };
}

function requireCommit(commit: string, description: string) {
  if (!commit || !runGit(["cat-file", "-e", `${commit}^{commit}`], { allowFailure: true }).ok) {
    throw new Error(`${description} ist nicht verfügbar.`);
  }

  return commit;
}

function determineComparisonRange() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const ref = process.env.GITHUB_REF;
  const head = requireCommit(
    process.env.CI_HEAD_SHA?.trim() || runGit(["rev-parse", "HEAD"]).stdout.trim(),
    "Der zu prüfende Commit",
  );

  if (eventName === "pull_request") {
    const pullRequestBase = requireCommit(
      process.env.CI_BASE_SHA?.trim() ?? "",
      "Der Pull-Request-Basiscommit",
    );
    return {
      base: runGit(["merge-base", pullRequestBase, head]).stdout.trim(),
      head,
    };
  }

  if (eventName === "push" && ref === "refs/heads/main") {
    const before = process.env.CI_BEFORE_SHA?.trim() ?? "";

    if (!before || /^0+$/.test(before)) {
      return {
        base: runGit(["hash-object", "-t", "tree", "/dev/null"]).stdout.trim(),
        head,
      };
    }

    return {
      base: requireCommit(before, "Der vorherige main-Commit"),
      head,
    };
  }

  if (eventName === "push" || !eventName) {
    runGit(["fetch", "--no-tags", "origin", "main:refs/remotes/origin/main"]);
    return {
      base: runGit(["merge-base", head, "refs/remotes/origin/main"]).stdout.trim(),
      head,
    };
  }

  throw new Error(`Nicht unterstützter CI-Ereignistyp: ${eventName}`);
}

function changedFiles(base: string, head: string) {
  const output = runGit([
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    "-z",
    base,
    head,
    "--",
    ...relevantPatterns,
  ]).stdout;

  return output.split("\0").filter(Boolean);
}

function findingKey(finding: ComparableFinding) {
  return `${finding.severity}:${finding.ruleId ?? "(unknown-rule)"}`;
}

export function findUnexpectedFindings(
  findings: readonly ComparableFinding[],
  transitionBaseline: TransitionBaseline,
) {
  const consumed = new Map<string, number>();

  return findings.filter((finding) => {
    const key = findingKey(finding);
    const budget = transitionBaseline.findings[finding.filePath]?.[key] ?? 0;
    const consumptionKey = `${finding.filePath}\0${key}`;
    const nextCount = (consumed.get(consumptionKey) ?? 0) + 1;
    consumed.set(consumptionKey, nextCount);
    return nextCount > budget;
  });
}

function relativeLintFindings(results: readonly ESLint.LintResult[]) {
  return results.flatMap((result) => {
    const filePath = result.filePath
      .replaceAll("\\", "/")
      .replace(`${process.cwd().replaceAll("\\", "/")}/`, "");

    return result.messages.map((message) => ({
      filePath,
      ruleId: message.ruleId,
      severity: message.severity,
    }));
  });
}

function writeSummary(fileCount: number, knownCount: number, unexpectedCount: number) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  if (!summaryPath) return;

  appendFileSync(
    summaryPath,
    [
      "## Changed-file ESLint",
      `- Checked files: ${fileCount}`,
      `- Known transition findings: ${knownCount}`,
      `- New findings: ${unexpectedCount}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

async function main() {
  if (baseline.version !== 1) {
    throw new Error("Die ESLint-Übergangsbasis verwendet eine unbekannte Version.");
  }

  const range = determineComparisonRange();
  const files = changedFiles(range.base, range.head);

  if (files.length === 0) {
    console.log("Keine geänderten JavaScript-/TypeScript-Dateien; ESLint ist nicht erforderlich.");
    writeSummary(0, 0, 0);
    return;
  }

  console.log(`ESLint prüft ${files.length} geänderte Datei(en).`);
  const eslint = new ESLint({ errorOnUnmatchedPattern: true, warnIgnored: true });
  const results = await eslint.lintFiles(files);
  const formatter = await eslint.loadFormatter("stylish");
  const formatted = await formatter.format(results);

  if (formatted) {
    console.log(formatted);
  }

  const findings = relativeLintFindings(results);
  const unexpected = findUnexpectedFindings(findings, baseline);
  const knownCount = findings.length - unexpected.length;

  console.log(
    `ESLint-Übergangsbasis: ${knownCount} bekannte Finding(s), ${unexpected.length} neue Finding(s).`,
  );
  writeSummary(files.length, knownCount, unexpected.length);

  if (unexpected.length > 0) {
    const affectedFiles = [...new Set(unexpected.map((finding) => finding.filePath))];
    console.error(
      `Neue ESLint-Findings sind nicht erlaubt. Betroffene Datei(en): ${affectedFiles.join(", ")}`,
    );
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (entryPoint === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Changed-file ESLint ist fehlgeschlagen.");
    process.exitCode = 1;
  });
}
