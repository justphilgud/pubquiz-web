import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const catalogueUrl = new URL("../../data/artworks/artwork-canon-200.json", import.meta.url);
const validationUrl = new URL("../../data/artworks/artwork-media-validation.json", import.meta.url);
const catalogue = JSON.parse(await readFile(catalogueUrl, "utf8"));
const imports = catalogue.works.filter((work) => work.status === "neu");
const USER_AGENT = "PubQuiz artwork canon media validation/1.0 (https://github.com/justphilgud/pubquiz-web)";

function chunks(values, size) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));
}

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": USER_AGENT } });
  if ((response.status === 429 || response.status >= 500) && attempt < 6) {
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
    return fetchJson(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

const mediaByTitle = new Map();
for (const batch of chunks(imports.map((work) => work.commons.pageTitle), 20)) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    redirects: "1",
    prop: "imageinfo",
    iiprop: "url|size|mime|sha1",
    iiurlwidth: "2560",
    titles: batch.join("|"),
  });
  const payload = await fetchJson(url);
  for (const page of Object.values(payload.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (!page.missing && info?.thumburl) mediaByTitle.set(page.title, info);
  }
  for (const normalized of payload.query?.normalized ?? []) {
    const info = mediaByTitle.get(normalized.to);
    if (info) mediaByTitle.set(normalized.from, info);
  }
  for (const redirect of payload.query?.redirects ?? []) {
    const info = mediaByTitle.get(redirect.to);
    if (info) mediaByTitle.set(redirect.from, info);
  }
}

async function prepare(work, index) {
  const info = mediaByTitle.get(work.commons.pageTitle);
  if (!info) throw new Error(`${work.wikidataId}: no 2560 px Commons rendition`);
  const response = await fetch(info.thumburl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${work.wikidataId}: ${response.status} while downloading image`);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) throw new Error(`${work.wikidataId}: invalid content type ${contentType}`);
  const source = Buffer.from(await response.arrayBuffer());
  if (source.length < 10_000 || source.length > 20 * 1024 * 1024) throw new Error(`${work.wikidataId}: implausible download size ${source.length}`);
  const sourceMetadata = await sharp(source, { failOn: "warning" }).metadata();
  if (!sourceMetadata.width || !sourceMetadata.height) throw new Error(`${work.wikidataId}: image dimensions missing`);
  const normalized = await sharp(source, { failOn: "warning" })
    .rotate()
    .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, effort: 4, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
  if (normalized.data.length > 10 * 1024 * 1024) throw new Error(`${work.wikidataId}: normalized image exceeds 10 MB`);
  if ((index + 1) % 10 === 0 || index + 1 === imports.length) console.log(`validated ${index + 1}/${imports.length}`);
  return {
    wikidataId: work.wikidataId,
    sourceUrl: info.thumburl,
    sourceMime: contentType,
    sourceBytes: source.length,
    sourceWidth: sourceMetadata.width,
    sourceHeight: sourceMetadata.height,
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    outputMime: "image/webp",
    outputBytes: normalized.data.length,
    outputWidth: normalized.info.width,
    outputHeight: normalized.info.height,
    outputSha256: createHash("sha256").update(normalized.data).digest("hex"),
  };
}

const validation = [];
for (const batch of chunks(imports, 4)) {
  validation.push(...await Promise.all(batch.map((work, offset) => prepare(work, validation.length + offset))));
}
const validationById = new Map(validation.map((entry) => [entry.wikidataId, entry]));
catalogue.works = catalogue.works.map((work) => work.status === "neu"
  ? { ...work, importMedia: validationById.get(work.wikidataId) }
  : work);
await writeFile(catalogueUrl, `${JSON.stringify(catalogue, null, 2)}\n`, "utf8");
await writeFile(validationUrl, `${JSON.stringify({ schemaVersion: 1, works: validation }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  validated: validation.length,
  sourceBytes: validation.reduce((sum, entry) => sum + entry.sourceBytes, 0),
  normalizedBytes: validation.reduce((sum, entry) => sum + entry.outputBytes, 0),
  minResolution: validation.reduce((current, entry) => entry.outputWidth * entry.outputHeight < current.outputWidth * current.outputHeight ? entry : current),
  maxResolution: validation.reduce((current, entry) => entry.outputWidth * entry.outputHeight > current.outputWidth * current.outputHeight ? entry : current),
}, null, 2));
