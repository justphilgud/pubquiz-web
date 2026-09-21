import { writeFile } from "node:fs/promises";

const requests = [
  ["The Scream", "Edvard Munch"],
  ["The Great Wave off Kanagawa", "Katsushika Hokusai"],
  ["Fine Wind, Clear Morning", "Katsushika Hokusai"],
  ["Sudden Shower over Shin-Ōhashi bridge and Atake", "Hiroshige"],
  ["Plum Park in Kameido", "Hiroshige"],
  ["Three Beauties of the Present Day", "Utamaro"],
  ["The Actor Ōtani Oniji III as Yakko Edobei", "Sharaku"],
  ["Wind God and Thunder God Screens", "Tawaraya Sōtatsu"],
  ["Pine Trees screen", "Hasegawa Tōhaku"],
  ["Landscape of the Four Seasons", "Sesshū Tōyō"],
  ["Along the River During the Qingming Festival", "Zhang Zeduan"],
  ["Travelers among Mountains and Streams", "Fan Kuan"],
  ["Early Spring", "Guo Xi"],
  ["Night-Shining White", "Han Gan"],
  ["Five Oxen", "Han Huang"],
  ["Dwelling in the Fuchun Mountains", "Huang Gongwang"],
  ["Six Gentlemen", "Ni Zan"],
  ["Listening to the Qin", "Emperor Huizong"],
  ["Emperor Taizong Receiving the Tibetan Envoy", "Yan Liben"],
  ["Dream Journey to the Peach Blossom Land", "An Gyeon"],
  ["Inwangjesaekdo", "Jeong Seon"],
  ["Shakuntala looking back to glimpse Dushyanta", "Raja Ravi Varma"],
  ["Hamsa Damayanti", "Raja Ravi Varma"],
  ["Galaxy of Musicians", "Raja Ravi Varma"],
  ["Bharat Mata", "Abanindranath Tagore"],
  ["The Passing of Shah Jahan", "Abanindranath Tagore"],
  ["Independence or Death", "Pedro Américo"],
  ["First Mass in Brazil", "Victor Meirelles"],
  ["Battle of Avay", "Pedro Américo"],
  ["Oath of the Thirty-Three Orientals", "Juan Manuel Blanes"],
  ["The Valley of Mexico from the Santa Isabel Mountain Range", "José María Velasco Gómez"],
  ["La mazamorra", "Fernando Fader"],
  ["The Creation of Adam", "Michelangelo"],
  ["The Last Judgment", "Michelangelo"],
  ["The School of Athens", "Raphael"],
  ["The Disputation of the Sacrament", "Raphael"],
  ["The Expulsion from the Garden of Eden", "Masaccio"],
  ["The Tribute Money", "Masaccio"],
  ["Lamentation", "Giotto"],
  ["Kiss of Judas", "Giotto"],
  ["Annunciation", "Fra Angelico"],
  ["The Parnassus", "Raphael"],
  ["Melencolia I", "Albrecht Dürer"],
  ["The Four Horsemen", "Albrecht Dürer"],
  ["Dürer's Rhinoceros", "Albrecht Dürer"],
  ["Adam and Eve", "Albrecht Dürer"],
  ["The Sleep of Reason Produces Monsters", "Francisco Goya"],
  ["The Three Trees", "Rembrandt"],
  ["The Hundred Guilder Print", "Rembrandt"],
  ["The Ancient of Days", "William Blake"],
  ["Washington Crossing the Delaware", "Emanuel Leutze"],
  ["The Gross Clinic", "Thomas Eakins"],
  ["Snap the Whip", "Winslow Homer"],
  ["The Heart of the Andes", "Frederic Edwin Church"],
  ["Among the Sierra Nevada, California", "Albert Bierstadt"],
  ["The Banjo Lesson", "Henry Ossawa Tanner"],
  ["The Thankful Poor", "Henry Ossawa Tanner"],
  ["The Child's Bath", "Mary Cassatt"],
  ["In the Loge", "Mary Cassatt"],
  ["Little Girl in a Blue Armchair", "Mary Cassatt"],
];

const API = "https://www.wikidata.org/w/api.php";
const headers = { "user-agent": "PubQuiz artwork canon research/1.0 (https://github.com/justphilgud/pubquiz-web)" };

async function getJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
}

async function searchEntities(search) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "wbsearchentities",
    format: "json",
    origin: "*",
    language: "en",
    uselang: "en",
    type: "item",
    limit: "10",
    search,
  });
  return (await getJson(url)).search ?? [];
}

async function fetchEntities(ids) {
  if (!ids.length) return {};
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    origin: "*",
    ids: ids.join("|"),
    props: "labels|claims",
    languages: "de|en",
    languagefallback: "1",
  });
  return (await getJson(url)).entities;
}

function creatorIds(entity) {
  return (entity?.claims?.P170 ?? [])
    .map((claim) => claim?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

function hasImage(entity) {
  return Boolean(entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value);
}

const rows = [];
for (const [title, expectedArtist] of requests) {
  const matches = await searchEntities(title);
  const entities = await fetchEntities(matches.map((match) => match.id));
  const creators = await fetchEntities(Object.values(entities).flatMap(creatorIds));
  const reviewed = matches.map((match) => {
    const entity = entities[match.id];
    const names = creatorIds(entity).map((id) =>
      creators[id]?.labels?.en?.value ?? creators[id]?.labels?.de?.value ?? id,
    );
    return { id: match.id, label: match.label, description: match.description, creators: names, hasImage: hasImage(entity) };
  });
  const normalizedExpected = expectedArtist.toLocaleLowerCase("en");
  const selected = reviewed.find((match) =>
    match.hasImage && match.creators.some((name) => {
      const normalized = name.toLocaleLowerCase("en");
      return normalized.includes(normalizedExpected) || normalizedExpected.includes(normalized);
    }),
  ) ?? null;
  rows.push({ title, expectedArtist, selected, matches: reviewed });
}

await writeFile(
  new URL("../../data/artworks/canonical-additions.resolved.json", import.meta.url),
  `${JSON.stringify(rows, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({ requests: rows.length, resolved: rows.filter((row) => row.selected).length }, null, 2));
