import assert from "node:assert/strict";
import test from "node:test";
import { CANDIDATE_POOL_SIZE, CATALOGUE_SIZE, MAX_WORKS_PER_ARTIST, buildCatalogue, validateCatalogue } from "./catalogue-policy.mjs";
import { readFile } from "node:fs/promises";

const enriched = JSON.parse(await readFile(new URL("../../data/artworks/wikidata-candidate-pool.enriched.json", import.meta.url), "utf8"));

test("builds the exact candidate pool and final catalogue", () => {
  const { pool, catalogue } = buildCatalogue(enriched);
  assert.equal(pool.length, CANDIDATE_POOL_SIZE);
  assert.equal(catalogue.length, CATALOGUE_SIZE);
  assert.equal(catalogue.filter((work) => work.status === "bereits vorhanden").length, 1);
  assert.equal(catalogue.filter((work) => work.status === "neu").length, 199);
  assert.equal(validateCatalogue(catalogue).errors.length, 0);
});

test("enforces the artist maximum and unique artwork identities", () => {
  const { catalogue } = buildCatalogue(enriched);
  const counts = [...validateCatalogue(catalogue).artistCounts.values()];
  assert.ok(Math.max(...counts) <= MAX_WORKS_PER_ARTIST);
  assert.equal(new Set(catalogue.map((work) => work.wikidataId)).size, CATALOGUE_SIZE);
  assert.ok(catalogue.every((work) => work.artist.name && work.title && work.commons.pageUrl && work.commons.license));
});
