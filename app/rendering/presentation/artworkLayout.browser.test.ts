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
import {
  buildPresentationQualityFixture,
  type QualityScenario,
} from "./presentationQualityFixtures";

const execFileAsync = promisify(execFile);
const viewport: { width: number; height: number } = { width: 1280, height: 720 };
const artworkSvg = readFileSync(
  new URL("../../../public/medien/artwork-layout-test.svg", import.meta.url),
  "utf8",
);

type LayoutMeasurement = {
  viewport: typeof viewport;
  question: string;
  overflowHintVisible: boolean;
  contentViewport: BoxMeasurement;
  contentInner: BoxMeasurement;
  layout: BoxMeasurement;
  questionCard: BoxMeasurement;
  questionText: BoxMeasurement & { text: string };
  mediaCard: BoxMeasurement;
  image: BoxMeasurement & {
    complete: boolean;
    naturalWidth: number;
    naturalHeight: number;
    objectFit: string;
    objectPosition: string;
    containedWidth: number;
    containedHeight: number;
  };
};

type BoxMeasurement = {
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

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
  assert.ok(executable, "Chrome/Chromium is required for the 1280x720 layout regression");
  return executable;
}

async function compileApplicationCss() {
  const globalsUrl = new URL("../../globals.css", import.meta.url);
  const readability = readFileSync(
    new URL("./presentationReadability.css", import.meta.url),
    "utf8",
  );
  const booking = readFileSync(new URL("./bookingSlide.css", import.meta.url), "utf8");
  const globals = readFileSync(globalsUrl, "utf8")
    .replace('@import "./rendering/presentation/presentationReadability.css";', readability)
    .replace('@import "./rendering/presentation/bookingSlide.css";', booking);
  return (await postcss([tailwindcss()]).process(globals, { from: fileURLToPath(globalsUrl) })).css;
}

function renderFixturePage(scenario: Extract<QualityScenario, "artwork" | "artwork-long">, css: string) {
  const fixture = buildPresentationQualityFixture(scenario, "EDITORIAL");
  assert.equal(fixture.slide.typ, "frage");
  const markup = renderToStaticMarkup(createElement(PresentationSlideRenderer, fixture));
  const expectedQuestion = fixture.slide.frage.frage;
  const measurementScript = String.raw`
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    };
    const run = async () => {
      await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
      await new Promise((resolve) => setTimeout(resolve, 100));
      const contentViewport = document.querySelector('.presentation-content-viewport');
      const contentInner = document.querySelector('.presentation-content-inner');
      const layout = document.querySelector('[data-presentation-layout="MEDIA_FOCUS"][data-question-template="kunstwerk"]');
      const questionCard = layout.querySelector('.presentation-question-card');
      const questionText = questionCard.querySelector('h2');
      const mediaCard = layout.querySelector('.presentation-media-card');
      const image = mediaCard.querySelector('img');
      const hint = document.querySelector('.presentation-overflow-hint');
      const imageStyle = getComputedStyle(image);
      const imageBox = box(image);
      const naturalRatio = image.naturalWidth / image.naturalHeight;
      const containedWidth = Math.min(imageBox.clientWidth, imageBox.clientHeight * naturalRatio);
      const containedHeight = containedWidth / naturalRatio;
      const result = {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        question: ${JSON.stringify(expectedQuestion)},
        overflowHintVisible: getComputedStyle(hint).visibility !== 'hidden',
        contentViewport: box(contentViewport),
        contentInner: box(contentInner),
        layout: box(layout),
        questionCard: box(questionCard),
        questionText: { ...box(questionText), text: questionText.textContent },
        mediaCard: box(mediaCard),
        image: {
          ...imageBox,
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          objectFit: imageStyle.objectFit,
          objectPosition: imageStyle.objectPosition,
          containedWidth,
          containedHeight,
        },
      };
      document.querySelector('#layout-result').textContent = JSON.stringify(result);
    };
    run().catch((error) => {
      document.querySelector('#layout-result').textContent = JSON.stringify({ error: String(error?.stack || error) });
    });
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><main class="h-dvh overflow-hidden bg-black p-4">${markup}</main><pre id="layout-result"></pre><script>${measurementScript}</script></body></html>`;
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function assertNoOverflow(name: string, box: BoxMeasurement) {
  assert.ok(
    box.scrollWidth <= box.clientWidth + 2,
    `${name} overflows horizontally: ${box.scrollWidth} > ${box.clientWidth}`,
  );
  assert.ok(
    box.scrollHeight <= box.clientHeight + 2,
    `${name} overflows vertically: ${box.scrollHeight} > ${box.clientHeight}`,
  );
}

function assertContained(name: string, child: BoxMeasurement, parent: BoxMeasurement) {
  assert.ok(child.left >= parent.left - 1, `${name} escapes on the left`);
  assert.ok(child.top >= parent.top - 1, `${name} escapes at the top`);
  assert.ok(child.right <= parent.right + 1, `${name} escapes on the right`);
  assert.ok(child.bottom <= parent.bottom + 1, `${name} escapes at the bottom`);
}

function verifyLayout(result: LayoutMeasurement, expectedQuestion: string) {
  assert.deepEqual(result.viewport, viewport);
  assert.equal(result.question, expectedQuestion);
  assert.equal(result.questionText.text, expectedQuestion);
  assert.equal(result.overflowHintVisible, false);
  assertNoOverflow("presentation viewport", result.contentViewport);
  assertNoOverflow("presentation content", result.contentInner);
  assertNoOverflow("artwork layout", result.layout);
  assertNoOverflow("question card", result.questionCard);
  assertNoOverflow("question text", result.questionText);
  assertContained("question text", result.questionText, result.questionCard);
  assertContained("artwork layout", result.layout, result.contentViewport);
  assertContained("artwork image", result.image, result.mediaCard);
  assert.equal(result.image.complete, true);
  assert.equal(result.image.naturalWidth, 1920);
  assert.equal(result.image.naturalHeight, 2869);
  assert.equal(result.image.objectFit, "contain");
  assert.ok(result.image.containedWidth > 0);
  assert.ok(result.image.containedHeight > 0);
  assert.ok(result.image.containedWidth <= result.image.clientWidth + 1);
  assert.ok(result.image.containedHeight <= result.image.clientHeight + 1);
}

test("artwork questions fit completely in a real 1280x720 browser viewport", async () => {
  const chrome = resolveChromeExecutable();
  const css = await compileApplicationCss();
  const pages = new Map<string, { html: string; question: string }>();
  for (const scenario of ["artwork", "artwork-long"] as const) {
    const fixture = buildPresentationQualityFixture(scenario, "EDITORIAL");
    assert.equal(fixture.slide.typ, "frage");
    pages.set(`/${scenario}`, {
      html: renderFixturePage(scenario, css),
      question: fixture.slide.frage.frage,
    });
  }

  const server = createServer((request, response) => {
    if (request.url === "/medien/artwork-layout-test.svg") {
      response.writeHead(200, { "Content-Type": "image/svg+xml" });
      response.end(artworkSvg);
      return;
    }
    const page = pages.get(request.url ?? "");
    if (!page) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(page.html);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const profile = mkdtempSync(join(tmpdir(), "pubquiz-artwork-layout-"));

  try {
    for (const [path, page] of pages) {
      let windowSize = { ...viewport };
      let parsed: (LayoutMeasurement & { error?: string }) | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { stdout } = await execFileAsync(chrome, [
          "--headless=new",
          "--no-sandbox",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-background-networking",
          "--no-first-run",
          "--no-default-browser-check",
          "--force-device-scale-factor=1",
          `--window-size=${windowSize.width},${windowSize.height}`,
          "--window-position=0,0",
          `--user-data-dir=${profile}`,
          "--virtual-time-budget=3000",
          "--dump-dom",
          `http://127.0.0.1:${address.port}${path}`,
        ], { maxBuffer: 15 * 1024 * 1024, timeout: 30_000 });
        const match = stdout.match(/<pre id="layout-result">([\s\S]*?)<\/pre>/);
        assert.ok(match, `Chrome did not return a layout result for ${path}`);
        assert.ok(match[1], `Chrome returned an empty layout result for ${path}: ${stdout.slice(-2000)}`);
        parsed = JSON.parse(decodeHtml(match[1])) as LayoutMeasurement & { error?: string };
        assert.equal(parsed.error, undefined, parsed.error);
        if (parsed.viewport.width === viewport.width && parsed.viewport.height === viewport.height) break;
        windowSize = {
          width: windowSize.width + viewport.width - parsed.viewport.width,
          height: windowSize.height + viewport.height - parsed.viewport.height,
        };
      }
      assert.ok(parsed);
      verifyLayout(parsed, page.question);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    rmSync(profile, { recursive: true, force: true });
  }
});
