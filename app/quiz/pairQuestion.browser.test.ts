import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

type ProtocolResult = { targetId?: string; sessionId?: string; result?: { value?: unknown }; exceptionDetails?: unknown };

test("pair editing, mouse and touch matching, reload, locks and presentation fit", { timeout: 45_000 }, async () => {
  const chrome = [process.env.CHROME_BIN, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium"].find((path) => path && existsSync(path));
  assert.ok(chrome, "Chrome required");
  const entry = String.raw`
    import React, { useState } from "react";
    import { createRoot } from "react-dom/client";
    import { flushSync } from "react-dom";
    import { PairsEditor } from "./app/fragen/editor/components/PairsEditor";
    import { PairsAnswer } from "./app/quiz/[quizId]/antworten/PairsAnswer";
    import { PairsSlide } from "./app/rendering/presentation/PairsSlide";
    import { pairColumns, defaultPairs } from "./app/fragen/editor/templates/pairsTemplate";
    const root = createRoot(document.getElementById("root"));
    const data = JSON.parse(sessionStorage.getItem("fixture") || "null") ?? { kind: "PAIRS", pairs: Array.from({ length: 7 }, (_, index) => ({
      leftId: crypto.randomUUID(), rightId: crypto.randomUUID(),
      left: "Links " + index + " – Ein längerer Begriff mit mehreren Wörtern zum Testen des Zeilenumbruchs",
      right: "Rechts " + index + " – Ein längerer Begriff mit mehreren Wörtern zum Testen des Zeilenumbruchs",
    })) };
    sessionStorage.setItem("fixture", JSON.stringify(data));
    function Editor() {
      const [value, set] = useState(defaultPairs);
      return <PairsEditor data={value} disabled={false} onChange={set} />;
    }
    function Answer({ disabled }) {
      const [value, set] = useState(() => sessionStorage.getItem("matches"));
      return <PairsAnswer {...pairColumns(data)} value={value} disabled={disabled}
        onChange={next => { sessionStorage.setItem("matches", next); set(next); }} />;
    }
    window.show = (surface, flag = false) => flushSync(() => {
      root.render(surface === "editor" ? <Editor /> : surface === "answer"
        ? <Answer disabled={flag} /> : <PairsSlide data={data} question="Welche Begriffe gehören zusammen?" reveal={flag} />);
    });
    window.matches = () => JSON.parse(sessionStorage.getItem("matches") || "[]");
    window.show("answer");
  `;
  const [{ outputFiles }, css] = await Promise.all([
    build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "tsx" },
      bundle: true, platform: "browser", write: false, jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' } }),
    postcss([tailwindcss()]).process('@import "tailwindcss";', { from: resolve("app/globals.css") }),
  ]);
  const server = createServer((request, response) => {
    if (request.url === "/bundle.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(outputFiles[0].contents);
    } else if (request.url === "/style.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css.css);
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root" style="height:100dvh"></div><script src="/bundle.js"></script>');
    }
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const profile = mkdtempSync(join(tmpdir(), "pubquiz-pairs-"));
  const browser = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking",
    "--no-first-run", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
  let socket: WebSocket | undefined;
  try {
    const portFile = join(profile, "DevToolsActivePort");
    for (let attempt = 0; attempt < 200 && !existsSync(portFile); attempt++) await delay(50);
    const [port, endpoint] = readFileSync(portFile, "utf8").trim().split(/\r?\n/);
    const ws = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
    socket = ws;
    await new Promise<void>((ready, reject) => {
      ws.onopen = () => ready();
      ws.onerror = () => reject(new Error("Chrome debug connection failed"));
    });
    let id = 0;
    const pending = new Map<number, { resolve: (result: ProtocolResult) => void; reject: (error: Error) => void }>();
    ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request?.reject(new Error(message.error.message));
      else request?.resolve(message.result);
    };
    function call(method: string, params: object, sessionId?: string) {
      return new Promise<ProtocolResult>((resolve, reject) => {
        const next = ++id;
        pending.set(next, { resolve, reject });
        ws.send(JSON.stringify({ id: next, method, params, sessionId }));
      });
    }
    const { targetId } = await call("Target.createTarget", { url });
    const { sessionId } = await call("Target.attachToTarget", { targetId, flatten: true });
    async function evaluate<T = unknown>(expression: string) {
      const result = await call("Runtime.evaluate", { expression, returnByValue: true }, sessionId);
      assert.equal(result.exceptionDetails, undefined, expression);
      return result.result?.value as T;
    }
    async function loaded() {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate("typeof window.show === 'function'")) return;
        await delay(50);
      }
      assert.fail("Fixture did not load");
    }
    await loaded();
    const button = (column: number, index: number) =>
      `document.querySelectorAll('[data-answer-interaction] [aria-label$="Begriffe"]')[${column}].querySelectorAll('button')[${index}]`;
    async function point(column: number, index: number) {
      return evaluate<{ x: number; y: number }>(`(() => {
        const r = ${button(column, index)}.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()`);
    }
    async function drag(touch: boolean, targetIndex: number) {
      const from = await point(0, 0);
      const to = await point(1, targetIndex);
      const move = { x: from.x + 12, y: from.y };
      if (touch) {
        await call("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] }, sessionId);
        await call("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [move] }, sessionId);
        await delay(60);
        await call("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [to] }, sessionId);
        await delay(60);
        await call("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
      } else {
        await call("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...from }, sessionId);
        await call("Input.dispatchMouseEvent", { type: "mouseMoved", buttons: 1, ...move }, sessionId);
        await delay(60);
        await call("Input.dispatchMouseEvent", { type: "mouseMoved", buttons: 1, ...to }, sessionId);
        await delay(60);
        await call("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...to }, sessionId);
      }
      await delay(80);
    }

    await drag(false, 0);
    const saved = await evaluate<string[][]>("window.matches()");
    assert.equal(saved.length, 1, "mouse drag");
    await evaluate("delete window.show");
    await call("Page.reload", {}, sessionId);
    await loaded();
    assert.deepEqual(await evaluate("window.matches()"), saved);
    assert.match(await evaluate<string>(`${button(1, 0)}.textContent`), /Zugeordnet/);

    await call("Emulation.setDeviceMetricsOverride", { width: 360, height: 740, deviceScaleFactor: 1, mobile: true }, sessionId);
    await call("Emulation.setTouchEmulationEnabled", { enabled: true }, sessionId);
    await drag(true, 1);
    const moved = await evaluate<string[][]>("window.matches()");
    assert.equal(moved.length, 1, "one-to-one touch reassignment");
    assert.notEqual(moved[0][1], saved[0][1]);
    await evaluate(`${button(1, 1)}.click()`);
    assert.deepEqual(await evaluate("window.matches()"), []);
    await evaluate(`window.show("answer", true); ${button(0, 0)}.click(); ${button(1, 0)}.click()`);
    assert.equal(await evaluate("document.querySelectorAll('[data-answer-interaction] button:disabled').length"), 14);
    assert.equal(await evaluate("document.documentElement.scrollWidth"), 360);

    await evaluate('window.show("editor")');
    for (let index = 0; index < 5; index++) {
      await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent === "Paar hinzufügen").click()');
    }
    assert.equal(await evaluate("document.querySelectorAll('fieldset').length"), 7);
    await evaluate('document.querySelector("fieldset button").click()');
    assert.equal(await evaluate("document.querySelectorAll('fieldset').length"), 6);

    for (const [width, height] of [[1280, 600], [1920, 1080]]) {
      await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
      for (const reveal of [false, true]) {
        await evaluate(`window.show("slide", ${reveal})`);
        const fit = await evaluate<boolean>(`(() => {
          const slide = document.querySelector('[data-pairs-slide]');
          return slide.scrollHeight <= slide.clientHeight && slide.scrollWidth <= slide.clientWidth &&
            [...slide.querySelectorAll('span')].every(span => span.getBoundingClientRect().bottom <= slide.getBoundingClientRect().bottom);
        })()`);
        assert.ok(fit, `${width}×${height}, reveal=${reveal}`);
        assert.equal(await evaluate("document.querySelectorAll('[data-pairs-slide] span').length"), 14);
      }
    }
  } finally {
    socket?.close();
    if (browser.exitCode === null && browser.pid) {
      browser.kill();
      await new Promise<void>((done) => browser.once("exit", () => done()));
    }
    await new Promise<void>((done) => server.close(() => done()));
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
