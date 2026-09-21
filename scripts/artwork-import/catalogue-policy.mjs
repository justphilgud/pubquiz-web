export const CATALOGUE_SIZE = 200;
export const CANDIDATE_POOL_SIZE = 300;
export const MAX_WORKS_PER_ARTIST = 5;

export const manualOverrides = {
  Q12418: { title: "Mona Lisa", artist: "Leonardo da Vinci", yearLabel: "um 1503–1506", existing: true },
  Q128910: { title: "Das letzte Abendmahl", yearLabel: "1495–1498" },
  Q45585: { title: "Die Sternennacht" },
  Q185372: { title: "Das Mädchen mit dem Perlenohrring", artist: "Johannes Vermeer", aliases: ["Mädchen mit dem Perlenohrring"] },
  Q219831: { artist: "Rembrandt" },
  Q661378: { artist: "Rembrandt" },
  Q2246489: { artist: "Rembrandt" },
  Q766782: { artist: "Rembrandt" },
  Q512755: { artist: "Rembrandt" },
  Q18891156: { title: "Der Schrei" },
  Q252485: { title: "Die große Welle vor Kanagawa", year: 1831, yearLabel: "um 1830–1832" },
  Q3565037: { title: "Südwind, klarer Himmel", year: 1831, yearLabel: "um 1830–1832", aliases: ["Roter Fuji"] },
  Q5826309: { title: "Plötzlicher Regenschauer über der Shin-Ōhashi-Brücke und Atake" },
  Q21127606: { title: "Pflaumengarten in Kameido" },
  Q714802: { title: "Am Fluss während des Qingming-Festes", yearLabel: "12. Jahrhundert" },
  Q15907822: { title: "Reisende zwischen Bergen und Strömen", yearLabel: "um 1000" },
  Q5136665: { title: "Vorfrühling" },
  Q28092249: { title: "Nachtglänzendes Weiß", year: 750, yearLabel: "8. Jahrhundert" },
  Q10881982: { title: "Fünf Ochsen", year: 750, yearLabel: "8. Jahrhundert" },
  Q706846: { title: "Wohnsitz in den Fuchun-Bergen" },
  Q22959711: { title: "Sechs Edelmänner" },
  Q116459640: { title: "Dem Qin-Spiel lauschen", year: 1110, yearLabel: "frühes 12. Jahrhundert", artist: "Kaiser Huizong" },
  Q4997694: { title: "Kaiser Taizong empfängt den tibetischen Gesandten", yearLabel: "7. Jahrhundert" },
  Q11531476: { title: "Kiefernwald", yearLabel: "spätes 16. Jahrhundert" },
  Q42192051: { title: "Landschaft der vier Jahreszeiten" },
  Q4901133: { title: "Bharat Mata" },
  Q48734985: { title: "Der Tod von Shah Jahan" },
  Q10301958: { title: "Unabhängigkeit oder Tod" },
  Q28808756: { title: "Das Tal von Mexiko vom Hügel Santa Isabel aus", artist: "José María Velasco" },
  Q27950828: { title: "La mazamorra" },
  Q748518: { title: "Das Rhinozeros", aliases: ["Rhinocerus"] },
  Q5980742: { title: "Die vier apokalyptischen Reiter" },
  Q509806: { title: "Washington überquert den Delaware" },
  Q1314013: { title: "Die Sabinerinnen", aliases: ["Les Sabines", "The Intervention of the Sabine Women"] },
  Q1231009: { title: "Die Krönung Napoleons", aliases: ["Le Sacre de Napoléon"] },
  Q20180595: { title: "Die Banjostunde", aliases: ["The Banjo Lesson"] },
  Q2366825: { title: "Der Heuwagen", aliases: ["The Hay Wain"] },
  Q14915747: { title: "In der Loge", aliases: ["In the Loge"] },
  Q3172226: { title: "Das Bad des Kindes", aliases: ["The Child's Bath"] },
  Q80018842: { title: "Das Hundertguldenblatt", aliases: ["The Hundred Guilder Print"] },
  Q2324840: { title: "Der Alte der Tage", aliases: ["The Ancient of Days"] },
  Q257580: { title: "Das Kriegsschiff Temeraire", aliases: ["The Fighting Temeraire"] },
  Q2339059: { title: "Regen, Dampf und Geschwindigkeit – die Great Western Railway", aliases: ["Rain, Steam and Speed – The Great Western Railway"] },
  Q2521909: { title: "Der letzte Tag von Pompeji" },
  Q1213936: { title: "The Gross Clinic" },
  Q334604: { title: "Das Herz der Anden" },
  Q20475372: { title: "In der Sierra Nevada, Kalifornien" },
  Q29530: { collection: "Musée du Louvre" },
  Q152509: { collection: "Musée d’Orsay" },
  Q737062: { collection: "Musée d’Orsay" },
  Q474338: { collection: "Nationalmuseum Krakau" },
  Q540488: { year: 1850, yearLabel: "1849–1850" },
  Q1240092: { year: 1650, yearLabel: "um 1650" },
  Q1516449: { year: 1435, yearLabel: "um 1435" },
  Q867403: { year: 1538, yearLabel: "um 1534–1540" },
  Q969377: { year: 1600, yearLabel: "1599–1600" },
  Q533619: { year: 1559, yearLabel: "1559" },
  Q1473546: { year: 1506, yearLabel: "um 1505–1507" },
  Q2715152: { year: 1511, yearLabel: "um 1509–1511", title: "Der Parnass" },
  Q698487: { year: 1908, yearLabel: "1907–1908" },
};

export const artistNameOverrides = {
  Q41264: "Johannes Vermeer",
  Q5598: "Rembrandt",
  Q42207: "Caravaggio",
};

export const excludedQids = new Set([
  "Q334138", // Explicit subject; unsuitable for the general quiz pool.
  "Q326503", // Explicit subject; unsuitable for the general quiz pool.
  "Q567861", // Current Commons reproduction is CC BY-SA; equivalent PD candidates are preferred.
  "Q18210019", // Collection missing in structured provenance.
  "Q104836934", // Collection missing in structured provenance.
  "Q55373282", // Source reproduction is only 800 px wide.
]);

export const requiredQids = new Set([
  "Q12418", "Q128910", "Q45585", "Q185372", "Q29530", "Q151047", "Q219831", "Q208758",
  "Q328523", "Q698487", "Q321303", "Q311243", "Q212616", "Q464782", "Q152509", "Q1091086",
  "Q683274", "Q220859", "Q549847", "Q737062", "Q727875", "Q1025704", "Q500985", "Q1044742",
  "Q354396", "Q1170315", "Q1212937", "Q1065493", "Q2366825", "Q1239950", "Q94802", "Q2546309",
  "Q194137", "Q2664039", "Q2339059", "Q1368055", "Q846213", "Q2270938", "Q509806", "Q257580",
  "Q2317837", "Q1452762", "Q2324643", "Q241455", "Q1219263", "Q18891156", "Q252485", "Q3565037",
  "Q5826309", "Q21127606", "Q714802", "Q15907822", "Q5136665", "Q28092249", "Q10881982", "Q706846",
  "Q22959711", "Q116459640", "Q4997694", "Q11531476", "Q42192051", "Q4901133", "Q48734985", "Q10301958",
  "Q28808756", "Q27950828", "Q500242", "Q186953", "Q748518", "Q1362177", "Q671237", "Q2324840",
  "Q3172226", "Q1213936", "Q20475372", "Q3898508", "Q14915747", "Q80018842", "Q19925470",
]);

const acceptedLicenses = new Set(["Public domain", "CC0", "PDM-owner"]);

function normalize(value) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("de").replace(/[^a-z0-9]+/g, " ").trim();
}

function effectiveYear(row) {
  return manualOverrides[row.wikidataId]?.year ?? row.year;
}

export function isEligibleCandidate(row) {
  if (excludedQids.has(row.wikidataId)) return false;
  if (row.artists.length !== 1) return false;
  if (!Number.isInteger(row.artists[0].deathYear) || row.artists[0].deathYear > 1955) return false;
  if (!acceptedLicenses.has(row.commons?.license)) return false;
  if (!row.collection?.name || !row.commons?.pageUrl || !row.commons?.originalUrl) return false;
  if (!Number.isInteger(effectiveYear(row))) return false;
  if (row.commons.width < 900 || row.commons.height < 480) return false;
  if (!/^image\/(jpeg|png|webp|tiff)$/.test(row.commons.mime ?? "")) return false;
  return true;
}

export function applyOverrides(row) {
  const override = manualOverrides[row.wikidataId] ?? {};
  const artist = override.artist ?? artistNameOverrides[row.artists[0].wikidataId] ?? row.artists[0].name;
  const title = override.title ?? row.title;
  const aliases = [...new Set([
    ...(override.aliases ?? []),
    ...row.titleAliasesDe.filter((alias) => normalize(alias) !== normalize(title)).slice(0, 3),
  ])];
  return {
    catalogueNumber: 0,
    status: override.existing ? "bereits vorhanden" : "neu",
    wikidataId: row.wikidataId,
    wikidataUrl: `https://www.wikidata.org/wiki/${row.wikidataId}`,
    artist: {
      wikidataId: row.artists[0].wikidataId,
      name: artist,
    },
    title,
    alternativeTitles: aliases,
    year: effectiveYear(row),
    yearLabel: override.yearLabel ?? String(effectiveYear(row)),
    collection: override.collection ? { ...row.collection, name: override.collection } : row.collection,
    commons: row.commons,
    selection: {
      wikipediaSitelinks: row.sitelinks,
      curatedAddition: Boolean(row.curatedAddition),
      familiarity: row.sitelinks >= 40 ? "sehr bekannt" : row.sitelinks >= 22 ? "bekannt" : "anspruchsvoll",
    },
  };
}

function selectWithArtistCap(candidates, size, initial = []) {
  const selected = [...initial];
  const qids = new Set(selected.map((row) => row.wikidataId));
  const normalizedWorks = new Set(selected.map((row) => `${normalize(row.artists[0].name)}::${normalize(row.title)}`));
  const artistCounts = new Map();
  for (const row of selected) {
    const artistId = row.artists[0].wikidataId;
    artistCounts.set(artistId, (artistCounts.get(artistId) ?? 0) + 1);
  }
  for (const row of candidates) {
    if (selected.length >= size || qids.has(row.wikidataId)) continue;
    const artistId = row.artists[0].wikidataId;
    const key = `${normalize(row.artists[0].name)}::${normalize(row.title)}`;
    if ((artistCounts.get(artistId) ?? 0) >= MAX_WORKS_PER_ARTIST || normalizedWorks.has(key)) continue;
    selected.push(row);
    qids.add(row.wikidataId);
    normalizedWorks.add(key);
    artistCounts.set(artistId, (artistCounts.get(artistId) ?? 0) + 1);
  }
  return selected;
}

export function buildCatalogue(enrichedRows) {
  const eligibleById = new Map();
  for (const row of enrichedRows) {
    if (isEligibleCandidate(row) && !eligibleById.has(row.wikidataId)) eligibleById.set(row.wikidataId, row);
  }
  const eligible = [...eligibleById.values()].sort((left, right) =>
    Number(Boolean(right.curatedAddition)) - Number(Boolean(left.curatedAddition)) ||
    right.sitelinks - left.sitelinks || left.wikidataId.localeCompare(right.wikidataId),
  );
  const pool = [];
  const poolArtistCounts = new Map();
  for (const row of eligible) {
    if (pool.length >= CANDIDATE_POOL_SIZE) break;
    const artistId = row.artists[0].wikidataId;
    if ((poolArtistCounts.get(artistId) ?? 0) >= 8) continue;
    pool.push(row);
    poolArtistCounts.set(artistId, (poolArtistCounts.get(artistId) ?? 0) + 1);
  }
  const required = [...requiredQids].map((qid) => eligibleById.get(qid)).filter(Boolean);
  const missingRequired = [...requiredQids].filter((qid) => !eligibleById.has(qid));
  if (missingRequired.length) throw new Error(`Required candidates are ineligible or missing: ${missingRequired.join(", ")}`);
  const finalRows = selectWithArtistCap(pool, CATALOGUE_SIZE, selectWithArtistCap(required, required.length));
  if (pool.length !== CANDIDATE_POOL_SIZE) throw new Error(`Expected ${CANDIDATE_POOL_SIZE} candidates, got ${pool.length}.`);
  if (finalRows.length !== CATALOGUE_SIZE) throw new Error(`Expected ${CATALOGUE_SIZE} works, got ${finalRows.length}.`);
  const catalogue = finalRows.map(applyOverrides).sort((left, right) => {
    if (left.status !== right.status) return left.status === "bereits vorhanden" ? -1 : 1;
    return left.artist.name.localeCompare(right.artist.name, "de") || left.year - right.year || left.title.localeCompare(right.title, "de");
  }).map((row, index) => ({ ...row, catalogueNumber: index + 1 }));
  return { pool: pool.map(applyOverrides), catalogue };
}

export function validateCatalogue(catalogue) {
  const errors = [];
  if (catalogue.length !== CATALOGUE_SIZE) errors.push(`Gesamtzahl ${catalogue.length} statt ${CATALOGUE_SIZE}`);
  const existing = catalogue.filter((work) => work.status === "bereits vorhanden");
  if (existing.length !== 1 || existing[0]?.wikidataId !== "Q12418") errors.push("Mona Lisa ist nicht genau einmal als bestehend markiert.");
  const artistCounts = new Map();
  const qids = new Set();
  const works = new Set();
  for (const work of catalogue) {
    artistCounts.set(work.artist.wikidataId, (artistCounts.get(work.artist.wikidataId) ?? 0) + 1);
    if (qids.has(work.wikidataId)) errors.push(`Doppelte Wikidata-ID ${work.wikidataId}`);
    qids.add(work.wikidataId);
    const key = `${normalize(work.artist.name)}::${normalize(work.title)}`;
    if (works.has(key)) errors.push(`Doppeltes Werk ${work.artist.name}: ${work.title}`);
    works.add(key);
    if (!work.artist.name || !work.title || !work.commons.pageUrl || !work.commons.license) errors.push(`Unvollständige Provenance ${work.wikidataId}`);
  }
  for (const [artistId, count] of artistCounts) if (count > MAX_WORKS_PER_ARTIST) errors.push(`${artistId} hat ${count} Werke.`);
  return { errors, artistCounts };
}
