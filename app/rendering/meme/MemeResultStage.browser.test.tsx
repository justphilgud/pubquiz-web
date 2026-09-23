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

import type { MemeResultSnapshot } from "@/app/quiz/memeResults.server";
import { MemeResultStage } from "./MemeResultStage";

const execFileAsync = promisify(execFile);
const viewports = [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }] as const;

function chromeExecutable() {
  const executable = [
    process.env.CHROME_BIN,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter((value): value is string => Boolean(value)).find(existsSync);
  assert.ok(executable, "Chrome/Chromium is required for the AP4 layout regression");
  return executable;
}

async function applicationCss() {
  const globalsUrl = new URL("../../globals.css", import.meta.url);
  const globals = readFileSync(globalsUrl, "utf8")
    .replace('@import "./rendering/presentation/presentationReadability.css";', readFileSync(new URL("../presentation/presentationReadability.css", import.meta.url), "utf8"))
    .replace('@import "./rendering/presentation/bookingSlide.css";', readFileSync(new URL("../presentation/bookingSlide.css", import.meta.url), "utf8"));
  return (await postcss([tailwindcss()]).process(globals, { from: fileURLToPath(globalsUrl) })).css;
}

function result(count: number): MemeResultSnapshot {
  return {
    presentationId: 1,
    quizFragenId: 2,
    finalizedAt: "2026-09-23T21:00:00.000Z",
    revision: 1,
    totalVotes: count,
    maximumVotes: 2,
    pageCount: Math.max(1, Math.ceil(count / 4)),
    entries: Array.from({ length: count }, (_, index) => ({
      candidateId: index + 1,
      number: index + 1,
      topText: `Ein oberer Meme-Text ${index + 1}`,
      bottomText: `Ein unterer Meme-Text ${index + 1}`,
      teamName: `Das sehr lesbare Testteam ${index + 1}`,
      avatarCode: "teekanne",
      photoUrl: null,
      voteCount: index === 0 ? 2 : 1,
      share: index === 0 ? 50 : 25,
      isWinner: index === 0,
      awardedPoints: index === 0 ? 1 : 0,
    })),
  };
}

function html(snapshot: MemeResultSnapshot, revealCount: number, css: string) {
  const markup = renderToStaticMarkup(createElement(MemeResultStage, { result: snapshot, imageUrl: "/meme.svg", revealCount }));
  const script = String.raw`
    const box = (element) => { const rect = element.getBoundingClientRect(); return {
      clientWidth: element.clientWidth, clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight,
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }; };
    Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))).then(() => {
      const stage = document.querySelector('[data-meme-result-stage]');
      document.querySelector('#result').textContent = JSON.stringify({
        viewport: { width: innerWidth, height: innerHeight }, stage: box(stage),
        items: [...stage.querySelectorAll('[data-meme-result-entry]')].map(box),
        winnerLabels: [...stage.querySelectorAll('[data-meme-result-winner]')].map(box),
      });
    });`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="m-0"><main style="width:100vw;height:100vh;overflow:hidden;background:#09090b"><div style="height:108px"></div><div style="height:calc(100vh - 108px)">${markup}</div></main><pre id="result"></pre><script>${script}</script></body></html>`;
}

function decode(value: string) {
  return value.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

test("AP4 result pages fit at 1280x720 and larger with one, four and eight candidates", async () => {
  const chrome = chromeExecutable();
  const css = await applicationCss();
  const scenarios = new Map([
    ["/one", { result: result(1), page: 1, count: 1 }],
    ["/four", { result: result(4), page: 1, count: 4 }],
    ["/eight-last", { result: result(8), page: 2, count: 4 }],
  ]);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#334155"/></svg>';
  const server = createServer((request, response) => {
    if (request.url === "/meme.svg") return void response.writeHead(200, { "Content-Type": "image/svg+xml" }).end(svg);
    const scenario = scenarios.get(request.url ?? "");
    if (!scenario) return void response.writeHead(404).end("Not found");
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html(scenario.result, scenario.page, css));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const profile = mkdtempSync(join(tmpdir(), "pubquiz-meme-ap4-layout-"));
  try {
    for (const viewport of viewports) {
      for (const [path, scenario] of scenarios) {
        let requested: { width: number; height: number } = { ...viewport };
        let measured: {
          viewport: { width: number; height: number };
          stage: { clientWidth: number; clientHeight: number; scrollWidth: number; scrollHeight: number };
          items: Array<{ left: number; top: number; right: number; bottom: number }>;
          winnerLabels: Array<{ left: number; top: number; right: number; bottom: number; clientWidth: number; clientHeight: number }>;
        } | null = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const { stdout } = await execFileAsync(chrome, [
            "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
            "--disable-background-networking", "--no-first-run", "--force-device-scale-factor=1",
            `--window-size=${requested.width},${requested.height}`, `--user-data-dir=${profile}`,
            "--virtual-time-budget=2000", "--dump-dom", `http://127.0.0.1:${address.port}${path}`,
          ], { maxBuffer: 15 * 1024 * 1024, timeout: 30_000 });
          const match = stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
          assert.ok(match?.[1], `No AP4 layout result for ${path}`);
          measured = JSON.parse(decode(match[1]));
          if (measured!.viewport.width === viewport.width && measured!.viewport.height === viewport.height) break;
          requested = {
            width: requested.width + viewport.width - measured!.viewport.width,
            height: requested.height + viewport.height - measured!.viewport.height,
          };
        }
        assert.ok(measured);
        assert.deepEqual(measured.viewport, viewport);
        assert.equal(measured.items.length, scenario.count);
        assert.ok(measured.stage.scrollWidth <= measured.stage.clientWidth + 2, `${path} horizontal overflow`);
        assert.ok(measured.stage.scrollHeight <= measured.stage.clientHeight + 2, `${path} vertical overflow`);
        for (const item of measured.items) {
          assert.ok(item.left >= -1 && item.top >= -1, `${path} escapes top/left`);
          assert.ok(item.right <= viewport.width + 1 && item.bottom <= viewport.height + 1, `${path} escapes viewport`);
        }
        const expectedWinnerLabels = scenario.page === 1 ? 1 : 0;
        assert.equal(measured.winnerLabels.length, expectedWinnerLabels, `${path} winner-label count`);
        if (expectedWinnerLabels === 1) {
          const winnerEntry = measured.items[0];
          const winnerLabel = measured.winnerLabels[0];
          assert.ok(winnerLabel.clientWidth > 0 && winnerLabel.clientHeight > 0, `${path} winner label has no size`);
          assert.ok(winnerLabel.left >= winnerEntry.left && winnerLabel.right <= winnerEntry.right + 1, `${path} winner label escapes horizontally`);
          assert.ok(winnerLabel.top >= winnerEntry.top && winnerLabel.bottom <= winnerEntry.bottom + 1, `${path} winner label is clipped vertically`);
        }
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    rmSync(profile, { recursive: true, force: true });
  }
});
