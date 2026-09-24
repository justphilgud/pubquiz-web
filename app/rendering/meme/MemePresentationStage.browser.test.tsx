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

import type { MemePresentationSnapshot } from "@/app/quiz/memeVoting.server";
import { MemePresentationStage } from "./MemePresentationStage";

const execFileAsync = promisify(execFile);
const viewports = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;

function resolveChromeExecutable() {
  const executable = [
    process.env.CHROME_BIN,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter((value): value is string => Boolean(value)).find(existsSync);
  assert.ok(executable, "Chrome/Chromium is required for the AP3 layout regression");
  return executable;
}

async function compileApplicationCss() {
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

function state(
  phase: "PRESENTING" | "OVERVIEW",
  candidateCount: number,
  overviewPage: number,
): MemePresentationSnapshot {
  return {
    phase,
    presentationId: 1,
    selectionId: 1,
    quizFragenId: 1,
    revision: 1,
    imageUrl: "/meme.svg",
    candidates: Array.from({ length: candidateCount }, (_, index) => ({
      candidateId: index + 1,
      number: index + 1,
      topText: "W".repeat(80),
      bottomText: "M".repeat(80),
    })),
    activeCandidateNumber: phase === "PRESENTING" ? 1 : null,
    overviewPage,
    overviewPageCount: Math.max(1, Math.ceil(candidateCount / 4)),
    votingOpenedAt: null,
    votingClosedAt: null,
    progress: null,
    result: null,
    team: null,
  };
}

function pageHtml(snapshot: MemePresentationSnapshot, css: string) {
  const markup = renderToStaticMarkup(createElement(MemePresentationStage, { state: snapshot }));
  const script = String.raw`
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { clientWidth: element.clientWidth, clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight,
        left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))).then(() => {
      const section = document.querySelector('[data-meme-presentation-phase]');
      const result = {
        viewport: { width: innerWidth, height: innerHeight },
        section: box(section),
        items: [...section.querySelectorAll('article, figure')].map(box),
        articleCount: section.querySelectorAll('article').length,
        captions: [...section.querySelectorAll('[data-meme-caption]')].map((caption) => ({
          box: box(caption),
          figure: box(caption.closest('figure')),
        })),
      };
      document.querySelector('#result').textContent = JSON.stringify(result);
    });
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="m-0"><main style="width:100vw;height:100vh;overflow:hidden;background:#09090b">${markup}</main><pre id="result"></pre><script>${script}</script></body></html>`;
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

test("AP3 meme presentation fits single and paginated overview at 1280x720 and larger", async () => {
  const chrome = resolveChromeExecutable();
  const css = await compileApplicationCss();
  const scenarios = new Map([
    ["/single", { state: state("PRESENTING", 1, 0), articles: 0 }],
    ["/one", { state: state("OVERVIEW", 1, 0), articles: 1 }],
    ["/two", { state: state("OVERVIEW", 2, 0), articles: 2 }],
    ["/four", { state: state("OVERVIEW", 4, 0), articles: 4 }],
    ["/eight-last", { state: state("OVERVIEW", 8, 1), articles: 4 }],
    ["/eleven-last", { state: state("OVERVIEW", 11, 2), articles: 3 }],
  ]);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#334155"/></svg>';
  const server = createServer((request, response) => {
    if (request.url === "/meme.svg") {
      response.writeHead(200, { "Content-Type": "image/svg+xml" }).end(svg);
      return;
    }
    const scenario = scenarios.get(request.url ?? "");
    if (!scenario) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(pageHtml(scenario.state, css));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const profile = mkdtempSync(join(tmpdir(), "pubquiz-meme-ap3-layout-"));
  try {
    for (const viewport of viewports) {
      for (const [path, scenario] of scenarios) {
        let requested: { width: number; height: number } = { ...viewport };
        let result: {
          viewport: { width: number; height: number };
          section: { clientWidth: number; clientHeight: number; scrollWidth: number; scrollHeight: number };
          items: Array<{ left: number; top: number; right: number; bottom: number }>;
          articleCount: number;
          captions: Array<{
            box: { clientWidth: number; clientHeight: number; scrollWidth: number; scrollHeight: number; left: number; top: number; right: number; bottom: number };
            figure: { left: number; top: number; right: number; bottom: number };
          }>;
        } | null = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const { stdout } = await execFileAsync(chrome, [
            "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
            "--disable-background-networking", "--no-first-run", "--force-device-scale-factor=1",
            `--window-size=${requested.width},${requested.height}`, `--user-data-dir=${profile}`,
            "--virtual-time-budget=2000", "--dump-dom",
            `http://127.0.0.1:${address.port}${path}`,
          ], { maxBuffer: 15 * 1024 * 1024, timeout: 30_000 });
          const match = stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
          assert.ok(match?.[1], `No AP3 layout result for ${path}`);
          result = JSON.parse(decodeHtml(match[1]));
          if (result!.viewport.width === viewport.width && result!.viewport.height === viewport.height) break;
          requested = {
            width: requested.width + viewport.width - result!.viewport.width,
            height: requested.height + viewport.height - result!.viewport.height,
          };
        }
        assert.ok(result);
        assert.deepEqual(result.viewport, viewport);
        assert.equal(result.articleCount, scenario.articles);
        assert.ok(result.section.scrollWidth <= result.section.clientWidth + 2, `${path} horizontal overflow`);
        assert.ok(result.section.scrollHeight <= result.section.clientHeight + 2, `${path} vertical overflow`);
        for (const item of result.items) {
          assert.ok(item.left >= -1 && item.top >= -1, `${path} escapes top/left`);
          assert.ok(item.right <= viewport.width + 1 && item.bottom <= viewport.height + 1, `${path} escapes viewport`);
        }
        for (const caption of result.captions) {
          assert.ok(caption.box.scrollWidth <= caption.box.clientWidth + 2, `${path} caption horizontal overflow`);
          assert.ok(caption.box.left >= caption.figure.left - 1 && caption.box.right <= caption.figure.right + 1, `${path} caption escapes figure horizontally`);
          assert.ok(caption.box.top >= caption.figure.top - 1 && caption.box.bottom <= caption.figure.bottom + 1, `${path} caption escapes figure vertically`);
        }
        for (let index = 0; index < result.captions.length; index += 2) {
          const top = result.captions[index];
          const bottom = result.captions[index + 1];
          assert.ok(top && bottom && top.box.bottom <= bottom.box.top + 1, `${path} top and bottom captions overlap`);
        }
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    rmSync(profile, { recursive: true, force: true });
  }
});
