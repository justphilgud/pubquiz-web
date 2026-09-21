import { readFile, writeFile } from "node:fs/promises";
import { buildCatalogue, validateCatalogue } from "./catalogue-policy.mjs";

const enriched = JSON.parse(await readFile(new URL("../../data/artworks/wikidata-candidate-pool.enriched.json", import.meta.url), "utf8"));
const mediaValidation = JSON.parse(await readFile(new URL("../../data/artworks/artwork-media-validation.json", import.meta.url), "utf8"));
const mediaByQid = new Map(mediaValidation.works.map((entry) => [entry.wikidataId, entry]));
const { pool, catalogue: selectedCatalogue } = buildCatalogue(enriched);
const catalogue = selectedCatalogue.map((work) => work.status === "neu"
  ? { ...work, importMedia: mediaByQid.get(work.wikidataId) }
  : work);
const missingMedia = catalogue.filter((work) => work.status === "neu" && !work.importMedia);
if (missingMedia.length) throw new Error(`Validated media missing for: ${missingMedia.map((work) => work.wikidataId).join(", ")}`);
const validation = validateCatalogue(catalogue);
if (validation.errors.length) throw new Error(validation.errors.join("\n"));

const common = {
  schemaVersion: 1,
  questionText: "Von welchem Künstler stammt dieses Kunstwerk und wie heißt es?",
  generatedFrom: {
    wikidataSnapshot: "2026-09-21",
    selectionMethod: "Wikipedia-Sitelinkabdeckung, kuratierte Kanonergänzungen, Rechte-/Qualitätsfilter und Künstlerlimit",
  },
};
await writeFile(new URL("../../data/artworks/artwork-candidate-pool-300.json", import.meta.url), `${JSON.stringify({ ...common, works: pool }, null, 2)}\n`, "utf8");
await writeFile(new URL("../../data/artworks/artwork-canon-200.json", import.meta.url), `${JSON.stringify({ ...common, works: catalogue }, null, 2)}\n`, "utf8");

const header = "| Nr. | Status | Künstler | Titel | Jahr | Museum/Sammlung | Wikidata | Bildquelle | Lizenz |\n|---:|---|---|---|---|---|---|---|---|";
const lines = catalogue.map((work) =>
  `| ${work.catalogueNumber} | ${work.status} | ${work.artist.name.replaceAll("|", "\\|")} | ${work.title.replaceAll("|", "\\|")} | ${work.yearLabel} | ${work.collection.name.replaceAll("|", "\\|")} | [${work.wikidataId}](${work.wikidataUrl}) | [Commons](${work.commons.pageUrl}) | ${work.commons.license} |`,
);
await writeFile(new URL("../../docs/reports/artwork-canon-200-provenance.md", import.meta.url), [
  "# Kunstwerk-Kanon 200 – Provenance",
  "",
  "Version: 1 (Recherche-Snapshot 2026-09-21)",
  "",
  "Die Mona Lisa ist als `bereits vorhanden` markiert. Alle übrigen Einträge sind der deterministische Nonprod-Importbestand.",
  "",
  header,
  ...lines,
  "",
].join("\n"), "utf8");

const fiveArtists = [...validation.artistCounts.entries()].filter(([, count]) => count === 5).map(([id]) => catalogue.find((work) => work.artist.wikidataId === id).artist.name);
console.log(JSON.stringify({
  candidates: pool.length,
  catalogue: catalogue.length,
  existing: catalogue.filter((work) => work.status === "bereits vorhanden").length,
  newWorks: catalogue.filter((work) => work.status === "neu").length,
  artists: validation.artistCounts.size,
  maxPerArtist: Math.max(...validation.artistCounts.values()),
  artistsWithFive: fiveArtists,
  licenses: Object.entries(Object.groupBy(catalogue, (work) => work.commons.license)).map(([key, values]) => [key, values.length]),
}, null, 2));
