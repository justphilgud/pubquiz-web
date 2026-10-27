import assert from "node:assert/strict";
import test from "node:test";
import { generateCard } from "./cards";
import { appendDraw, correctDraw, createRound, currentNumber, decideClaim, evaluateClaim, isConfirmed, recordClaim, setTarget, targetReached, type BingoRound } from "./round";

const card = generateCard("card", () => 0);
const row = card.cells[0].filter((n): n is number => n !== null);
const open = (): BingoRound => ({ ...createRound("round"), status: "OPEN" });
function drawn(numbers: readonly number[]): BingoRound {
  return numbers.reduce((round, n, i) => appendDraw(round, `draw-${i}`, n), open());
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test("draw validation and stable current number including empty/full sets", () => {
  assert.equal(currentNumber(open()), null);
  const full = drawn(Array.from({ length: 75 }, (_, i) => i + 1));
  assert.equal(currentNumber(full), 75);
  assert.throws(() => appendDraw(full, "extra", 1), /DUPLICATE_DRAW_NUMBER/);
  for (const number of [0, 76, 1.5, NaN, Infinity]) assert.throws(() => appendDraw(open(), "x", number));
  assert.throws(() => appendDraw(createRound("r"), "x", 1), /ROUND_NOT_OPEN/);
  assert.throws(() => appendDraw(drawn([1]), "draw-0", 2), /DUPLICATE_DRAW_ID/);
});

test("beginning, middle and last correction preserves identities, positions, input and ordered history", () => {
  const original = freeze(drawn([1, 2, 3]));
  for (const index of [0, 1, 2]) {
    const { round, change } = correctDraw(original, `draw-${index}`, 10, { id: "edit", reason: "Fehleingabe" }, []);
    assert.deepEqual(round.draws.map(d => [d.id, d.position]), original.draws.map(d => [d.id, d.position]));
    assert.equal(round.draws[index].number, 10);
    assert.equal(currentNumber(round), index === 2 ? 10 : 3);
    assert.deepEqual(change, { id: "edit", reason: "Fehleingabe", drawId: `draw-${index}`, position: index + 1, before: index + 1, after: 10 });
    assert.deepEqual(round.corrections, [change]);
  }
  assert.deepEqual(original.draws.map(d => d.number), [1, 2, 3]);
  assert.throws(() => correctDraw(original, "draw-0", 2, { id: "x", reason: "x" }, []), /DUPLICATE/);
  assert.throws(() => correctDraw(original, "absent", 4, { id: "x", reason: "x" }, []), /NOT_FOUND/);
});

test("claim cutoff excludes later draws, but includes corrections within that cutoff", () => {
  let round = recordClaim(drawn(row.slice(0, 4)), "early", card, "BINGO");
  round = appendDraw(round, "later", row[4]);
  assert.deepEqual(evaluateClaim(round, round.claims[0], card).stages, []);
  assert.throws(() => decideClaim(round, "early", card, { id: "d", action: "CONFIRM", reason: "prüfen" }), /NOT_COVERED/);
  // The missing fifth value must replace an earlier unrelated draw, not move the cutoff.
  let correctionCase = recordClaim(drawn([...row.slice(0, 4), 75]), "call", card, "BINGO");
  const before = correctionCase.claims[0].originalEvaluation;
  correctionCase = correctDraw(correctionCase, "draw-4", row[4], { id: "fix", reason: "Fehleingabe" }, []).round;
  assert.deepEqual(evaluateClaim(correctionCase, correctionCase.claims[0], card).stages, ["BINGO"]);
  assert.deepEqual(correctionCase.claims[0].originalEvaluation, before);
});

test("confirmed correction flags review, retains decisions; review/revoke/reconfirm is possible", () => {
  let round = recordClaim(drawn(row), "call", card, "BINGO");
  round = decideClaim(round, "call", card, { id: "confirm", action: "CONFIRM", reason: "Geprüft" });
  const original = freeze(round);
  round = correctDraw(round, "draw-0", 75, { id: "fix", reason: "Fehleingabe" }, [card]).round;
  assert.equal(round.claims[0].needsReview, true);
  assert.equal(isConfirmed(round.claims[0]), true);
  assert.deepEqual(round.claims[0].decisions, original.claims[0].decisions);
  assert.equal(original.claims[0].needsReview, false);
  assert.throws(() => decideClaim(round, "call", card, { id: "reconfirm", action: "CONFIRM", reason: "x" }), /NOT_COVERED/);
  round = decideClaim(round, "call", card, { id: "revoke", action: "REVOKE", reason: "Nicht gedeckt" });
  assert.equal(isConfirmed(round.claims[0]), false);
  round = correctDraw(round, "draw-0", row[0], { id: "fix-back", reason: "Erneut geprüft" }, [card]).round;
  round = decideClaim(round, "call", card, { id: "confirm-again", action: "CONFIRM", reason: "Gedeckt" });
  round = decideClaim(round, "call", card, { id: "review", action: "CONFIRM", reason: "Nachprüfung" });
  assert.equal(round.claims[0].decisions.length, 4);
  assert.equal(isConfirmed(round.claims[0]), true);
  assert.equal(round.claims[0].needsReview, false);
});

test("confirmation uniqueness is card × round × stage, permits multiple winners and later reversal", () => {
  let round = drawn(Array.from({ length: 75 }, (_, i) => i + 1));
  const other = generateCard("other", () => 0.99);
  for (const [id, c, stage] of [["first", card, "BINGO"], ["duplicate", card, "BINGO"], ["double", card, "DOUBLE"], ["other", other, "BINGO"]] as const) round = recordClaim(round, id, c, stage);
  for (const [id, c] of [["first", card], ["double", card], ["other", other]] as const) round = decideClaim(round, id, c, { id: `decision-${id}`, action: "CONFIRM", reason: "ok" });
  assert.throws(() => decideClaim(round, "duplicate", card, { id: "dup", action: "CONFIRM", reason: "ok" }), /ALREADY_CONFIRMED/);
  assert.throws(() => decideClaim(round, "first", card, { id: "reject", action: "REJECT", reason: "x" }), /REVOKE_REQUIRED/);
  round = decideClaim(round, "first", card, { id: "revoke", action: "REVOKE", reason: "Rücknahme" });
  round = decideClaim(round, "duplicate", card, { id: "confirm-duplicate", action: "CONFIRM", reason: "ok" });
  assert.equal(round.claims.filter(isConfirmed).length, 3);
  const nextRound = { ...drawn(row), id: "next" };
  const call = recordClaim(nextRound, "new", card, "BINGO");
  assert.equal(isConfirmed(decideClaim(call, "new", card, { id: "new-decision", action: "CONFIRM", reason: "ok" }).claims[0]), true);
});

test("later correction outside cutoff leaves confirmation unchanged; missing cards fail closed", () => {
  let round = recordClaim(drawn(row), "call", card, "BINGO");
  round = decideClaim(round, "call", card, { id: "yes", action: "CONFIRM", reason: "ok" });
  round = appendDraw(round, "late", 75);
  assert.equal(correctDraw(round, "late", 74, { id: "edit", reason: "x" }, []).round.claims[0].needsReview, false);
  assert.throws(() => correctDraw(round, "draw-0", 74, { id: "edit", reason: "x" }, []), /CLAIM_CARD_REQUIRED/);
  assert.throws(() => evaluateClaim(round, round.claims[0], { ...card, id: "wrong" }), /REFERENCE_MISMATCH/);
});

test("target is a hint only and cannot fall below draw count", () => {
  let round = setTarget(drawn([1, 2]), 2);
  assert.equal(targetReached(round), true);
  assert.equal(round.status, "OPEN");
  round = appendDraw(round, "extra", 3);
  assert.equal(round.draws.length, 3);
  assert.throws(() => setTarget(round, 2), /BELOW_DRAW_COUNT/);
  assert.equal(targetReached(setTarget(round, 40)), false);
  for (const target of [0, 76, 2.5]) assert.throws(() => setTarget(round, target));
});

test("rejection, duplicate audit IDs and sticky review do not overwrite history", () => {
  let round = recordClaim(drawn(row), "call", card, "BINGO");
  round = decideClaim(round, "call", card, { id: "no", action: "REJECT", reason: "Prüfung offen" });
  assert.throws(() => decideClaim(round, "call", card, { id: "no", action: "CONFIRM", reason: "x" }), /DUPLICATE_DECISION_ID/);
  assert.throws(() => decideClaim(round, "call", card, { id: "revoke", action: "REVOKE", reason: "x" }), /NOT_CONFIRMED/);
  round = decideClaim(round, "call", card, { id: "yes", action: "CONFIRM", reason: "ok" });
  round = correctDraw(round, "draw-0", 75, { id: "edit", reason: "x" }, [card]).round;
  assert.throws(() => correctDraw(round, "draw-0", row[0], { id: "edit", reason: "x" }, [card]), /DUPLICATE_CORRECTION/);
  round = correctDraw(round, "draw-0", row[0], { id: "back", reason: "x" }, [card]).round;
  assert.equal(round.claims[0].needsReview, true);
  const reviewed = decideClaim(freeze(round), "call", card, { id: "review", action: "CONFIRM", reason: "Nachprüfung" });
  assert.equal(reviewed.claims[0].needsReview, false);
  assert.equal(round.claims[0].needsReview, true);
  assert.equal(reviewed.claims[0].decisions.length, 3);
  assert.equal(reviewed.corrections.length, 2);
});
