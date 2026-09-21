import { readFile, writeFile } from "node:fs/promises";

const inputUrl = new URL("../../data/artworks/wikidata-candidate-pool.combined.raw.json", import.meta.url);
const outputUrl = new URL("../../data/artworks/wikidata-candidate-pool.enriched.json", import.meta.url);
const raw = JSON.parse(await readFile(inputUrl, "utf8"));

const USER_AGENT = "PubQuiz artwork canon research/1.0 (https://github.com/justphilgud/pubquiz-web)";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const fileTitleOverrides = {
  Q12418: "File:Mona Lisa, by Leonardo da Vinci, from C2RMF.jpg",
  Q10881982: "File:Five Oxen.jpg",
  Q116459640: "File:Songhuizong8.jpg",
};

function chunks(values, size) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );
}

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
  });
  if ((response.status === 429 || response.status >= 500) && attempt < 6) {
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
    return fetchJson(url, attempt + 1);
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${(await response.text()).slice(0, 500)}`);
  }
  return response.json();
}

async function fetchEntities(ids) {
  const entities = {};
  for (const batch of chunks([...new Set(ids)], 50)) {
    const url = new URL(WIKIDATA_API);
    url.search = new URLSearchParams({
      action: "wbgetentities",
      format: "json",
      origin: "*",
      ids: batch.join("|"),
      props: "labels|aliases|claims|sitelinks",
      languages: "de|en",
      languagefallback: "1",
    });
    const payload = await fetchJson(url);
    Object.assign(entities, payload.entities);
  }
  return entities;
}

function claimEntityIds(entity, property) {
  const claims = (entity?.claims?.[property] ?? []).filter((claim) => claim.rank !== "deprecated");
  const rankedClaims = claims.some((claim) => claim.rank === "preferred")
    ? claims.filter((claim) => claim.rank === "preferred")
    : claims;
  return rankedClaims
    .map((claim) => claim?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

function claimTime(entity, property) {
  const claims = (entity?.claims?.[property] ?? []).filter((claim) => claim.rank !== "deprecated");
  const selected = claims.find((claim) => claim.rank === "preferred") ?? claims[0];
  return selected?.mainsnak?.datavalue?.value?.time ?? null;
}

function yearFromTime(value) {
  const match = /^([+-])(\d{4,})/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[2]);
  return match[1] === "-" ? -year : year;
}

function localizedValue(values, fallback = "") {
  return values?.de?.value ?? values?.en?.value ?? fallback;
}

function commonsFileTitle(imageSource) {
  const marker = "/Special:FilePath/";
  const pathname = new URL(imageSource).pathname;
  const encoded = pathname.slice(pathname.indexOf(marker) + marker.length);
  return `File:${decodeURIComponent(encoded).replaceAll("_", " ")}`;
}

function candidateFileTitle(candidate) {
  return fileTitleOverrides[candidate.wikidataId] ?? commonsFileTitle(candidate.imageSource);
}

async function fetchCommonsInfo(fileTitles) {
  const results = new Map();
  for (const batch of chunks([...new Set(fileTitles)], 20)) {
    const url = new URL(COMMONS_API);
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      redirects: "1",
      prop: "imageinfo",
      iiprop: "url|size|mime|sha1|extmetadata",
      iiextmetadatafilter: [
        "LicenseShortName",
        "UsageTerms",
        "LicenseUrl",
        "AttributionRequired",
        "Copyrighted",
        "Artist",
        "Credit",
        "ImageDescription",
      ].join("|"),
      titles: batch.join("|"),
    });
    const payload = await fetchJson(url);
    for (const page of Object.values(payload.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!page.missing && info) {
        results.set(page.title, { pageId: page.pageid, title: page.title, ...info });
      }
    }
    for (const normalized of payload.query?.normalized ?? []) {
      const info = results.get(normalized.to);
      if (info) results.set(normalized.from, info);
    }
    for (const redirect of payload.query?.redirects ?? []) {
      const info = results.get(redirect.to);
      if (info) results.set(redirect.from, info);
    }
  }
  return results;
}

const artworkEntities = await fetchEntities(raw.map((candidate) => candidate.wikidataId));
const artistIds = raw.flatMap((candidate) =>
  claimEntityIds(artworkEntities[candidate.wikidataId], "P170"),
);
const artistEntities = await fetchEntities(artistIds);
const collectionIds = raw.flatMap((candidate) =>
  claimEntityIds(artworkEntities[candidate.wikidataId], "P195"),
);
const collectionEntities = await fetchEntities(collectionIds);
const fileTitles = raw.map(candidateFileTitle);
const commonsInfo = await fetchCommonsInfo(fileTitles);

const rows = raw.map((candidate) => {
  const artwork = artworkEntities[candidate.wikidataId];
  const creatorIds = claimEntityIds(artwork, "P170");
  const creators = creatorIds.map((id) => artistEntities[id]).filter(Boolean);
  const collectionId = claimEntityIds(artwork, "P195")[0] ?? null;
  const fileTitle = candidateFileTitle(candidate);
  const info = commonsInfo.get(fileTitle) ?? null;
  const metadata = Object.fromEntries(
    Object.entries(info?.extmetadata ?? {}).map(([key, value]) => [key, value?.value ?? null]),
  );
  const inception = claimTime(artwork, "P571");
  const creatorDeathYears = creators.map((creator) => yearFromTime(claimTime(creator, "P570")));

  return {
    ...candidate,
    title: localizedValue(artwork?.labels, candidate.wikidataId),
    titleDe: artwork?.labels?.de?.value ?? null,
    titleEn: artwork?.labels?.en?.value ?? null,
    titleAliasesDe: (artwork?.aliases?.de ?? []).map((alias) => alias.value),
    titleAliasesEn: (artwork?.aliases?.en ?? []).map((alias) => alias.value),
    creatorIds,
    artists: creators.map((creator, index) => ({
      wikidataId: creatorIds[index],
      name: localizedValue(creator.labels, creatorIds[index]),
      nameDe: creator.labels?.de?.value ?? null,
      nameEn: creator.labels?.en?.value ?? null,
      deathYear: creatorDeathYears[index],
      citizenshipIds: claimEntityIds(creator, "P27"),
    })),
    inception,
    year: yearFromTime(inception),
    collection: collectionId
      ? {
          wikidataId: collectionId,
          name: localizedValue(collectionEntities[collectionId]?.labels, collectionId),
        }
      : null,
    commons: info
      ? {
          pageId: info.pageId,
          pageTitle: info.title,
          pageUrl: info.descriptionurl,
          originalUrl: info.url,
          width: info.width,
          height: info.height,
          size: info.size,
          mime: info.mime,
          sha1: info.sha1,
          license: metadata.LicenseShortName,
          usageTerms: metadata.UsageTerms,
          licenseUrl: metadata.LicenseUrl,
          attributionRequired: metadata.AttributionRequired,
          copyrighted: metadata.Copyrighted,
          artistCredit: metadata.Artist,
          credit: metadata.Credit,
          description: metadata.ImageDescription,
        }
      : null,
  };
});

await writeFile(outputUrl, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  candidates: rows.length,
  withCommons: rows.filter((row) => row.commons).length,
  withSingleKnownCreator: rows.filter((row) => row.artists.length === 1).length,
  licenses: Object.entries(Object.groupBy(rows, (row) => row.commons?.license ?? "missing"))
    .map(([license, values]) => [license, values.length])
    .sort((left, right) => right[1] - left[1]),
}, null, 2));
