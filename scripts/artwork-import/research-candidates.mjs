import { writeFile } from "node:fs/promises";

const endpoint = "https://qlever.dev/api/wikidata";
const query = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX schema: <http://schema.org/>
SELECT ?item ?creator ?image (COUNT(?article) AS ?sitelinks) WHERE {
  VALUES ?type { wd:Q3305213 wd:Q134194 wd:Q11060274 }
  ?item wdt:P31 ?type;
        wdt:P170 ?creator;
        wdt:P18 ?image.
  ?article schema:about ?item;
           schema:isPartOf ?wiki.
  FILTER(CONTAINS(STR(?wiki), "wikipedia.org"))
}
GROUP BY ?item ?creator ?image
ORDER BY DESC(?sitelinks)
LIMIT 700
`;

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    accept: "application/sparql-results+json",
    "content-type": "application/x-www-form-urlencoded",
    "user-agent": "PubQuiz artwork canon research/1.0 (https://github.com/justphilgud/pubquiz-web)",
  },
  body: new URLSearchParams({ query }),
});

if (!response.ok) {
  throw new Error(`WDQS ${response.status}: ${await response.text()}`);
}

const payload = await response.json();
const rows = payload.results.bindings.map((binding) => ({
  wikidataId: binding.item.value.split("/").pop(),
  artistId: binding.creator.value.split("/").pop(),
  imageSource: binding.image.value,
  sitelinks: Number(binding.sitelinks.value),
}));

await writeFile(
  new URL("../../data/artworks/wikidata-candidate-pool.raw.json", import.meta.url),
  `${JSON.stringify(rows, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify({ candidates: rows.length, top: rows.slice(0, 10) }, null, 2));
