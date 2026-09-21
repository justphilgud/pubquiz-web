import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PILOT_COUNTRIES, sha256 } from "./country-policy.mjs";

const WIDTH = 1200;
const HEIGHT = 900;
const PADDING = 72;

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
  return points.reduce((box, [x, y]) => ({
    minX: Math.min(box.minX, x), maxX: Math.max(box.maxX, x),
    minY: Math.min(box.minY, y), maxY: Math.max(box.maxY, y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function bboxGap(left, right) {
  const dx = Math.max(0, left.minX - right.maxX, right.minX - left.maxX);
  const dy = Math.max(0, left.minY - right.maxY, right.minY - left.maxY);
  return Math.hypot(dx, dy);
}

function preparePolygons(geometry) {
  const allCoordinates = polygonList(geometry).flat(2);
  const meanLatitude = allCoordinates.reduce((sum, point) => sum + point[1], 0) / allCoordinates.length;
  const latitudeScale = Math.max(0.2, Math.cos(meanLatitude * Math.PI / 180));
  const parts = polygonList(geometry).map((polygon) => {
    const rings = polygon.map(unwrapRing);
    const points = rings.flat();
    const outerArea = Math.abs(ringArea(rings[0], latitudeScale));
    const holeArea = rings.slice(1).reduce((sum, ring) => sum + Math.abs(ringArea(ring, latitudeScale)), 0);
    return { rings, area: Math.max(0, outerArea - holeArea), bbox: bbox(points) };
  }).filter((part) => part.area > 0);
  parts.sort((left, right) => right.area - left.area);
  const main = parts[0];
  const totalArea = parts.reduce((sum, part) => sum + part.area, 0);
  const mainShare = main.area / totalArea;
  const mainDiagonal = Math.hypot(main.bbox.maxX - main.bbox.minX, main.bbox.maxY - main.bbox.minY);
  const retained = parts.filter((part, index) => {
    if (index === 0) return true;
    const ratio = part.area / main.area;
    if (mainShare < 0.65) return ratio >= 0.0001;
    return ratio >= 0.0005 || (ratio >= 0.00002 && bboxGap(part.bbox, main.bbox) <= Math.max(1, mainDiagonal * 0.2));
  });
  return { retained, parts, latitudeScale, omittedAreaRatio: 1 - retained.reduce((sum, part) => sum + part.area, 0) / totalArea };
}

function renderSvg(geometry) {
  const prepared = preparePolygons(geometry);
  const geographicPoints = prepared.retained.flatMap((part) => part.rings.flat());
  const meanLongitude = geographicPoints.reduce((sum, point) => sum + point[0], 0) / geographicPoints.length;
  const projected = prepared.retained.map((part) => ({
    ...part,
    rings: part.rings.map((ring) => ring.map(([longitude, latitude]) => [
      (longitude - meanLongitude) * prepared.latitudeScale,
      -latitude,
    ])),
  }));
  const bounds = bbox(projected.flatMap((part) => part.rings.flat()));
  const contentWidth = Math.max(0.000001, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(0.000001, bounds.maxY - bounds.minY);
  const scale = Math.min((WIDTH - PADDING * 2) / contentWidth, (HEIGHT - PADDING * 2) / contentHeight);
  const offsetX = (WIDTH - contentWidth * scale) / 2 - bounds.minX * scale;
  const offsetY = (HEIGHT - contentHeight * scale) / 2 - bounds.minY * scale;
  const transform = ([x, y]) => [x * scale + offsetX, y * scale + offsetY];
  const pathData = projected.flatMap((part) => part.rings.map((ring) => ring.map((point, index) => {
    const [x, y] = transform(point);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ") + " Z")).join(" ");
  const pixelBounds = bbox(projected.flatMap((part) => part.rings.flat()).map(transform));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#f8fafc"/><path d="${pathData}" fill="#111827" fill-rule="evenodd" stroke="#111827" stroke-width="3" stroke-linejoin="round"/></svg>`;
  return { svg, prepared, pixelBounds };
}

const sourcePath = argument("--source");
const subsetPath = argument("--subset");
const outputDirectory = argument("--output-directory");
const manifestPath = argument("--manifest");
const sourceBytes = await readFile(sourcePath);
const source = JSON.parse(sourceBytes.toString("utf8"));
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
const featureByIso3 = new Map(source.features.map((feature) => [feature.properties.ADM0_A3, feature]));
await mkdir(outputDirectory, { recursive: true });

const selectedFeatures = [];
const assets = [];
for (const country of PILOT_COUNTRIES) {
  const feature = featureByIso3.get(country.iso3);
  if (!feature) throw new Error(`NATURAL_EARTH_FEATURE_MISSING:${country.iso3}`);
  selectedFeatures.push(feature);
  const { svg, prepared, pixelBounds } = renderSvg(feature.geometry);
  const basename = country.iso2.toLowerCase();
  const svgPath = path.join(outputDirectory, `${basename}.svg`);
  const webpPath = path.join(outputDirectory, `${basename}.webp`);
  const svgBytes = Buffer.from(svg, "utf8");
  const webpBytes = await sharp(svgBytes, { density: 96 }).webp({ lossless: true, effort: 6 }).toBuffer();
  await writeFile(svgPath, svgBytes);
  await writeFile(webpPath, webpBytes);
  assets.push({
    ...country,
    sourceFeatureName: feature.properties.NAME,
    sourceFeatureIso3: feature.properties.ADM0_A3,
    geometryType: feature.geometry.type,
    totalPolygonParts: prepared.parts.length,
    retainedPolygonParts: prepared.retained.length,
    omittedAreaRatio: Number(prepared.omittedAreaRatio.toFixed(8)),
    canvas: { width: WIDTH, height: HEIGHT, padding: PADDING },
    renderedBounds: Object.fromEntries(Object.entries(pixelBounds).map(([key, value]) => [key, Number(value.toFixed(2))])),
    svg: { path: `public/country-outlines/${basename}.svg`, bytes: svgBytes.length, sha256: sha256(svgBytes) },
    webp: { path: `public/country-outlines/${basename}.webp`, bytes: webpBytes.length, sha256: sha256(webpBytes) },
  });
}

await writeFile(subsetPath, `${JSON.stringify({ type: "FeatureCollection", name: "ne_10m_admin_0_countries_v5.1.1_pilot", features: selectedFeatures }, null, 2)}\n`, "utf8");
await writeFile(manifestPath, `${JSON.stringify({ version: 1, source: { name: "Natural Earth Admin 0 – Countries", version: "5.1.1", file: "ne_10m_admin_0_countries.geojson", sha256: sourceSha256, license: "Public domain" }, assets }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ sourceSha256, assets: assets.map((asset) => ({ iso2: asset.iso2, parts: `${asset.retainedPolygonParts}/${asset.totalPolygonParts}`, webpBytes: asset.webp.bytes })) }));
