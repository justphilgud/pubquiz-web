import assert from "node:assert/strict";
import test from "node:test";

import { eventSeriesInputFromFormData } from "./eventSeriesForm";
import {
  persistEventSeriesUpdate,
  type EventSeriesUpdateRepository,
  type SavedEventSeriesUpdate,
} from "./eventSeriesRepository";
import { validateEventSeriesInput } from "./eventSeriesPolicy";

function createFormData(isPublic: boolean, name = "Sommerquiz") {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("publicName", "Sommerquiz öffentlich");
  formData.set("description", "Neue Beschreibung");
  formData.set("internalNote", "Neue interne Notiz");
  formData.set("defaultPresentationTemplateId", "ungegoogelt-default");
  if (isPublic) formData.set("isPublic", "true");
  return formData;
}

function createRepository(initialIsPublic: boolean) {
  let stored: SavedEventSeriesUpdate = {
    name: "Alter Name",
    oeffentlicher_name: null,
    beschreibung: null,
    interne_bemerkung: null,
    ist_oeffentlich: initialIsPublic,
    default_presentation_template_id: "ungegoogelt-default",
  };

  const repository: EventSeriesUpdateRepository = {
    async update({ where, data }) {
      assert.equal(where.eventreihe_id, 17);
      stored = {
        name: data.name,
        oeffentlicher_name: data.oeffentlicher_name,
        beschreibung: data.beschreibung,
        interne_bemerkung: data.interne_bemerkung,
        ist_oeffentlich: data.ist_oeffentlich,
        default_presentation_template_id:
          data.default_presentation_template_id,
      };
      return stored;
    },
  };

  return { repository, reload: () => ({ ...stored }) };
}

async function submitAndReload(initialIsPublic: boolean, nextIsPublic: boolean) {
  const input = eventSeriesInputFromFormData(createFormData(nextIsPublic));
  const validated = validateEventSeriesInput(input);
  assert.equal(validated.ok, true);
  if (!validated.ok) throw new Error("Test input must be valid.");

  const { repository, reload } = createRepository(initialIsPublic);
  const saved = await persistEventSeriesUpdate(repository, 17, validated.value);
  return { saved, reloaded: reload() };
}

test("event series form submits checked and unchecked visibility explicitly", () => {
  assert.equal(eventSeriesInputFromFormData(createFormData(true)).isPublic, true);
  assert.equal(eventSeriesInputFromFormData(createFormData(false)).isPublic, false);
});

test("private to public persists through the repository and reload", async () => {
  const { saved, reloaded } = await submitAndReload(false, true);
  assert.equal(saved.ist_oeffentlich, true);
  assert.equal(reloaded.ist_oeffentlich, true);
});

test("public to private persists through the repository and reload", async () => {
  const { saved, reloaded } = await submitAndReload(true, false);
  assert.equal(saved.ist_oeffentlich, false);
  assert.equal(reloaded.ist_oeffentlich, false);
});

test("name and visibility changes persist in the same update", async () => {
  const input = eventSeriesInputFromFormData(createFormData(true, "Neuer Name"));
  const validated = validateEventSeriesInput(input);
  assert.equal(validated.ok, true);
  if (!validated.ok) throw new Error("Test input must be valid.");

  const { repository, reload } = createRepository(false);
  await persistEventSeriesUpdate(repository, 17, validated.value);
  assert.deepEqual(
    {
      name: reload().name,
      isPublic: reload().ist_oeffentlich,
    },
    { name: "Neuer Name", isPublic: true },
  );
});
