import assert from "node:assert/strict";
import test from "node:test";
import { questionStatusUpdate, shouldChangeOnlyQuestionStatus } from "./questionStatus";
import { parseQuestionTemplateData } from "./templates/questionTemplateData";
import { questionTemplateIds } from "./templates/questionTemplateRegistry";
import type { QuestionScopeAccessContext } from "./questionScopePolicy";

const admin = { userId: 1, assignments: [{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }] };
const context: QuestionScopeAccessContext = { scope: "GLOBAL", eventSeriesIds: [], createdByUserId: 1,
  reviewStatus: "DRAFT", isArchived: false, isApproved: false };

test("unchanged existing approval uses stored content; new/dirty drafts remain explicit saves", () => {
  for (const status of ["DRAFT","IN_REVIEW","CHANGES_REQUESTED"]) assert.equal(shouldChangeOnlyQuestionStatus(154,false,status),true);
  assert.equal(shouldChangeOnlyQuestionStatus(154,true,"DRAFT"),false);
  assert.equal(shouldChangeOnlyQuestionStatus(undefined,false,undefined),false);
  assert.equal(shouldChangeOnlyQuestionStatus(154,false,"APPROVED"),false);
});

test("status transitions preserve content, sources, units, variants and relation identities", () => {
  for (const template of ["anagramm", "schaetzfrage", "fakten_frei", "multiple_choice", "face_morph", "pixel"] ) {
    const original = { frage: "Exact text", quelle: " https://example.invalid/source\nSecond source ",
      template, template_config_json: { templateData: { selectedSolution: "Old West Action", unit: "Meter", correctValue: 8848.86 } },
      answers: [{ id: 5, text: "Clint Eastwood", variants: ["C. Eastwood"], media: { id: 9, url: "nonprod/image.png" } }],
      categories: [8], assignments: [316], submittedAnswers: ["Clint Eastwood"], evaluations: [{ manual: 1 }], ist_unfertig: false };
    const approved = { ...original, ...questionStatusUpdate(admin, context, "APPROVED") };
    const draft = { ...approved, ...questionStatusUpdate(admin, { ...context, reviewStatus: "APPROVED", isApproved: true }, "DRAFT") };
    for (const key of Object.keys(original)) assert.deepEqual(draft[key as keyof typeof original], original[key as keyof typeof original]);
    assert.equal(draft.review_status, "DRAFT"); assert.equal(draft.freigegeben, false);
    assert.equal(draft.approved_at, null); assert.equal(draft.reviewed_at, null);
  }
});

test("anagram loading preserves original spelling and suggestions without mutating input", () => {
  const original = { kind: "ANAGRAM", name: "Clint Eastwood", selectedSolution: "Old West Action",
    suggestions: ["Old West Action"], wordCountPreference: "3" };
  const saved = structuredClone(original);
  assert.deepEqual(parseQuestionTemplateData(original, questionTemplateIds.anagram, true), original);
  assert.deepEqual(original, saved);
});

test("status policy rejects denied scope, archived, invalid targets and invalid transitions", () => {
  const editor = { userId: 1, assignments: [{ role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null }] };
  assert.throws(() => questionStatusUpdate(editor, context, "APPROVED"), /PERMISSION_DENIED/);
  assert.throws(() => questionStatusUpdate(admin, { ...context, isArchived: true }, "APPROVED"), /PERMISSION_DENIED/);
  assert.throws(() => questionStatusUpdate(admin, context, "DRAFT"), /CONFLICT/);
  assert.throws(() => questionStatusUpdate(admin, context, "ARCHIVED" as "DRAFT"), /INVALID/);
  const reviewer = { userId: 2, assignments: [{ role: "EVENT_MANAGER", scopeType: "EVENT_SERIES", eventSeriesId: 4 }] };
  assert.throws(() => questionStatusUpdate(reviewer, { ...context, scope: "EVENT_SERIES", eventSeriesIds: [5] }, "APPROVED"), /PERMISSION_DENIED/);
  assert.equal(questionStatusUpdate(reviewer, { ...context, scope: "EVENT_SERIES", eventSeriesIds: [4] }, "APPROVED").freigegeben, true);
});
