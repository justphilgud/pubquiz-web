import assert from "node:assert/strict";
import test from "node:test";

import {
  applyMemeCaptionZonePreset,
  createMemeCaptionZone,
  DEFAULT_MEME_CAPTION_LAYOUT,
  getStrongMemeCaptionZoneOverlaps,
  MEME_CAPTION_ZONE_PRESETS,
  parseMemeCaptionLayoutConfig,
  resolveMemeCaptionLayout,
} from "./memeCaptionZones";

test("legacy questions resolve to the unchanged AP5 top and bottom layout", () => {
  assert.deepEqual(parseMemeCaptionLayoutConfig(undefined), DEFAULT_MEME_CAPTION_LAYOUT);
  const layout = resolveMemeCaptionLayout(undefined);
  assert.equal(layout.mode, "STANDARD");
  assert.deepEqual(layout.zones.map(({ id, placement, height, maxLines }) => ({ id, placement, height, maxLines })), [
    { id: "top", placement: "EXTERNAL_TOP", height: 21, maxLines: 3 },
    { id: "bottom", placement: "EXTERNAL_BOTTOM", height: 21, maxLines: 3 },
  ]);
});

test("one to four normalized custom zones are accepted and sorted", () => {
  const first = createMemeCaptionZone(2, MEME_CAPTION_ZONE_PRESETS[7]);
  const second = createMemeCaptionZone(1, MEME_CAPTION_ZONE_PRESETS[4]);
  const parsed = parseMemeCaptionLayoutConfig({ version: 1, mode: "CUSTOM", zones: [first, second] });
  assert.deepEqual(parsed?.mode === "CUSTOM" ? parsed.zones.map((zone) => zone.order) : [], [1, 2]);
  assert.equal(parseMemeCaptionLayoutConfig({ version: 1, mode: "CUSTOM", zones: [] }), null);
  assert.equal(parseMemeCaptionLayoutConfig({ version: 1, mode: "CUSTOM", zones: [first, second, first, second, first] }), null);
});

test("invalid geometry, duplicate IDs and duplicate external slots are rejected", () => {
  const zone = createMemeCaptionZone(1);
  assert.equal(parseMemeCaptionLayoutConfig({ version: 1, mode: "CUSTOM", zones: [{ ...zone, x: 95, width: 20 }] }), null);
  assert.equal(parseMemeCaptionLayoutConfig({ version: 1, mode: "CUSTOM", zones: [zone, { ...zone, order: 2 }] }), null);
  const top = applyMemeCaptionZonePreset(zone, MEME_CAPTION_ZONE_PRESETS[0]);
  assert.equal(parseMemeCaptionLayoutConfig({ version: 1, mode: "CUSTOM", zones: [top, { ...top, id: "other", order: 2 }] }), null);
});

test("presets remain editable and strong internal overlap is reported without changing validity", () => {
  const first = createMemeCaptionZone(1, MEME_CAPTION_ZONE_PRESETS[4]);
  const second = { ...createMemeCaptionZone(2, MEME_CAPTION_ZONE_PRESETS[4]), id: "other" };
  const parsed = parseMemeCaptionLayoutConfig({ version: 1, mode: "CUSTOM", zones: [first, second] });
  assert.ok(parsed);
  assert.equal(getStrongMemeCaptionZoneOverlaps([first, second]).length, 1);
});

test("empty author labels receive stable ordered defaults", () => {
  const zone = { ...createMemeCaptionZone(1), label: "" };
  const parsed = parseMemeCaptionLayoutConfig({ version: 1, mode: "CUSTOM", zones: [zone] });
  assert.equal(parsed?.mode === "CUSTOM" ? parsed.zones[0].label : null, "Text 1");
});
