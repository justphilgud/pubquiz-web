import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PresentationSlideRenderer from "./PresentationSlideRenderer";
import { buildPresentationQualityFixture } from "./presentationQualityFixtures";
import type { PresentationDesignStyle } from "../templateRegistry";

const execFileAsync = promisify(execFile);
const styles: readonly PresentationDesignStyle[] = [
  "NEON",
  "EDITORIAL",
  "KOMM_ONE",
  "BIRTHDAY",
  "CORPORATE",
];

function resolveChromeExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((candidate): candidate is string => Boolean(candidate));
  const executable = candidates.find((candidate) => existsSync(candidate));
  assert.ok(executable, "Chrome/Chromium is required for presentation contrast regression");
  return executable;
}

async function compileApplicationCss() {
  const globalsUrl = new URL("../../globals.css", import.meta.url);
  const readability = readFileSync(new URL("./presentationReadability.css", import.meta.url), "utf8");
  const booking = readFileSync(new URL("./bookingSlide.css", import.meta.url), "utf8");
  const kommOne = readFileSync(new URL("./kommOnePresentation.css", import.meta.url), "utf8");
  const globals = readFileSync(globalsUrl, "utf8")
    .replace('@import "./rendering/presentation/presentationReadability.css";', readability)
    .replace('@import "./rendering/presentation/bookingSlide.css";', booking);
  const compiled = await postcss([tailwindcss()]).process(globals, { from: fileURLToPath(globalsUrl) });
  return `${compiled.css}\n${kommOne}`;
}

function renderCases(style: PresentationDesignStyle) {
  const meme = buildPresentationQualityFixture("normal", style);
  assert.equal(meme.slide.typ, "frage");
  if (meme.slide.typ !== "frage") return "";
  meme.slide.frage.templateId = "meme_beschriften";
  meme.slide.frage.medien = [];
  meme.slide.frage.bildMedien = [];
  meme.displayState.memeState = {
    state: "OPEN",
    timerEnabled: true,
    deadlineAt: new Date(meme.displayState.now + 60_000).toISOString(),
    responseDurationSeconds: 60,
    maxPresentedMemes: 4,
  };

  const liveText = buildPresentationQualityFixture("normal", style);
  liveText.displayState.liveResultState = {
    kind: "TEXT",
    visible: true,
    state: "CLOSED",
    finalAnswers: 2,
    totalTeams: 3,
    publicResponses: [
      { submissionId: 1, publicText: "Eine gut lesbare offene Antwort" },
      { submissionId: 2, publicText: "Noch eine veröffentlichte Teamantwort" },
    ],
  };

  const trueFalse = buildPresentationQualityFixture("true-false", style);
  const qr = buildPresentationQualityFixture("qr", style);
  qr.displayState.teamJoinState = { teams: [], totalTeams: 0, remainingTeams: 0 };
  return [
    ["meme", renderToStaticMarkup(createElement(PresentationSlideRenderer, meme))],
    ["live-text", renderToStaticMarkup(createElement(PresentationSlideRenderer, liveText))],
    ["true-false", renderToStaticMarkup(createElement(PresentationSlideRenderer, trueFalse))],
    ...(style === "KOMM_ONE" ? [
      ["explanation", renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("meme-explanation", style)))],
      ["solution-true", renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("true-false-solution-true", style)))],
      ["solution-false", renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("true-false-solution-false", style)))],
      ["long-live-text", renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("live-text-long", style)))],
      ["poll-text", renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("poll-text", style)))],
      ["flow-rules", renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("rules", style)))],
      ["flow-qr", renderToStaticMarkup(createElement(PresentationSlideRenderer, qr))],
      ["flow-story", renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("story", style)))],
      ["overflow", renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("legacy", style)))],
      ["extra-ranking", renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("lovd-ranking", style)))],
      ["extra-final", renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("lovd-final", style)))],
      ["extra-structured", renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("structured-empty", style)))],
      ["extra-source", renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("solution-long", style)))],
    ] : []),
  ].map(([name, markup]) => `<section data-case="${style}-${name}" class="case">${markup}</section>`).join("");
}

function renderPage(css: string, width: number, height: number) {
  const markup = styles.map(renderCases).join("");
  const script = String.raw`
    try {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = (value) => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
    const rgb = (value) => rgba(value).slice(0, 3);
    const luminance = (value) => rgb(value).map((part) => part / 255).map((part) => part <= .04045 ? part / 12.92 : ((part + .055) / 1.055) ** 2.4).reduce((sum, part, index) => sum + part * [.2126, .7152, .0722][index], 0);
    const ratio = (foreground, background) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (values[0] + .05) / (values[1] + .05);
    };
    const effectiveBackground = (node) => {
      const ancestors = []; for (let current = node; current; current = current.parentElement) ancestors.unshift(current);
      let result = [255, 255, 255];
      for (const current of ancestors) { const color = rgba(getComputedStyle(current).backgroundColor); const alpha = color[3] / 255; result = result.map((part, index) => color[index] * alpha + part * (1 - alpha)); }
      return 'rgb(' + result.join(',') + ')';
    };
    const check = (caseName, label, foregroundNode, backgroundNode, minimum) => {
      const background = effectiveBackground(backgroundNode);
      const color = rgba(getComputedStyle(foregroundNode).color);
      const behind = rgb(background); const alpha = color[3] / 255;
      const foreground = 'rgb(' + color.slice(0, 3).map((part, index) => part * alpha + behind[index] * (1 - alpha)).join(',') + ')';
      return { caseName, label, foreground, background, minimum, ratio: ratio(foreground, background) };
    };
    const results = [];
    for (const root of document.querySelectorAll('[data-case]')) {
      const name = root.dataset.case;
      if (name.includes('-extra-')) {
        const selectors = name.endsWith('-ranking') ? '.presentation-flow-kicker, .presentation-flow-ranking-list li > span:last-child' : name.endsWith('-final') ? '.presentation-ranking-table-place, .presentation-ranking-table-points' : name.endsWith('-structured') ? '[data-presentation-layout="STRUCTURED_RESPONSE"] [class*="text-pink"], [data-presentation-layout="STRUCTURED_RESPONSE"] [class*="text-cyan"], [data-presentation-layout="STRUCTURED_RESPONSE"] [class*="text-white/55"]' : '.presentation-solution-question [class*="text-white/50"]';
        for (const node of root.querySelectorAll(selectors)) results.push(check(name, node.textContent, node, node, 4.5));
      } else if (name.endsWith('-overflow')) {
        const node = root.querySelector('.presentation-overflow-hint');
        results.push(check(name, node.textContent, node, node, 4.5));
      } else if (name.includes('-flow-')) {
        for (const node of root.querySelectorAll('.presentation-flow-kicker, .presentation-flow-lead, .presentation-team-join-heading, .presentation-team-join-empty')) results.push(check(name, node.textContent, node, node, 4.5));
      } else if (name.endsWith('-meme')) {
        const aside = root.querySelector('[data-question-template="meme_beschriften"] aside');
        results.push(check(name, 'meme status', aside.querySelector('strong'), aside, 3));
        results.push(check(name, 'meme timer label', aside.querySelector('p:last-child'), aside, 4.5));
      } else if (name.endsWith('-explanation')) {
        const panel = root.querySelector('[data-slide-type="meme-explanation"]');
        for (const node of panel.querySelectorAll('h1, p, li, span')) results.push(check(name, node.textContent, node, node, node.tagName === 'H1' || node.tagName === 'LI' ? 3 : 4.5));
      } else if (name.endsWith('-poll-text')) {
        for (const card of root.querySelectorAll('.presentation-live-poll-wall article')) results.push(check(name, card.textContent, card, card, 4.5));
      } else if (name.includes('-solution-')) {
        const options = [...root.querySelectorAll('.presentation-true-false-option')];
        for (const option of options) results.push(check(name, option.textContent, option, option, 4.5));
        const correct = options.find(node => node.dataset.correct === 'true');
        const neutral = options.find(node => node.dataset.correct === 'false');
        if (getComputedStyle(correct).backgroundColor === getComputedStyle(neutral).backgroundColor) throw new Error('Correct answer needs a distinct full background');
      } else if (name.endsWith('-live-text')) {
        const panel = root.querySelector('[data-live-result-kind="text"]');
        results.push(check(name, 'open result title', panel.querySelector('h2'), panel, 3));
        results.push(check(name, 'open result label', panel.querySelector('p'), panel, 4.5));
        for (const card of panel.querySelectorAll('article')) results.push(check(name, 'open response card', card, card, 4.5));
      } else {
        const option = root.querySelector('.presentation-true-false-option, .presentation-storybook-choices--binary li');
        results.push(check(name, 'neutral true/false option', option, option, 3));
      }
    }
    document.querySelector('#contrast-result').textContent = JSON.stringify(results);
    } catch (error) {
      document.querySelector('#contrast-result').textContent = JSON.stringify({ error: String(error?.stack || error) });
    }
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}.case{width:${width}px;height:${height}px;overflow:hidden;background:#000;padding:16px}</style></head><body>${markup}<pre id="contrast-result"></pre><script>${script}</script></body></html>`;
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

for (const [width, height] of [[1280, 720], [1920, 1080]]) test(`meme, live responses and true/false meet browser contrast targets at ${width}×${height}`, async () => {
  const chrome = resolveChromeExecutable();
  const html = renderPage(await compileApplicationCss(), width, height);
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const profile = mkdtempSync(join(tmpdir(), "pubquiz-presentation-contrast-"));

  try {
    const { stdout } = await execFileAsync(chrome, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--no-first-run",
      "--no-default-browser-check",
      "--force-device-scale-factor=1",
      `--window-size=${width},${height}`,
      `--user-data-dir=${profile}`,
      "--virtual-time-budget=3000",
      "--dump-dom",
      `http://127.0.0.1:${address.port}`,
    ], { maxBuffer: 20 * 1024 * 1024, timeout: 30_000 });
    const match = stdout.match(/<pre id="contrast-result">([\s\S]*?)<\/pre>/);
    assert.ok(match?.[1], "Chrome did not return contrast measurements");
    const parsed = JSON.parse(decodeHtml(match[1])) as { error?: string } | Array<{
      caseName: string;
      label: string;
      foreground: string;
      background: string;
      minimum: number;
      ratio: number;
    }>;
    assert.ok(Array.isArray(parsed), "error" in parsed ? parsed.error : "Unexpected contrast result");
    const results = parsed;
    assert.equal(results.length, styles.length * 7 + 44);
    for (const result of results) {
      assert.ok(
        result.ratio >= result.minimum,
        `${result.caseName} ${result.label}: ${result.ratio.toFixed(2)} < ${result.minimum} (${result.foreground} on ${result.background})`,
      );
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    rmSync(profile, { recursive: true, force: true });
  }
});
