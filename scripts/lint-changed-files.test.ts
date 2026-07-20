import assert from "node:assert/strict";
import test from "node:test";
import { findUnexpectedFindings } from "./lint-changed-files";

const baseline = {
  version: 1,
  findings: {
    "existing.ts": {
      "1:example/warning": 1,
      "2:example/error": 2,
    },
  },
} as const;

test("known transition findings stay non-blocking within their exact budget", () => {
  const unexpected = findUnexpectedFindings(
    [
      { filePath: "existing.ts", severity: 1, ruleId: "example/warning" },
      { filePath: "existing.ts", severity: 2, ruleId: "example/error" },
      { filePath: "existing.ts", severity: 2, ruleId: "example/error" },
    ],
    baseline,
  );

  assert.deepEqual(unexpected, []);
});

test("an additional finding in an existing file is blocking", () => {
  const findings = [
    { filePath: "existing.ts", severity: 1, ruleId: "example/warning" },
    { filePath: "existing.ts", severity: 1, ruleId: "example/warning" },
  ] as const;

  assert.deepEqual(findUnexpectedFindings(findings, baseline), [findings[1]]);
});

test("every finding in a new file is blocking", () => {
  const finding = {
    filePath: "new-ci-package-file.ts",
    severity: 1,
    ruleId: "example/warning",
  } as const;

  assert.deepEqual(findUnexpectedFindings([finding], baseline), [finding]);
});

test("a new rule or higher severity cannot reuse another budget", () => {
  const findings = [
    { filePath: "existing.ts", severity: 1, ruleId: "different/warning" },
    { filePath: "existing.ts", severity: 2, ruleId: "example/warning" },
  ] as const;

  assert.deepEqual(findUnexpectedFindings(findings, baseline), findings);
});
