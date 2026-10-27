import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { generateCard } from "../core/cards";
import { cardSearch, decodeCard, exportRange, pageNumber, parseCommand } from "./policy";
import { asset, canonical, parsePrintSnapshot, sha256 } from "./printSnapshot";
const base = { gameId: randomUUID(), expectedSeriesId: 1, revision: 0 };
test("commands reject forged scope, extra fields, invalid integers and invalid card strategies", () => {
  assert.equal(parseCommand({ ...base, operation: "createRound" }).operation, "createRound");
  const valid = { ...base, operation: "saveRound", roundId: randomUUID(), label: " Runde 1 ", target: 30, strategy: "NEW", issued: null };
  assert.equal((parseCommand(valid) as { label: string }).label, "Runde 1");
  for (const change of [{ gameId: "../../quiz/1" }, { expectedSeriesId: 0 }, { revision: -1 }, { revision: 0.1 }, { target: 0 }, { target: 76 }, { target: "30" }, { strategy: "LIVE" }, { label: " " }, { issued: -1 }, { issued: 1.5 }, { secret: "forbidden" }]) assert.throws(() => parseCommand({ ...valid, ...change }));
  for (const count of [0, 501, 1.5, "100"]) assert.throws(() => parseCommand({ ...base, operation: "generate", roundId: randomUUID(), requestId: randomUUID(), count }));
  for (const count of [1, 100, 500]) assert.equal((parseCommand({ ...base, operation: "generate", roundId: randomUUID(), requestId: randomUUID(), count }) as { count: number }).count, count);
});
test("range packages cover every card exactly once and reject silent truncation", () => {
  const ordinals = [];
  for (const [a, b] of [[1, 200], [201, 400], [401, 500]]) { const r = exportRange(String(a), String(b), 500); for (let i = r.from; i <= r.to; i++) ordinals.push(i); }
  assert.deepEqual(ordinals, Array.from({ length: 500 }, (_, i) => i + 1));
  for (const [a, b] of [["1", "201"], ["0", "20"], ["2", "1"], ["1", "501"], ["1.5", "2"]]) assert.throws(() => exportRange(a, b, 500));
  assert.equal(pageNumber(undefined), 1); assert.throws(() => pageNumber("-1")); assert.throws(() => cardSearch("<script>"));
});
test("persisted cards use AP1 validation and stable canonical hashes", () => {
  const card = generateCard("card", () => 0.5);
  assert.deepEqual(decodeCard(JSON.parse(JSON.stringify(card.cells))), card.cells);
  const bad = card.cells.map(r => [...r]); bad[2][2] = 38;
  assert.throws(() => decodeCard(bad));
  assert.equal(canonical({ b: 1, a: [2, 3] }), '{"a":[2,3],"b":1}');
  assert.equal(sha256(canonical({ b: 1, a: 2 })), sha256(canonical({ a: 2, b: 1 })));
  const bytes = Buffer.alloc(1_000_000, 1); const embedded = asset("font", bytes);
  assert.equal(embedded.sha256, sha256(bytes));
  assert.throws(() => parsePrintSnapshot({ version: 1, display: embedded, unexpected: "secret" }));
});
