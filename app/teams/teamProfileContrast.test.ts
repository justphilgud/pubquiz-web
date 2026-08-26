import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editor = readFileSync("app/teams/TeamProfileEditor.tsx", "utf8");
const styles = readFileSync("app/globals.css", "utf8");

function luminance(hex: string) {
  const values = hex.match(/[a-f\d]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  return values.reduce((sum, channel, index) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("mobile team profile uses explicit light-surface UI colors and interaction states", () => {
  assert.match(editor, /answer-team-profile/);
  assert.match(editor, /answer-ui-control/);
  assert.match(editor, /answer-ui-muted/);
  assert.match(editor, /bg-white[^\n]+text-slate-950/);
  assert.match(editor, /border-slate-500[^\n]+text-slate-950[^\n]+hover:bg-slate-100[^\n]+active:bg-slate-200/);
  assert.match(editor, /focus-visible:ring-2[^\n]+disabled:text-slate-400/);
  assert.match(editor, /role=\{message\.kind === "ERROR" \? "alert" : "status"\}/);
  assert.doesNotMatch(editor, /var\(--(?:quiz|brand)-text\)/);
});

test("answer form CSS maps LOVD and team profile surfaces to semantic UI tokens", () => {
  assert.match(
    styles,
    /\.answer-template\s*\{[\s\S]*?background:\s*var\(--quiz-ui-background\);[\s\S]*?color:\s*var\(--quiz-ui-text\);/,
  );
  assert.match(
    styles,
    /\.answer-template\[data-design-style="EDITORIAL"\] \[class\*="text-slate"\][\s\S]*?color:\s*var\(--quiz-ui-text\)\s*!important;/,
  );
  assert.doesNotMatch(
    styles,
    /\.answer-template\[data-design-style="EDITORIAL"\] \[class\*="text-slate"\][\s\S]{0,160}var\(--brand-text\)/,
  );
  assert.match(
    styles,
    /\.answer-team-profile \.answer-ui-control\s*\{[\s\S]*?border-color:\s*var\(--quiz-ui-border\)/,
  );
});

test("selected team profile colors meet their WCAG contrast targets", () => {
  assert.ok(contrast("020617", "ffffff") >= 4.5, "slate-950 text on white");
  assert.ok(contrast("475569", "ffffff") >= 4.5, "slate-600 secondary text on white");
  assert.ok(contrast("64748b", "ffffff") >= 3, "slate-500 control border on white");
  assert.ok(contrast("991b1b", "fef2f2") >= 4.5, "red-800 errors on red-50");
});
