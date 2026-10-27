import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCard, generateCard, LINE_IDS, validateCard, type CardLayout } from "./cards";

const card = generateCard("card", () => 0);
const mutable = () => card.cells.map(row => [...row]);

test("deterministic generation, independent identity and all 75-column constraints", () => {
  assert.deepEqual(generateCard("card", () => 0), card);
  assert.deepEqual(generateCard("other", () => 0).cells, card.cells);
  for (let seed = 1; seed <= 100; seed++) {
    let state = seed;
    const generated = generateCard(String(seed), () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32));
    validateCard(generated.cells);
    assert.equal(generated.cells.flat().filter(n => n !== null).length, 24);
  }
  for (const sample of [-1, 1, NaN, Infinity]) assert.throws(() => generateCard("x", () => sample), /INVALID_RANDOM/);
  assert.throws(() => generateCard("", () => 0), /ID_REQUIRED/);
});

test("complete validation rejects dimensions, sparse cells, values, ranges, duplicates and free fields", () => {
  validateCard(card.cells);
  for (const value of [null, [], card.cells.slice(1), [...card.cells, card.cells[0]], [[], ...card.cells.slice(1)], Array(5)]) assert.throws(() => validateCard(value));
  for (const value of [null, undefined, "1", 0, -1, 76, 1.5, NaN, Infinity, 16]) {
    const cells: unknown[][] = mutable(); cells[0][0] = value;
    assert.throws(() => validateCard(cells));
  }
  const duplicate = mutable(); duplicate[1][0] = duplicate[0][0];
  assert.throws(() => validateCard(duplicate), /DUPLICATE/);
  const center = mutable(); center[2][2] = 33;
  assert.throws(() => validateCard(center), /FREE_CENTER/);
});

function valuesForLine(index: number): number[] {
  const positions = Array.from({ length: 5 }, (_, i) => index < 5 ? [index, i] : index < 10 ? [i, index - 5] : [i, index === 10 ? i : 4 - i]);
  return positions.map(([r, c]) => card.cells[r][c]).filter((n): n is number => n !== null);
}

test("each of the twelve lines is individually identifiable, with free center marked", () => {
  for (let i = 0; i < LINE_IDS.length; i++) {
    assert.deepEqual(evaluateCard(card.cells, valuesForLine(i)), { lines: [LINE_IDS[i]], stages: ["BINGO"] });
  }
});

test("overlapping lines count independently; stages belong to one card", () => {
  const two = [...new Set([...valuesForLine(0), ...valuesForLine(5)])];
  assert.deepEqual(evaluateCard(card.cells, two).stages, ["BINGO", "DOUBLE"]);
  const three = [...new Set([...two, ...valuesForLine(10)])];
  assert.deepEqual(evaluateCard(card.cells, three).stages, ["BINGO", "DOUBLE", "TRIPLE"]);
  const other = generateCard("other", () => 0.99);
  assert.deepEqual(evaluateCard(other.cells, three).stages, []);
  assert.deepEqual(evaluateCard(card.cells, valuesForLine(0)).stages, ["BINGO"]);
});

test("empty/full draw sets, invalid draws and immutable frozen inputs", () => {
  const frozen: CardLayout = Object.freeze(card.cells.map(row => Object.freeze([...row])));
  assert.deepEqual(evaluateCard(frozen, Object.freeze([])), { lines: [], stages: [] });
  assert.equal(evaluateCard(frozen, Array.from({ length: 75 }, (_, i) => i + 1)).lines.length, 12);
  for (const numbers of [[1, 1], [0], [76], [NaN], [1.1]]) assert.throws(() => evaluateCard(frozen, numbers));
  assert.deepEqual(frozen, card.cells);
});
