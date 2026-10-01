import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const wrapper = resolve("scripts/external-import/invoke-production-writer-role.ps1");
const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";

type FakeMode = "PASS" | "BLOCK" | "TECHNICAL" | "UNEXPECTED";

function runWrapper(mode: "Precheck" | "Setup", fakeMode: FakeMode) {
  const directory = mkdtempSync(join(tmpdir(), "pubquiz-writer-wrapper-"));
  const fakePsql = join(directory, "fake-psql.ps1");
  const driver = join(directory, "driver.ps1");
  const callLog = join(directory, "calls.log");
  writeFileSync(
    fakePsql,
    String.raw`[CmdletBinding(PositionalBinding = $false)]
param(
  [Parameter(ValueFromPipeline = $true)]
  [AllowEmptyString()]
  [string]$PipelineInput,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

end {
  if ($RemainingArgs -contains '--version') {
    Write-Output 'psql (PostgreSQL) 18.4'
    exit 0
  }

  Add-Content -LiteralPath $env:PUBQUIZ_FAKE_PSQL_LOG -Value ($RemainingArgs -join ' ')
  switch ($env:PUBQUIZ_FAKE_PSQL_MODE) {
    'PASS' { Write-Output 'PUBQUIZ_WRITER_PRECHECK|PASS|ALL_GATES_PASSED'; exit 0 }
    'BLOCK' { Write-Output 'PUBQUIZ_WRITER_PRECHECK|BLOCK|PUBLIC_TEMPORARY_INHERITED'; exit 0 }
    'TECHNICAL' { exit 73 }
    'UNEXPECTED' { Write-Output 'unexpected output'; exit 0 }
    default { exit 74 }
  }
}
`,
    "utf8",
  );

  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  writeFileSync(driver, `
function global:Read-Host {
  param([string]$Prompt, [switch]$AsSecureString)
  $secure = [Security.SecureString]::new()
  foreach ($character in 'synthetic-password'.ToCharArray()) {
    $secure.AppendChar($character)
  }
  $secure.MakeReadOnly()
  $secure
}
& ${quote(wrapper)} -Mode ${quote(mode)} -PsqlPath ${quote(fakePsql)}
exit $LASTEXITCODE
`, "utf8");
  const args = [
    "-NoProfile",
    ...(process.platform === "win32" ? ["-ExecutionPolicy", "Bypass"] : []),
    "-File",
    driver,
  ];
  const result = spawnSync(shell, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      PUBQUIZ_FAKE_PSQL_LOG: callLog,
      PUBQUIZ_FAKE_PSQL_MODE: fakeMode,
    },
    timeout: 15_000,
  });
  const calls = (() => {
    try {
      return readFileSync(callLog, "utf8");
    } catch {
      return "";
    }
  })();
  rmSync(directory, { recursive: true, force: true });
  return { ...result, calls };
}

test("Precheck PASS returns process exit code 0", () => {
  const result = runWrapper("Precheck", "PASS");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /precheck passed/i);
});

test("Setup BLOCK returns exit code 10 before any setup SQL", () => {
  const result = runWrapper("Setup", "BLOCK");
  assert.equal(result.status, 10, result.stderr);
  assert.match(result.stderr, /PUBLIC_TEMPORARY_INHERITED/);
  assert.match(result.calls, /precheck-production-writer\.psql/);
  assert.doesNotMatch(result.calls, /setup-production-writer\.psql/);
});

test("Setup PASS validates the single password placeholder and invokes setup SQL", () => {
  const result = runWrapper("Setup", "PASS");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /precheck passed/i);
  const calls = result.calls.trim().split(/\r?\n/);
  assert.equal(calls.length, 2, result.calls);
  assert.match(calls[0], /precheck-production-writer\.psql/);
  assert.doesNotMatch(calls[1], /precheck-production-writer\.psql/);
});

test("technical psql failure returns exit code 20", () => {
  const result = runWrapper("Precheck", "TECHNICAL");
  assert.equal(result.status, 20, result.stderr);
  assert.match(result.stderr, /failed technically/i);
});

test("missing or unexpected protocol status fails closed with exit code 21", () => {
  const result = runWrapper("Precheck", "UNEXPECTED");
  assert.equal(result.status, 21, result.stderr);
  assert.match(result.stderr, /no unique valid status/i);
});
