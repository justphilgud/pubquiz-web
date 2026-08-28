import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("content creation menu exposes exactly the three canonical content routes", () => {
  const source = readFileSync(new URL("./ContentCreateMenu.tsx", import.meta.url), "utf8");
  const routes = [...source.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(routes, ["/content/questions/new", "/content/story-elements/new", "/content/polls/new"]);
  assert.match(source, /<summary/);
});
