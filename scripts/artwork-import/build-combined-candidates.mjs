import { readFile, writeFile } from "node:fs/promises";

const raw = JSON.parse(await readFile(new URL("../../data/artworks/wikidata-candidate-pool.raw.json", import.meta.url), "utf8"));
const curated = JSON.parse(await readFile(new URL("../../data/artworks/canonical-additions.resolved.json", import.meta.url), "utf8"));
const ids = curated.map((entry) => entry.selected?.id).filter(Boolean);
const endpoint = "https://www.wikidata.org/w/api.php";
const entities = {};

for (let index = 0; index < ids.length; index += 50) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    origin: "*",
    ids: ids.slice(index, index + 50).join("|"),
    props: "claims|sitelinks",
  });
  const response = await fetch(url, {
    headers: { "user-agent": "PubQuiz artwork canon research/1.0 (https://github.com/justphilgud/pubquiz-web)" },
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  Object.assign(entities, (await response.json()).entities);
}

function claimValue(entity, property) {
  return entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value ?? null;
}

const additions = ids.map((id) => {
  const entity = entities[id];
  const image = claimValue(entity, "P18");
  const creator = claimValue(entity, "P170")?.id;
  if (!image || !creator) return null;
  return {
    wikidataId: id,
    artistId: creator,
    imageSource: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(image).replaceAll("%2F", "/")}`,
    sitelinks: Object.keys(entity.sitelinks ?? {}).filter((key) => key.endsWith("wiki")).length,
    curatedAddition: true,
  };
}).filter(Boolean);

const byId = new Map();
for (const candidate of [...raw, ...additions]) {
  const existing = byId.get(candidate.wikidataId);
  if (!existing || candidate.curatedAddition || candidate.sitelinks > existing.sitelinks) {
    byId.set(candidate.wikidataId, candidate);
  }
}
const combined = [...byId.values()].sort((left, right) => right.sitelinks - left.sitelinks);
await writeFile(
  new URL("../../data/artworks/wikidata-candidate-pool.combined.raw.json", import.meta.url),
  `${JSON.stringify(combined, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({ raw: raw.length, additions: additions.length, unique: combined.length }, null, 2));
