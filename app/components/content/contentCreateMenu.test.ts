import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("content creation exposes three direct canonical actions without a dropdown", () => {
  const source = readFileSync(new URL("./ContentCreateActions.tsx", import.meta.url), "utf8");
  const routes = [...source.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(routes, ["/content/questions/new", "/content/story-elements/new", "/content/polls/new"]);
  assert.doesNotMatch(source, /<summary|<details|\+ Neu/);
  assert.match(source, /\+ Frage/);
  assert.match(source, /\+ Story-Element/);
  assert.match(source, /\+ Umfrage/);
});
