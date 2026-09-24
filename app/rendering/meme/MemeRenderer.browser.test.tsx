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

import { MemeRenderer } from "./MemeRenderer";
import { resolveMemeCaptionLayout, type ResolvedMemeCaptionLayout } from "@/app/quiz/memeCaptionZones";

const execFileAsync = promisify(execFile);
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;

type Scenario = {
  topText: string;
  bottomText: string;
  image: string;
  fits: boolean;
  captions?: Record<string, string>;
  layout?: ResolvedMemeCaptionLayout;
};

const scenarios = new Map<string, Scenario>([
  ["/image", { topText: "", bottomText: "", image: "/wide.svg", fits: true }],
  ["/top", { topText: "Wenn Montag wäre", bottomText: "", image: "/wide.svg", fits: true }],
  ["/bottom", { topText: "", bottomText: "Ich aber schon Freitag fühle", image: "/portrait.svg", fits: true }],
  ["/both", { topText: "Quizmaster: ganz einfach", bottomText: "Die Teams nach Frage eins", image: "/wide.svg", fits: true }],
  ["/wrapped", { topText: "Wenn der Quizmaster sagt, diese Runde wird wirklich ganz einfach", bottomText: "Fünf große Boxkämpfer jagen Österreich quer über Sylt", image: "/portrait.svg", fits: true }],
  ["/max-length", { topText: "W".repeat(80), bottomText: "M".repeat(80), image: "/wide.svg", fits: true }],
  ["/zones", {
    topText: "", bottomText: "", image: "/wide.svg", fits: true,
    captions: { left: "Linkes Panel", right: "Rechtes Panel" },
    layout: resolveMemeCaptionLayout({ version: 1, mode: "CUSTOM", zones: [
      { id: "left", label: "Links", placement: "IMAGE", x: 4, y: 8, width: 42, height: 32, order: 1, maxLines: 2, required: false },
      { id: "right", label: "Rechts", placement: "IMAGE", x: 54, y: 58, width: 42, height: 32, order: 2, maxLines: 2, required: false },
    ] }),
  }],
  ["/two-people", {
    topText: "", bottomText: "", image: "/wide.svg", fits: true,
    captions: { "person-left": "Ich habe eine Idee", "person-right": "Das wird lustig" },
    layout: resolveMemeCaptionLayout({ version: 1, mode: "CUSTOM", zones: [
      { id: "person-left", label: "Person links", placement: "IMAGE", x: 3, y: 5, width: 44, height: 28, order: 1, maxLines: 2, required: false },
      { id: "person-right", label: "Person rechts", placement: "IMAGE", x: 53, y: 5, width: 44, height: 28, order: 2, maxLines: 2, required: false },
    ] }),
  }],
  ["/two-panels", {
    topText: "", bottomText: "", image: "/wide.svg", fits: true,
    captions: { "panel-one": "Vor dem PubQuiz", "panel-two": "Nach der letzten Runde" },
    layout: resolveMemeCaptionLayout({ version: 1, mode: "CUSTOM", zones: [
      { id: "panel-one", label: "Panel eins", placement: "IMAGE", x: 4, y: 64, width: 43, height: 30, order: 1, maxLines: 2, required: false },
      { id: "panel-two", label: "Panel zwei", placement: "IMAGE", x: 53, y: 64, width: 43, height: 30, order: 2, maxLines: 2, required: false },
    ] }),
  }],
  ["/small-label", {
    topText: "", bottomText: "", image: "/portrait.svg", fits: true,
    captions: { label: "Plot Twist" },
    layout: resolveMemeCaptionLayout({ version: 1, mode: "CUSTOM", zones: [
      { id: "label", label: "Kleine Sprechblase", placement: "IMAGE", x: 58, y: 12, width: 30, height: 20, order: 1, maxLines: 1, required: false },
    ] }),
  }],
  ["/four-zones", {
    topText: "", bottomText: "", image: "/wide.svg", fits: true,
    captions: { a: "Eins", b: "Zwei", c: "Drei", d: "Vier" },
    layout: resolveMemeCaptionLayout({ version: 1, mode: "CUSTOM", zones: [
      { id: "a", label: "Oben links", placement: "IMAGE", x: 3, y: 4, width: 44, height: 25, order: 1, maxLines: 1, required: false },
      { id: "b", label: "Oben rechts", placement: "IMAGE", x: 53, y: 4, width: 44, height: 25, order: 2, maxLines: 1, required: false },
      { id: "c", label: "Unten links", placement: "IMAGE", x: 3, y: 71, width: 44, height: 25, order: 3, maxLines: 1, required: false },
      { id: "d", label: "Unten rechts", placement: "IMAGE", x: 53, y: 71, width: 44, height: 25, order: 4, maxLines: 1, required: false },
    ] }),
  }],
] as const);

function chromeExecutable() {
  const executable = [
    process.env.CHROME_BIN,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter((value): value is string => Boolean(value)).find(existsSync);
  assert.ok(executable, "Chrome/Chromium is required for the AP5 layout regression");
  return executable;
}

async function applicationCss() {
  const globalsUrl = new URL("../../globals.css", import.meta.url);
  const globals = readFileSync(globalsUrl, "utf8")
    .replace(
      '@import "./rendering/presentation/presentationReadability.css";',
      readFileSync(new URL("../presentation/presentationReadability.css", import.meta.url), "utf8"),
    )
    .replace(
      '@import "./rendering/presentation/bookingSlide.css";',
      readFileSync(new URL("../presentation/bookingSlide.css", import.meta.url), "utf8"),
    );
  return (await postcss([tailwindcss()]).process(globals, {
    from: fileURLToPath(globalsUrl),
  })).css;
}

function pageHtml(
  scenario: Scenario,
  css: string,
) {
  const markup = renderToStaticMarkup(createElement(MemeRenderer, {
    imageUrl: scenario.image,
    topText: scenario.topText,
    bottomText: scenario.bottomText,
    captions: scenario.captions,
    layout: scenario.layout,
    alt: "Testmotiv",
  }));
  const script = String.raw`
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { clientWidth: element.clientWidth, clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight,
        left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))).then(() => {
      const figure = document.querySelector('[data-meme-renderer]');
      const image = document.querySelector('[data-meme-image]');
      const captions = [...document.querySelectorAll('[data-meme-caption]')].map((caption) => {
        const text = caption.querySelector('[data-auto-fit-text]');
        return { position: caption.dataset.memeCaption, fit: caption.dataset.memeCaptionFit,
          caption: box(caption), text: box(text) };
      });
      document.querySelector('#result').textContent = JSON.stringify({
        viewport: { width: innerWidth, height: innerHeight },
        figure: box(figure), image: box(image), captions,
      });
    });
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="m-0 bg-slate-900"><main style="width:min(calc(100vw - 32px), 960px);margin:16px auto">${markup}</main><pre id="result"></pre><script>${script}</script></body></html>`;
}

function decode(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

test("AP5 standard and AP6 zone layouts stay readable from mobile to projection", async () => {
  const chrome = chromeExecutable();
  const css = await applicationCss();
  const wide = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600"><rect width="1600" height="600" fill="#334155"/></svg>';
  const portrait = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1200"><rect width="600" height="1200" fill="#475569"/></svg>';
  const server = createServer((request, response) => {
    if (request.url === "/wide.svg" || request.url === "/portrait.svg") {
      response.writeHead(200, { "Content-Type": "image/svg+xml" }).end(
        request.url === "/wide.svg" ? wide : portrait,
      );
      return;
    }
    const scenario = scenarios.get(request.url ?? "");
    if (!scenario) return void response.writeHead(404).end("Not found");
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(pageHtml(scenario, css));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const profile = mkdtempSync(join(tmpdir(), "pubquiz-meme-ap5-layout-"));

  try {
    for (const viewport of viewports) {
      for (const [path, scenario] of scenarios) {
        const { stdout } = await execFileAsync(chrome, [
          "--headless=new", "--no-sandbox", "--disable-gpu",
          "--disable-dev-shm-usage", "--disable-background-networking",
          "--no-first-run", "--force-device-scale-factor=1",
          `--window-size=${viewport.width},${viewport.height}`,
          `--user-data-dir=${profile}`, "--virtual-time-budget=1000", "--dump-dom",
          `http://127.0.0.1:${address.port}${path}`,
        ], { maxBuffer: 12 * 1024 * 1024, timeout: 30_000 });
        const match = stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
        assert.ok(match?.[1], `No AP5 layout result for ${path}`);
        const measured = JSON.parse(decode(match[1])) as {
          figure: { clientWidth: number; clientHeight: number; scrollWidth: number; scrollHeight: number };
          image: { clientHeight: number; top: number; bottom: number };
          captions: Array<{
            position: string;
            fit: string;
            caption: { clientWidth: number; clientHeight: number; top: number; bottom: number };
            text: { clientWidth: number; clientHeight: number; scrollWidth: number; scrollHeight: number };
          }>;
        };

        assert.ok(measured.figure.scrollWidth <= measured.figure.clientWidth + 1, `${path} horizontal overflow at ${viewport.width}`);
        assert.ok(measured.figure.scrollHeight <= measured.figure.clientHeight + 1, `${path} vertical overflow at ${viewport.width}`);
        assert.equal(measured.captions.length, scenario.captions
          ? Object.values(scenario.captions).filter(Boolean).length
          : Number(Boolean(scenario.topText)) + Number(Boolean(scenario.bottomText)));

        if (scenario.fits) {
          for (const caption of measured.captions) {
            assert.equal(caption.fit, "true", `${path} fit flag at ${viewport.width}`);
            assert.ok(caption.text.scrollWidth <= caption.text.clientWidth + 1, `${path} text width at ${viewport.width}`);
            assert.ok(caption.text.scrollHeight <= caption.caption.clientHeight + 1, `${path} text height at ${viewport.width}`);
            if (caption.position === "top") assert.ok(caption.caption.bottom <= measured.image.top + 1);
            if (caption.position === "bottom") assert.ok(caption.caption.top >= measured.image.bottom - 1);
          }
        } else {
          assert.ok(measured.captions.some((caption) => caption.fit === "false"), `${path} rejected at ${viewport.width}`);
        }

        const expectedImageShare = scenario.topText && scenario.bottomText ? 0.57
          : scenario.topText || scenario.bottomText ? 0.78
            : 0.99;
        assert.ok(
          measured.image.clientHeight >= measured.figure.clientHeight * expectedImageShare,
          `${path} preserves image priority at ${viewport.width}`,
        );
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    rmSync(profile, { recursive: true, force: true });
  }
});
