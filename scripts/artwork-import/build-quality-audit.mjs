import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const catalogue = JSON.parse(await readFile(new URL("../../data/artworks/artwork-canon-200.json", import.meta.url), "utf8")).works;
const validation = JSON.parse(await readFile(new URL("../../data/artworks/artwork-media-validation.json", import.meta.url), "utf8")).works;
const validationById = new Map(validation.map((entry) => [entry.wikidataId, entry]));
const newWorks = catalogue.filter((work) => work.status === "neu");
const randomSample = newWorks
  .map((work) => ({ work, hash: createHash("sha256").update(`artwork-canon-audit-v1:${work.wikidataId}`).digest("hex") }))
  .sort((left, right) => left.hash.localeCompare(right.hash))
  .slice(0, 25)
  .map(({ work }) => work);
const grouped = Object.groupBy(catalogue, (work) => work.artist.wikidataId);
const fiveWorkArtists = Object.values(grouped).filter((works) => works.length === 5).sort((left, right) => left[0].artist.name.localeCompare(right[0].artist.name, "de"));

function row(work) {
  const media = validationById.get(work.wikidataId);
  return `| ${work.artist.name.replaceAll("|", "\\|")} | ${work.title.replaceAll("|", "\\|")} | [${work.wikidataId}](${work.wikidataUrl}) | [Commons](${work.commons.pageUrl}) | ${work.collection.name.replaceAll("|", "\\|")} | ${work.commons.license} | ${media ? `${media.outputWidth}×${media.outputHeight}; SHA-256 ${media.outputSha256}` : "bestehendes Medium"} |`;
}

const lines = [
  "# Kunstwerk-Kanon 200 – Qualitätsstichprobe",
  "",
  "Version: 1 (deterministischer Seed `artwork-canon-audit-v1`)",
  "",
  "Die 25er-Stichprobe wird durch SHA-256-Sortierung der Wikidata-IDs bestimmt und ist dadurch reproduzierbar. Zusätzlich sind alle Künstler mit exakt fünf Werken vollständig aufgeführt.",
  "",
  "## Zufallsstichprobe (25 neue Werke)",
  "",
  "| Künstler | Titel | Wikidata | Bildquelle | Museum/Sammlung | Lizenz | normalisiertes Medium |",
  "|---|---|---|---|---|---|---|",
  ...randomSample.map(row),
  "",
  "## Sämtliche 5-Werke-Grenzfälle",
  "",
  ...fiveWorkArtists.flatMap((works) => [
    `### ${works[0].artist.name}`,
    "",
    "| Künstler | Titel | Wikidata | Bildquelle | Museum/Sammlung | Lizenz | normalisiertes Medium |",
    "|---|---|---|---|---|---|---|",
    ...works.map(row),
    "",
  ]),
  "## Automatische Prüfschritte",
  "",
  "- Künstler- und Werkidentität: Wikidata-QID und normalisierte Künstler-QID",
  "- konkrete Reproduktion: Wikimedia-Commons-Dateiseite",
  "- kommerzielle Nutzbarkeit: ausschließlich Public Domain oder CC0",
  "- Quelle: HTTP-Erfolg, Bild-MIME, Dekodierung, Abmessungen und SHA-256",
  "- Importformat: WebP, maximal 2.560 × 2.560 Pixel, maximal 10 MB",
  "- Import-Readback: im Preview-Import nochmals vollständig geprüft",
  "",
].join("\n");

await writeFile(new URL("../../docs/reports/artwork-canon-quality-audit.md", import.meta.url), lines, "utf8");
console.log(JSON.stringify({ randomSample: randomSample.length, fiveWorkArtists: fiveWorkArtists.map((works) => works[0].artist.name), auditedWorks: new Set([...randomSample, ...fiveWorkArtists.flat()]).size }, null, 2));
