import assert from "node:assert/strict";
import test from "node:test";

import {
  runProductionWriterPhase,
  safeProductionWriterFailure,
} from "./productionWriterDiagnostics";

test("reports only whitelisted writer phase metadata", async () => {
  const databaseError = Object.assign(new Error("secret database detail"), {
    code: "42501",
    table: "external_question_import_batches",
    detail: "must never be logged",
  });
  const error = await runProductionWriterPhase("AUDIT", {
    operation: "insert",
    candidateId: "2",
    relation: "external_question_import_batches",
  }, () => Promise.reject(databaseError)).catch((value: unknown) => value);

  assert.equal(
    safeProductionWriterFailure(error),
    "EXTERNAL_IMPORT_WRITE_PHASE_FAILURE|phase=AUDIT|candidate=2|operation=insert|" +
      "relation=external_question_import_batches|sqlstate=42501|cause=WITHHELD",
  );
});

test("withholds unapproved relation, candidate and error text", async () => {
  const databaseError = Object.assign(new Error("password=npg_secret"), {
    code: "not-a-sqlstate",
    table: "private_table",
  });
  const error = await runProductionWriterPhase("DB_CONNECTION", {
    operation: "read",
    candidateId: "unsafe candidate value",
    relation: "private_table",
  }, () => Promise.reject(databaseError)).catch((value: unknown) => value);
  const output = safeProductionWriterFailure(error);

  assert.equal(
    output,
    "EXTERNAL_IMPORT_WRITE_PHASE_FAILURE|phase=DB_CONNECTION|candidate=none|operation=read|" +
      "relation=none|sqlstate=none|cause=WITHHELD",
  );
  assert.doesNotMatch(output, /secret|password|private_table/);
});

test("preserves an approved external-import error code without its stack", async () => {
  const error = await runProductionWriterPhase("AUTHORIZATION", {
    operation: "verify",
  }, () => {
    throw new Error("EXTERNAL_IMPORT_REVIEWER_APPROVAL_MISSING");
  }).catch((value: unknown) => value);

  assert.equal(
    safeProductionWriterFailure(error),
    "EXTERNAL_IMPORT_WRITE_PHASE_FAILURE|phase=AUTHORIZATION|candidate=none|operation=verify|" +
      "relation=none|sqlstate=none|cause=EXTERNAL_IMPORT_REVIEWER_APPROVAL_MISSING",
  );
});

test("keeps the most specific nested phase", async () => {
  const error = await runProductionWriterPhase("COMMIT", {
    operation: "commit",
    candidateId: "2",
  }, () => runProductionWriterPhase("QUESTION_CREATE", {
    operation: "insert",
    candidateId: "2",
    relation: "fragen",
  }, () => Promise.reject(Object.assign(new Error("hidden"), { code: "23514" }))))
    .catch((value: unknown) => value);

  assert.match(
    safeProductionWriterFailure(error),
    /^EXTERNAL_IMPORT_WRITE_PHASE_FAILURE\|phase=QUESTION_CREATE\|candidate=2\|/,
  );
});

test("maps nested question writes to answer and category phases", async () => {
  for (const [table, phase] of [
    ["antworten", "ANSWERS"],
    ["fragen_kategorien", "CATEGORIES"],
  ] as const) {
    const error = await runProductionWriterPhase("QUESTION_CREATE", {
      operation: "insert",
      candidateId: "4",
      relation: "fragen",
    }, () => Promise.reject(Object.assign(new Error("hidden"), {
      code: "42501",
      table,
    }))).catch((value: unknown) => value);
    assert.match(safeProductionWriterFailure(error), new RegExp(`phase=${phase}\\|`));
  }
});

test("retains the generic fail-closed output for unknown top-level failures", () => {
  assert.equal(
    safeProductionWriterFailure(new Error("password=npg_secret")),
    "EXTERNAL_IMPORT_WRITE_FAILED_DETAILS_WITHHELD",
  );
});

test("passes through only a fully validated structured item failure", () => {
  const safe =
    "EXTERNAL_IMPORT_WRITE_PHASE_FAILURE|phase=QUESTION_CREATE|candidate=2|" +
    "operation=insert|relation=fragen|sqlstate=42501|cause=WITHHELD";
  assert.equal(safeProductionWriterFailure(new Error(safe)), safe);
  assert.equal(
    safeProductionWriterFailure(new Error(`${safe}|password=npg_secret`)),
    "EXTERNAL_IMPORT_WRITE_FAILED_DETAILS_WITHHELD",
  );
});
