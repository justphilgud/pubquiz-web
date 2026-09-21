import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  FLAG_QUESTION,
  buildOutlinePilotPlan,
  selectFlagDistractors,
  sha256,
  validateCountryCatalogue,
  validateQuestionAnswers,
} from "./country-policy.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`MISSING_ARGUMENT:${name}`);
  return path.resolve(process.argv[index + 1]);
}

const memberManifestPath = argument("--member-manifest");
const countriesSourcePath = argument("--countries-source");
const pilotFlagDirectory = argument("--pilot-flag-directory");
const remainingFlagDirectory = argument("--remaining-flag-directory");
const outputCataloguePath = argument("--output-catalogue");
const outputPlanPath = argument("--output-plan");

const memberManifest = JSON.parse(await readFile(memberManifestPath, "utf8"));
const sourceCountries = JSON.parse(await readFile(countriesSourcePath, "utf8"));
const sourceByIso2 = new Map(sourceCountries.map((country) => [country.cca2, country]));

async function loadFlag(iso2) {
  const filename = `flag-${iso2.toLowerCase()}.png`;
  const candidatePaths = [path.join(pilotFlagDirectory, filename), path.join(remainingFlagDirectory, filename)];
  let bytes = null;
  let resolvedPath = null;
  for (const candidatePath of candidatePaths) {
    try {
      bytes = await readFile(candidatePath);
      resolvedPath = candidatePath;
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  if (!bytes || !resolvedPath) throw new Error(`FLAG_SOURCE_MISSING:${iso2}`);
  const image = sharp(bytes, { failOn: "warning" });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.format !== "png") throw new Error(`FLAG_SOURCE_INVALID:${iso2}`);
  const descriptor = await image
    .flatten({ background: "#ffffff" })
    .resize(24, 16, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  return {
    flagSourceSha256: sha256(bytes),
    flagSourceBytes: bytes.length,
    flagSourceWidth: metadata.width,
    flagSourceHeight: metadata.height,
    flagAspectRatio: metadata.width / metadata.height,
    flagDescriptor: Array.from(descriptor, (value) => value / 255),
  };
}

const countries = [];
for (const member of memberManifest) {
  const source = sourceByIso2.get(member.iso2);
  if (!source) throw new Error(`COUNTRY_SOURCE_MISSING:${member.iso2}`);
  countries.push({
    iso2: member.iso2,
    iso3: source.cca3,
    nameDe: member.name_de,
    nameEn: member.name_en,
    region: source.region,
    subregion: source.subregion,
    flagSourceUrl: member.flag_url,
    ...(await loadFlag(member.iso2)),
  });
}

countries.sort((left, right) => left.iso2.localeCompare(right.iso2));
validateCountryCatalogue(countries);

const flagQuestions = countries.map((country) => {
  const distractors = selectFlagDistractors(country, countries);
  const question = {
    iso2: country.iso2,
    iso3: country.iso3,
    nameDe: country.nameDe,
    question: FLAG_QUESTION,
    answers: [
      { iso2: country.iso2, nameDe: country.nameDe, isCorrect: true },
      ...distractors.map((distractor) => ({ iso2: distractor.iso2, nameDe: distractor.nameDe, isCorrect: false })),
    ],
  };
  if (!validateQuestionAnswers(question)) throw new Error(`FLAG_QUESTION_INVALID:${country.iso2}`);
  return question;
});

const catalogue = countries.map((country) => ({
  iso2: country.iso2,
  iso3: country.iso3,
  nameDe: country.nameDe,
  nameEn: country.nameEn,
  region: country.region,
  subregion: country.subregion,
  flagSourceUrl: country.flagSourceUrl,
  flagSourceSha256: country.flagSourceSha256,
  flagSourceBytes: country.flagSourceBytes,
  flagSourceWidth: country.flagSourceWidth,
  flagSourceHeight: country.flagSourceHeight,
  flagAspectRatio: country.flagAspectRatio,
}));
const outlinePilot = buildOutlinePilotPlan(catalogue);
if (!outlinePilot.every(validateQuestionAnswers)) throw new Error("OUTLINE_PILOT_INVALID");

await writeFile(outputCataloguePath, `${JSON.stringify({ version: 1, members: catalogue }, null, 2)}\n`, "utf8");
await writeFile(outputPlanPath, `${JSON.stringify({ version: 1, flagQuestions, outlinePilot }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ countries: catalogue.length, flagQuestions: flagQuestions.length, outlinePilot: outlinePilot.length }));
