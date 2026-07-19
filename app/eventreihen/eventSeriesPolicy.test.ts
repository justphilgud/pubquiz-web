import assert from "node:assert/strict";
import test from "node:test";
import {
  eventSeriesSlugBase,
  generateUniqueEventSeriesSlug,
  eventSeriesArchiveState,
  isEventSeriesSelectable,
  validateEventSeriesInput,
} from "./eventSeriesPolicy";

test("event series slugs normalize umlauts, eszett, whitespace and symbols", () => {
  assert.equal(eventSeriesSlugBase(" Ungegoogelt im Café Paule! "), "ungegoogelt-im-cafe-paule");
  assert.equal(eventSeriesSlugBase("ÄÖÜ ß & Spaß"), "aeoeue-ss-spass");
  assert.equal(eventSeriesSlugBase("---"), "eventreihe");
});

test("event series slug collisions receive deterministic suffixes", async () => {
  const taken = new Set(["cafe-paule", "cafe-paule-2"]);
  assert.equal(
    await generateUniqueEventSeriesSlug("Café Paule", async (slug) => taken.has(slug)),
    "cafe-paule-3",
  );
});

test("event series validation trims input and rejects blank or oversized names", () => {
  const valid = validateEventSeriesInput({
    name: "  Café Paule  ",
    publicName: "  ungegoogelt  ",
    description: " ",
    internalNote: " intern ",
    isPublic: false,
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.name, "Café Paule");
    assert.equal(valid.value.description, null);
    assert.equal(valid.value.internalNote, "intern");
  }
  assert.equal(validateEventSeriesInput({ name: "   ", isPublic: false }).ok, false);
  assert.equal(validateEventSeriesInput({ name: "x".repeat(151), isPublic: false }).ok, false);
});

test("a stored slug is independent from later name validation", () => {
  const storedSlug = eventSeriesSlugBase("Alter Name");
  const updated = validateEventSeriesInput({ name: "Neuer Name", isPublic: false });
  assert.equal(updated.ok, true);
  assert.equal(storedSlug, "alter-name");
});

test("archive state is reversible and archived series stay selectable only for their current quiz", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");
  assert.deepEqual(eventSeriesArchiveState(true, now), {
    ist_archiviert: true,
    archiviert_am: now,
  });
  assert.deepEqual(eventSeriesArchiveState(false, now), {
    ist_archiviert: false,
    archiviert_am: null,
  });
  assert.equal(isEventSeriesSelectable({ id: 4, isArchived: true }), false);
  assert.equal(isEventSeriesSelectable({ id: 4, isArchived: true }, 4), true);
  assert.equal(isEventSeriesSelectable({ id: 5, isArchived: false }), true);
});
