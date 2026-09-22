import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import { PILOT_COUNTRIES, sha256, validateCountryCatalogue } from "./country-policy.mjs";

const WIDTH = 1200;
const HEIGHT = 900;
const PADDING = 72;
const DESCRIPTOR_WIDTH = 16;
const DESCRIPTOR_HEIGHT = 12;
const CONTACT_COLUMNS = 5;
const CONTACT_ROWS = 10;
const CONTACT_CELL_WIDTH = 320;
const CONTACT_CELL_HEIGHT = 250;
const CONTACT_IMAGE_HEIGHT = 205;
const NATURAL_EARTH_ALIASES = { SSD: "SDS" };
const PRESERVED_PILOT_ISO2 = new Set(PILOT_COUNTRIES.map((country) => country.iso2));

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`MISSING_ARGUMENT:${name}`);
  return path.resolve(process.argv[index + 1]);
}

function polygonList(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  throw new Error(`UNSUPPORTED_GEOMETRY:${geometry.type}`);
}

function unwrapRing(ring) {
  if (ring.length === 0) return [];
  const result = [[ring[0][0], ring[0][1]]];
  let previous = ring[0][0];
  for (const [rawLongitude, latitude] of ring.slice(1)) {
    let longitude = rawLongitude;
    while (longitude - previous > 180) longitude -= 360;
    while (longitude - previous < -180) longitude += 360;
    result.push([longitude, latitude]);
    previous = longitude;
  }
  return result;
}

function shiftRing(ring, longitudeShift) {
  return ring.map(([longitude, latitude]) => [longitude + longitudeShift, latitude]);
}

function ringMeanLongitude(ring) {
  return ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
}

function unwrapPolygon(polygon) {
  const outer = unwrapRing(polygon[0]);
  const outerMean = ringMeanLongitude(outer);
  return polygon.map((rawRing, index) => {
    if (index === 0) return outer;
    const ring = unwrapRing(rawRing);
    const shift = Math.round((outerMean - ringMeanLongitude(ring)) / 360) * 360;
    return shiftRing(ring, shift);
  });
}

function ringArea(ring, latitudeScale) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    area += x1 * latitudeScale * y2 - x2 * latitudeScale * y1;
  }
  return area / 2;
}

function bbox(points) {
  return points.reduce(
    (box, [x, y]) => ({
      minX: Math.min(box.minX, x),
      maxX: Math.max(box.maxX, x),
      minY: Math.min(box.minY, y),
      maxY: Math.max(box.maxY, y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

function bboxGap(left, right) {
  const dx = Math.max(0, left.minX - right.maxX, right.minX - left.maxX);
  const dy = Math.max(0, left.minY - right.maxY, right.minY - left.maxY);
  return Math.hypot(dx, dy);
}

function alignPartToMain(part, main) {
  const partCenter = (part.bbox.minX + part.bbox.maxX) / 2;
  const mainCenter = (main.bbox.minX + main.bbox.maxX) / 2;
  const longitudeShift = Math.round((mainCenter - partCenter) / 360) * 360;
  if (longitudeShift === 0) return { ...part, longitudeShift };
  const rings = part.rings.map((ring) => shiftRing(ring, longitudeShift));
  return { ...part, rings, bbox: bbox(rings.flat()), longitudeShift };
}

function preparePolygons(geometry) {
  const allCoordinates = polygonList(geometry).flat(2);
  const meanLatitude = allCoordinates.reduce((sum, point) => sum + point[1], 0) / allCoordinates.length;
  const latitudeScale = Math.max(0.2, Math.cos((meanLatitude * Math.PI) / 180));
  const rawParts = polygonList(geometry)
    .map((polygon) => {
      const rings = unwrapPolygon(polygon);
      const points = rings.flat();
      const outerArea = Math.abs(ringArea(rings[0], latitudeScale));
      const holeArea = rings
        .slice(1)
        .reduce((sum, ring) => sum + Math.abs(ringArea(ring, latitudeScale)), 0);
      return { rings, area: Math.max(0, outerArea - holeArea), bbox: bbox(points) };
    })
    .filter((part) => part.area > 0)
    .sort((left, right) => right.area - left.area);
  const rawMain = rawParts[0];
  const parts = rawParts.map((part, index) =>
    index === 0 ? { ...part, longitudeShift: 0 } : alignPartToMain(part, rawMain),
  );
  const main = parts[0];
  const totalArea = parts.reduce((sum, part) => sum + part.area, 0);
  const mainShare = main.area / totalArea;
  const mainDiagonal = Math.hypot(
    main.bbox.maxX - main.bbox.minX,
    main.bbox.maxY - main.bbox.minY,
  );
  const retained = parts.filter((part, index) => {
    if (index === 0) return true;
    const ratio = part.area / main.area;
    const distributedState = mainShare < 0.65 || (parts.length <= 3 && mainShare < 0.9);
    if (distributedState) return ratio >= 0.0001;
    const distance = bboxGap(part.bbox, main.bbox);
    if (ratio >= 0.0005 && distance <= Math.max(1, mainDiagonal * 0.75)) return true;
    return ratio >= 0.00002 && distance <= Math.max(1, mainDiagonal * 0.2);
  });
  const retainedArea = retained.reduce((sum, part) => sum + part.area, 0);
  return {
    retained,
    parts,
    latitudeScale,
    mainShare,
    omittedAreaRatio: 1 - retainedArea / totalArea,
    antimeridianAdjusted: parts.some((part) => part.longitudeShift !== 0),
  };
}

function renderSvg(geometry) {
  const prepared = preparePolygons(geometry);
  const geographicPoints = prepared.retained.flatMap((part) => part.rings.flat());
  const meanLongitude =
    geographicPoints.reduce((sum, point) => sum + point[0], 0) /
    geographicPoints.length;
  const projected = prepared.retained.map((part) => ({
    ...part,
    rings: part.rings.map((ring) =>
      ring.map(([longitude, latitude]) => [
        (longitude - meanLongitude) * prepared.latitudeScale,
        -latitude,
      ]),
    ),
  }));
  const bounds = bbox(projected.flatMap((part) => part.rings.flat()));
  const contentWidth = Math.max(0.000001, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(0.000001, bounds.maxY - bounds.minY);
  const scale = Math.min(
    (WIDTH - PADDING * 2) / contentWidth,
    (HEIGHT - PADDING * 2) / contentHeight,
  );
  const offsetX = (WIDTH - contentWidth * scale) / 2 - bounds.minX * scale;
  const offsetY = (HEIGHT - contentHeight * scale) / 2 - bounds.minY * scale;
  const transform = ([x, y]) => [x * scale + offsetX, y * scale + offsetY];
  const pathData = projected
    .flatMap((part) =>
      part.rings.map(
        (ring) =>
          `${ring
            .map((point, index) => {
              const [x, y] = transform(point);
              return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(" ")} Z`,
      ),
    )
    .join(" ");
  const pixelBounds = bbox(
    projected.flatMap((part) => part.rings.flat()).map(transform),
  );
  const strokeWidth = prepared.mainShare < 0.65
    ? 10
    : prepared.retained.length >= 3
      ? 6
      : 3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#f8fafc"/><path d="${pathData}" fill="#111827" fill-rule="evenodd" stroke="#111827" stroke-width="${strokeWidth}" stroke-linejoin="round"/></svg>`;
  return { svg, prepared, pixelBounds };
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function createDescriptor(webpBytes) {
  const pixels = await sharp(webpBytes)
    .flatten({ background: "#f8fafc" })
    .resize(DESCRIPTOR_WIDTH, DESCRIPTOR_HEIGHT, {
      fit: "fill",
      kernel: "lanczos3",
    })
    .greyscale()
    .raw()
    .toBuffer();
  return Array.from(pixels, (value) =>
    Number(Math.max(0, Math.min(1, (248 - value) / 231)).toFixed(5)),
  );
}

async function visiblePixelRatio(webpBytes) {
  const { data, info } = await sharp(webpBytes)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let visible = 0;
  for (const value of data) if (value < 128) visible += 1;
  return visible / (info.width * info.height);
}

function reviewGroups(country, asset) {
  const groups = [];
  if (["AD", "LI", "LU", "MC", "SM", "VA", "SG", "NR"].includes(country.iso2)) {
    groups.push("microstate");
  }
  if (asset.retainedPolygonParts >= 3) groups.push("archipelago-or-multipart");
  if (asset.antimeridianAdjusted) groups.push("antimeridian-adjusted");
  if (asset.omittedAreaRatio > 0.001) groups.push("omitted-small-parts");
  if (asset.outlineAspectRatio < 0.35 || asset.outlineAspectRatio > 3.2) {
    groups.push("extreme-aspect-ratio");
  }
  return groups;
}

function qualityFlags(asset) {
  const flags = [];
  if (asset.omittedAreaRatio >= 0.2) flags.push("omitted-area-at-least-20-percent");
  if (asset.visiblePixelRatio < 0.001) flags.push("low-visible-area");
  if (asset.renderedBounds.minX < PADDING - 0.1) flags.push("left-padding");
  if (asset.renderedBounds.minY < PADDING - 0.1) flags.push("top-padding");
  if (asset.renderedBounds.maxX > WIDTH - PADDING + 0.1) flags.push("right-padding");
  if (asset.renderedBounds.maxY > HEIGHT - PADDING + 0.1) flags.push("bottom-padding");
  return flags;
}

async function buildContactSheets(assets, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const pageSize = CONTACT_COLUMNS * CONTACT_ROWS;
  const pages = [];
  for (let offset = 0; offset < assets.length; offset += pageSize) {
    const pageAssets = assets.slice(offset, offset + pageSize);
    const composites = [];
    for (const [index, asset] of pageAssets.entries()) {
      const column = index % CONTACT_COLUMNS;
      const row = Math.floor(index / CONTACT_COLUMNS);
      const left = column * CONTACT_CELL_WIDTH;
      const top = row * CONTACT_CELL_HEIGHT;
      const image = await sharp(asset.absoluteWebpPath)
        .resize(CONTACT_CELL_WIDTH - 24, CONTACT_IMAGE_HEIGHT - 16, {
          fit: "contain",
          background: "#ffffff",
        })
        .toBuffer();
      const label = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${CONTACT_CELL_WIDTH}" height="${CONTACT_CELL_HEIGHT - CONTACT_IMAGE_HEIGHT}"><rect width="100%" height="100%" fill="#ffffff"/><text x="12" y="29" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#0f172a">${escapeXml(asset.iso2)} · ${escapeXml(asset.nameDe)}</text></svg>`,
      );
      composites.push({ input: image, left: left + 12, top: top + 8 });
      composites.push({ input: label, left, top: top + CONTACT_IMAGE_HEIGHT });
    }
    const pageNumber = pages.length + 1;
    const filename = `contact-sheet-${String(pageNumber).padStart(2, "0")}.webp`;
    const outputPath = path.join(outputDirectory, filename);
    await sharp({
      create: {
        width: CONTACT_COLUMNS * CONTACT_CELL_WIDTH,
        height: CONTACT_ROWS * CONTACT_CELL_HEIGHT,
        channels: 3,
        background: "#ffffff",
      },
    })
      .composite(composites)
      .webp({ quality: 88, effort: 6 })
      .toFile(outputPath);
    pages.push(outputPath);
  }
  return pages;
}

const sourcePath = argument("--source");
const cataloguePath = argument("--catalogue");
const subsetPath = argument("--subset");
const outputDirectory = argument("--output-directory");
const manifestPath = argument("--manifest");
const qualityReportPath = argument("--quality-report");
const contactSheetDirectory = argument("--contact-sheet-directory");
const sourceBytes = await readFile(sourcePath);
const source = JSON.parse(sourceBytes.toString("utf8"));
const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
validateCountryCatalogue(catalogue.members);
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
const featureByAdm0A3 = new Map(
  source.features.map((feature) => [feature.properties.ADM0_A3, feature]),
);
await mkdir(outputDirectory, { recursive: true });

const selectedFeatures = [];
const assets = [];
for (const country of catalogue.members) {
  const sourceCode = NATURAL_EARTH_ALIASES[country.iso3] ?? country.iso3;
  const feature = featureByAdm0A3.get(sourceCode);
  if (!feature) throw new Error(`NATURAL_EARTH_FEATURE_MISSING:${country.iso3}`);
  selectedFeatures.push(feature);
  const { svg, prepared, pixelBounds } = renderSvg(feature.geometry);
  const basename = country.iso2.toLowerCase();
  const svgPath = path.join(outputDirectory, `${basename}.svg`);
  const webpPath = path.join(outputDirectory, `${basename}.webp`);
  const generatedSvgBytes = Buffer.from(svg, "utf8");
  const generatedWebpBytes = await sharp(generatedSvgBytes, { density: 96 })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  const preservePilot = PRESERVED_PILOT_ISO2.has(country.iso2);
  const svgBytes = preservePilot ? await readFile(svgPath) : generatedSvgBytes;
  const webpBytes = preservePilot ? await readFile(webpPath) : generatedWebpBytes;
  if (!preservePilot) {
    await writeFile(svgPath, svgBytes);
    await writeFile(webpPath, webpBytes);
  }
  const renderedBounds = Object.fromEntries(
    Object.entries(pixelBounds).map(([key, value]) => [key, Number(value.toFixed(2))]),
  );
  const asset = {
    iso2: country.iso2,
    iso3: country.iso3,
    nameDe: country.nameDe,
    sourceFeatureName: feature.properties.NAME,
    sourceFeatureIso3: feature.properties.ADM0_A3,
    sourceFeatureAlias: sourceCode === country.iso3 ? null : sourceCode,
    renderingPolicy: preservePilot ? "pilot-v1-preserved" : "full-rollout-v2",
    geometryType: feature.geometry.type,
    totalPolygonParts: prepared.parts.length,
    retainedPolygonParts: prepared.retained.length,
    mainPolygonAreaShare: Number(prepared.mainShare.toFixed(8)),
    omittedAreaRatio: Number(prepared.omittedAreaRatio.toFixed(8)),
    antimeridianAdjusted: prepared.antimeridianAdjusted,
    canvas: { width: WIDTH, height: HEIGHT, padding: PADDING },
    renderedBounds,
    outlineAspectRatio: Number(
      ((renderedBounds.maxX - renderedBounds.minX) /
        (renderedBounds.maxY - renderedBounds.minY)).toFixed(8),
    ),
    visiblePixelRatio: Number((await visiblePixelRatio(webpBytes)).toFixed(8)),
    outlineDescriptor: await createDescriptor(webpBytes),
    svg: {
      path: `public/country-outlines/${basename}.svg`,
      bytes: svgBytes.length,
      sha256: sha256(svgBytes),
    },
    webp: {
      path: `public/country-outlines/${basename}.webp`,
      bytes: webpBytes.length,
      sha256: sha256(webpBytes),
    },
    absoluteWebpPath: webpPath,
  };
  asset.reviewGroups = reviewGroups(country, asset);
  asset.qualityFlags = qualityFlags(asset);
  assets.push(asset);
}

const contactSheets = await buildContactSheets(assets, contactSheetDirectory);
const manifestAssets = assets.map((asset) => {
  const manifestAsset = { ...asset };
  delete manifestAsset.absoluteWebpPath;
  return manifestAsset;
});
const critical = manifestAssets.filter((asset) => asset.qualityFlags.length > 0);
const review = manifestAssets.filter((asset) => asset.reviewGroups.length > 0);
await writeFile(
  subsetPath,
  gzipSync(
    Buffer.from(
      `${JSON.stringify({ type: "FeatureCollection", name: "ne_10m_admin_0_countries_v5.1.1_un_members", features: selectedFeatures })}\n`,
      "utf8",
    ),
    { level: 9 },
  ),
);
await writeFile(
  manifestPath,
  `${JSON.stringify({
    version: 2,
    source: {
      name: "Natural Earth Admin 0 – Countries",
      version: "5.1.1",
      file: "ne_10m_admin_0_countries.geojson",
      sha256: sourceSha256,
      license: "Public domain",
    },
    mapping: {
      expectedUnMembers: 193,
      mappedFeatures: selectedFeatures.length,
      aliases: NATURAL_EARTH_ALIASES,
    },
    assets: manifestAssets,
  }, null, 2)}\n`,
  "utf8",
);
await writeFile(
  qualityReportPath,
  `${JSON.stringify({
    version: 1,
    generatedAssets: manifestAssets.length,
    criticalCount: critical.length,
    critical: critical.map((asset) => ({ iso2: asset.iso2, nameDe: asset.nameDe, flags: asset.qualityFlags })),
    reviewCount: review.length,
    review: review.map((asset) => ({ iso2: asset.iso2, nameDe: asset.nameDe, groups: asset.reviewGroups })),
    contactSheets: contactSheets.map((sheet) => path.relative(process.cwd(), sheet).replaceAll("\\", "/")),
  }, null, 2)}\n`,
  "utf8",
);
console.log(
  JSON.stringify({
    sourceSha256,
    assets: manifestAssets.length,
    critical: critical.length,
    review: review.length,
    contactSheets: contactSheets.length,
  }),
);
