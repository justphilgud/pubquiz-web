import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

test("actual PDF route excludes generation and source-asset IO from its application import graph", async () => {
  const bundle = await build({ entryPoints: ["app/bingo/[gameId]/karten/[seriesId]/pdf/route.ts"], bundle: true, write: false, metafile: true, platform: "node", format: "esm", packages: "external", plugins: [{ name: "boundary-only", setup(b) {
    b.onResolve({ filter: /^(server-only|@\/app\/lib\/prisma|@\/app\/lib\/permissions)$/ }, a => ({ path: a.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({ contents: a.path === "server-only" ? "" : a.path.endsWith("permissions") ? "export async function requireActor(){throw Error('Not executed in boundary test')}" : "export const prisma={}" }));
  } }] });
  const inputs = Object.keys(bundle.metafile.inputs).map(p => p.replaceAll("\\", "/"));
  assert.ok(inputs.includes("app/bingo/preparation/readExport.server.ts"));
  assert.ok(inputs.includes("app/bingo/preparation/access.server.ts"), "shared fresh authorization remains part of the export");
  assert.ok(!inputs.some(p => p.endsWith("/bingo/preparation/repository.server.ts") || p.endsWith("/printAssets.server.ts")), "exports read frozen bytes rather than packaging the generation asset loader");
  assert.ok(!Object.values(bundle.metafile.outputs).flatMap(o => o.imports).some(i => i.path === "sharp"), "PDF export must not pull in the image-ingestion runtime");
});
