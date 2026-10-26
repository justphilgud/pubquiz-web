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
import { AuthCard } from "@/components/ui/AuthCard";
import { Button } from "@/components/ui/Button";
import { FaceMorphSolutionSlide } from "./FaceMorphSolutionSlide";
import { MemeRenderer } from "../meme/MemeRenderer";
import { QuizThemeScope } from "../theme/QuizThemeScope";
import { resolveMemeCaptionLayout } from "@/app/quiz/memeCaptionZones";
import { buildPresentationQualityFixture } from "./presentationQualityFixtures";
import type { PresentationDesignStyle } from "../templateRegistry";

const execFileAsync = promisify(execFile);
type QualityStyle = PresentationDesignStyle | "PHIL_GUD";
const styles: readonly QualityStyle[] = [
  "PHIL_GUD",
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
  return `${compiled.css}\n${kommOne}\n${readFileSync(new URL("../../branding/philGud.css", import.meta.url), "utf8")}`;
}

function renderCases(style: QualityStyle) {
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
  const login = `<section data-admin-ui="phil-gud" data-login-case>${renderToStaticMarkup(createElement(AuthCard, { title: "Quizverwaltung", appearance: "brand", children: createElement(Button, { type: "submit" }, "Einloggen") }))}</section>`;
  // Use the production grid/column classes, whose automatic minimum width can
  // otherwise force even a correctly scaled triptych beyond a mobile screen.
  const moderation = readFileSync(new URL("../../quiz/[quizId]/moderation/ModerationClient.tsx", import.meta.url), "utf8");
  const grid = moderation.match(/className="(grid min-h-0 flex-1[^\"]+)"/)?.[1];
  const column = moderation.match(/<section className="(flex min-h-0[^\"]+)"/)?.[1];
  assert.ok(grid && column);
  const narrowModeration = `<div data-moderation-narrow style="width:390px;padding:12px"><div class="${grid}"><section class="${column}"><div class="min-w-0 rounded-2xl border p-4"><div data-preview-host class="flex w-full justify-center"><div data-preview-frame class="overflow-hidden"><div data-preview-canvas style="width:1600px;height:900px;transform-origin:top left"><div style="width:1600px;height:900px">${renderToStaticMarkup(createElement(FaceMorphSolutionSlide, {
    personA: { src: null, name: "Alexandra Maximiliane Testperson A" }, morphSrc: null,
    personB: { src: null, name: "Benedikt Konstantin Testperson B" },
  }))}</div></div></div></div></div><div style="width:490px;max-width:100%">Moderation controls</div></section><aside>Navigation</aside></div></div>`;
  const script = String.raw`
    try {
    const mobile = document.querySelector('[data-moderation-narrow]');
    const host = mobile.querySelector('[data-preview-host]');
    const frame = mobile.querySelector('[data-preview-frame]');
    const canvas = mobile.querySelector('[data-preview-canvas]');
    frame.style.width = host.clientWidth + 'px';
    frame.style.height = host.clientWidth * 9 / 16 + 'px';
    canvas.style.transform = 'scale(' + host.clientWidth / 1600 + ')';
    const edge = mobile.getBoundingClientRect().right;
    const portraits = [...mobile.querySelectorAll('[data-facemorph-role]')];
    if (host.getBoundingClientRect().right > edge || portraits.some(p => p.getBoundingClientRect().right > edge)) throw new Error('Moderation mobile preview clips a portrait');
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
    const login = document.querySelector('[data-login-case]');
    const cta = login.querySelector('button');
    results.push(check('brand-login', 'CTA text', cta, cta, 4.5));
    results.push({ caseName: 'brand-login', label: 'CTA against dark card', foreground: effectiveBackground(cta), background: 'rgb(0, 0, 0)', minimum: 3, ratio: ratio(effectiveBackground(cta), 'rgb(0, 0, 0)') });
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
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}.case{width:1280px;height:720px;overflow:hidden;background:#000;padding:16px}</style></head><body>${login}${narrowModeration}${markup}<pre id="contrast-result"></pre><script>${script}</script></body></html>`;
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

test("choices remain readable and image choices coexist after container resize", async () => {
  const css = await compileApplicationCss();
  const markup = styles.flatMap(style => (["choice4", "choice-long", "image-choice", "image-choice-solution"] as const).map(scenario =>
    `<section data-readability-case="${style}-${scenario}" style="width:1280px;height:720px;padding:16px;box-sizing:border-box">${renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture(scenario, style)))}</section>`,
  )).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${markup}<pre id="readability-result"></pre><script>
  try {
    const results=[];
    for(const root of document.querySelectorAll('[data-readability-case]')) {
      for(const width of [1280,1920,1600,1280]) {
        root.style.width=width+'px';root.style.height=width*9/16+'px';
        const question=root.querySelector('.presentation-question-card h2, .presentation-storybook-question h2');
        const options=[...root.querySelectorAll('.presentation-answer-option, .presentation-solution-option, .presentation-storybook-choices li, .presentation-storybook-solution-choices li')];
        if(options.length!==4) throw Error(root.dataset.readabilityCase+': missing choices '+options.length);
        for(const option of options) {
          if(option.scrollWidth>option.clientWidth+2 || option.scrollHeight>option.clientHeight+2) throw Error(root.dataset.readabilityCase+': clipped option at '+width);
        }
        const bounds=root.getBoundingClientRect();
        if(root.dataset.readabilityCase.endsWith('-image-choice')) {
          const image=root.querySelector('.presentation-media img, [data-presentation-layout] img');
          if(!image || image.getBoundingClientRect().width<20 || image.getBoundingClientRect().height<20) throw Error(root.dataset.readabilityCase+': missing image at '+width);
          for(const option of options) {const box=option.getBoundingClientRect();if(box.right>bounds.right+2 || box.bottom>bounds.bottom+2) throw Error(root.dataset.readabilityCase+': image choices outside viewport at '+width+' '+JSON.stringify({bounds:bounds.toJSON(),box:box.toJSON(),font:getComputedStyle(option).fontSize}));}
        }
        results.push({name:root.dataset.readabilityCase,width,font:parseFloat(getComputedStyle(options[0].querySelector('strong')??options[0]).fontSize),question:question?parseFloat(getComputedStyle(question).fontSize):null});
      }
    }
    document.querySelector('#readability-result').textContent=JSON.stringify(results);
  }catch(error){document.querySelector('#readability-result').textContent=JSON.stringify({error:String(error)});}
  </script></body></html>`;
  const server = createServer((_request, response) => { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(html); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const profile = mkdtempSync(join(tmpdir(), "pubquiz-readability-"));
  try {
    const { stdout } = await execFileAsync(resolveChromeExecutable(), ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", "--no-first-run", `--user-data-dir=${profile}`, "--virtual-time-budget=3000", "--dump-dom", `http://127.0.0.1:${address.port}`], { maxBuffer: 30 * 1024 * 1024, timeout: 30_000 });
    const match = stdout.match(/<pre id="readability-result">([\s\S]*?)<\/pre>/);
    assert.ok(match?.[1]);
    const result = JSON.parse(decodeHtml(match[1])) as { error: string } | Array<{ name: string; width: number; font: number; question: number | null }>;
    assert.ok(Array.isArray(result), "error" in result ? result.error : "Missing measurements");
    assert.equal(result.length, styles.length * 4 * 4);
    for (const entry of result.filter(entry => entry.name.endsWith("-choice4"))) {
      assert.ok(entry.font >= 28, `${entry.name}: expected larger answers, got ${entry.font}px`);
      if (entry.width === 1280 && entry.question !== null) assert.ok(entry.question > 32, "Laptop question text must not retain the old fixed 2rem cap");
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    rmSync(profile, { recursive: true, force: true });
  }
});

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
    assert.equal(results.length, styles.length * 8 + 2);
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
