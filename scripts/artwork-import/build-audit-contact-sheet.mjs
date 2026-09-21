import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const catalogue = JSON.parse(await readFile(new URL("../../data/artworks/artwork-canon-200.json", import.meta.url), "utf8")).works;
const newWorks = catalogue.filter((work) => work.status === "neu");
const randomSample = newWorks
  .map((work) => ({ work, hash: createHash("sha256").update(`artwork-canon-audit-v1:${work.wikidataId}`).digest("hex") }))
  .sort((left, right) => left.hash.localeCompare(right.hash))
  .slice(0, 25)
  .map(({ work }) => work);
const grouped = Object.groupBy(catalogue, (work) => work.artist.wikidataId);
const limitCases = Object.values(grouped).filter((works) => works.length === 5).flat();
const works = [...new Map([...randomSample, ...limitCases].map((work) => [work.wikidataId, work])).values()];

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const tiles = [];
async function fetchImage(url, attempt = 1) {
  const response = await fetch(url, { headers: { "user-agent": "PubQuiz artwork canon visual audit/1.0 (https://github.com/justphilgud/pubquiz-web)" } });
  if ((response.status === 429 || response.status >= 500) && attempt < 7) {
    await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    return fetchImage(url, attempt + 1);
  }
  return response;
}
for (const work of works) {
  const response = await fetchImage(work.importMedia?.sourceUrl ?? work.commons.originalUrl);
  if (!response.ok) throw new Error(`${work.wikidataId}: ${response.status}`);
  const image = Buffer.from(await response.arrayBuffer());
  const visual = await sharp(image).resize({ width: 360, height: 240, fit: "contain", background: "#e2e8f0" }).jpeg({ quality: 82 }).toBuffer();
  const label = Buffer.from(`<svg width="360" height="70" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="70" fill="#0f172a"/><text x="12" y="24" font-family="Arial" font-size="14" font-weight="700" fill="white">${escapeXml(work.artist.name.slice(0, 38))}</text><text x="12" y="48" font-family="Arial" font-size="13" fill="#cbd5e1">${escapeXml(work.title.slice(0, 48))}</text><text x="348" y="64" text-anchor="end" font-family="Arial" font-size="10" fill="#94a3b8">${work.wikidataId}</text></svg>`);
  tiles.push(await sharp({ create: { width: 360, height: 310, channels: 3, background: "#ffffff" } }).composite([{ input: visual, top: 0, left: 0 }, { input: label, top: 240, left: 0 }]).jpeg({ quality: 88 }).toBuffer());
  await new Promise((resolve) => setTimeout(resolve, 300));
}
const outputs = [];
for (let page = 0; page * 25 < tiles.length; page += 1) {
  const pageTiles = tiles.slice(page * 25, (page + 1) * 25);
  const output = join(tmpdir(), `artwork-canon-audit-contact-sheet-${page + 1}.jpg`);
  await sharp({ create: { width: 1800, height: 1550, channels: 3, background: "#ffffff" } })
    .composite(pageTiles.map((input, index) => ({ input, left: (index % 5) * 360, top: Math.floor(index / 5) * 310 })))
    .jpeg({ quality: 88 })
    .toFile(output);
  outputs.push(output);
}
await writeFile(new URL("../../data/artworks/artwork-audit-sample-ids.json", import.meta.url), `${JSON.stringify(randomSample.map((work) => work.wikidataId), null, 2)}\n`, "utf8");
console.log(JSON.stringify({ auditedWorks: works.length, outputs }, null, 2));
