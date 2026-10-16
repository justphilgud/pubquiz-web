import assert from "node:assert/strict";
/* eslint-disable react/no-children-prop -- Typed SSR theme fixtures require children in the props object. */
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
import { FaceMorphSolutionSlide } from "./FaceMorphSolutionSlide";
import { MemeRenderer } from "../meme/MemeRenderer";
import { QuizThemeScope } from "../theme/QuizThemeScope";
import { resolveMemeCaptionLayout } from "@/app/quiz/memeCaptionZones";
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
  return [
    ["facemorph", renderToStaticMarkup(createElement(QuizThemeScope, { theme: meme.theme, className: "presentation-template", children: [1280, 360].map(width => createElement("div", { key: width, style: { width, height: width * 9 / 16 - 16 } }, createElement(FaceMorphSolutionSlide, {
      personA: { src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='300'%3E%3Crect width='100' height='300' fill='blue'/%3E%3C/svg%3E", name: "Alexandra Elisabeth von Beispiel mit einem langen Namen" },
      morphSrc: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200'%3E%3Crect width='300' height='200' fill='purple'/%3E%3C/svg%3E",
      personB: { src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='100'%3E%3Crect width='300' height='100' fill='green'/%3E%3C/svg%3E", name: "Christoph Ährenfeld mit einem ebenfalls längeren Familiennamen" },
    }))) }))],
    ["meme-captions", renderToStaticMarkup(createElement(QuizThemeScope, { theme: meme.theme, className: "presentation-template", children: createElement("div", { className: "presentation-solution-result" },
      createElement(MemeRenderer, { imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='400'%3E%3Crect width='800' height='400' fill='gray'/%3E%3C/svg%3E", alt: "QA", captions: { top: "ÄÖÜ oben", bottom: "Weiß auf Schwarz", overlay: "Freie Zone" }, layout: resolveMemeCaptionLayout({ version: 1, mode: "CUSTOM", zones: [
        { id: "top", label: "Oben", placement: "EXTERNAL_TOP", x: 0, y: 0, width: 100, height: 21, order: 1, maxLines: 2, required: false },
        { id: "bottom", label: "Unten", placement: "EXTERNAL_BOTTOM", x: 0, y: 79, width: 100, height: 21, order: 2, maxLines: 2, required: false },
        { id: "overlay", label: "Mitte", placement: "IMAGE", x: 10, y: 10, width: 80, height: 40, order: 3, maxLines: 2, required: false },
      ] }) })) }))],
    ["meme", renderToStaticMarkup(createElement(PresentationSlideRenderer, meme))],
    ["live-text", renderToStaticMarkup(createElement(PresentationSlideRenderer, liveText))],
    ["true-false", renderToStaticMarkup(createElement(PresentationSlideRenderer, trueFalse))],
  ].map(([name, markup]) => `<section data-case="${style}-${name}" class="case">${markup}</section>`).join("");
}

function renderPage(css: string) {
  const markup = styles.map(renderCases).join("");
  const script = String.raw`
    try {
    const rgb = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const luminance = (value) => rgb(value).map((part) => part / 255).map((part) => part <= .04045 ? part / 12.92 : ((part + .055) / 1.055) ** 2.4).reduce((sum, part, index) => sum + part * [.2126, .7152, .0722][index], 0);
    const ratio = (foreground, background) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (values[0] + .05) / (values[1] + .05);
    };
    const effectiveBackground = (node) => {
      for (let current = node; current; current = current.parentElement) {
        const background = getComputedStyle(current).backgroundColor;
        if (background !== 'transparent' && !/^rgba\(.*,[\s]*0\)$/.test(background)) return background;
      }
      return 'rgb(255, 255, 255)';
    };
    const check = (caseName, label, foregroundNode, backgroundNode, minimum) => {
      const foreground = getComputedStyle(foregroundNode).color;
      const background = effectiveBackground(backgroundNode);
      return { caseName, label, foreground, background, minimum, ratio: ratio(foreground, background) };
    };
    const results = [];
    for (const root of document.querySelectorAll('[data-case]')) {
      const name = root.dataset.case;
      if (name.endsWith('-facemorph')) {
        for (const layout of root.querySelectorAll('[data-facemorph-solution]')) {
          const portraits = [...layout.querySelectorAll('figure')];
          const bounds = layout.getBoundingClientRect();
          const boxes = portraits.map(p => p.getBoundingClientRect());
          if (!(boxes[0].left < boxes[1].left && boxes[1].left < boxes[2].left)) throw new Error(name + ' image order');
          for (const portrait of portraits) {
            const img = portrait.querySelector('img'); const caption = portrait.querySelector('figcaption');
            if (getComputedStyle(img).objectFit !== 'contain' || img.clientHeight < 40) throw new Error(name + ' cropped/empty image');
            if (caption.scrollHeight > caption.clientHeight + 1 || caption.scrollWidth > caption.clientWidth + 1 || portrait.getBoundingClientRect().bottom > bounds.bottom + 1) throw new Error(name + ' clipped caption');
          }
        }
        results.push({ caseName: name, label: 'triptych wide/narrow', foreground: '', background: '', minimum: 1, ratio: 1 });
      } else if (name.endsWith('-meme-captions')) {
        const canvas = root.querySelector('[data-meme-renderer]');
        for (const node of [canvas, canvas.querySelector('[data-meme-image]'), ...canvas.querySelectorAll('[data-meme-caption]:not([data-meme-caption-placement="IMAGE"])')]) {
          if (getComputedStyle(node).backgroundColor !== 'rgb(0, 0, 0)') throw new Error(name + ' incorrect black surface: ' + getComputedStyle(node).backgroundColor);
        }
        for (const caption of canvas.querySelectorAll('[data-meme-caption]')) {
          if (getComputedStyle(caption).color !== 'rgb(255, 255, 255)') throw new Error(name + ' incorrect caption color');
        }
        const overlay = canvas.querySelector('[data-meme-caption-placement="IMAGE"]');
        if (!['rgba(0, 0, 0, 0.55)', 'oklab(0 0 0 / 0.55)'].includes(getComputedStyle(overlay).backgroundColor)) throw new Error(name + ' incorrect overlay alpha: ' + getComputedStyle(overlay).backgroundColor);
        results.push(check(name, 'caption', canvas.querySelector('[data-meme-caption]'), canvas, 20));
      } else if (name.endsWith('-meme')) {
        const aside = root.querySelector('[data-question-template="meme_beschriften"] aside');
        results.push(check(name, 'meme status', aside.querySelector('strong'), aside, 3));
        results.push(check(name, 'meme timer label', aside.querySelector('p:last-child'), aside, 4.5));
      } else if (name.endsWith('-live-text')) {
        const panel = root.querySelector('[data-live-result-kind="text"]');
        results.push(check(name, 'open result title', panel.querySelector('h2'), panel, 3));
        results.push(check(name, 'open result label', panel.querySelector('p'), panel, 4.5));
        const card = panel.querySelector('article');
        results.push(check(name, 'open response card', card, card, 4.5));
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
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}.case{width:1280px;height:720px;overflow:hidden;background:#000;padding:16px}</style></head><body>${markup}<pre id="contrast-result"></pre><script>${script}</script></body></html>`;
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

test("meme, open result and neutral true/false text meet contrast targets in a real browser", async () => {
  const chrome = resolveChromeExecutable();
  const html = renderPage(await compileApplicationCss());
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
      "--window-size=1280,720",
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
    assert.equal(results.length, styles.length * 8);
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
