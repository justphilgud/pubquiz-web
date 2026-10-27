import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const origin = process.env.BINGO_LIVE_REVIEW_URL || "http://localhost:3063";
const target = new URL(origin);
if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.protocol !== "http:") throw Error("This automated workflow accepts only the own local isolated review server");
const accounts = JSON.parse(fs.readFileSync(process.env.BINGO_LIVE_ACCOUNTS_FILE || ".env.bingo-ap3-v2-accounts.json"));
if (!accounts.every(a => /^bingo\.ap3\.(admin|manager|editor)@example\.invalid$/.test(a.email))) throw Error("Synthetic AP3 accounts required");
const seed = JSON.parse(fs.readFileSync(process.env.BINGO_LIVE_SEED_FILE || ".artifacts/bingo-ap3/seed-v2.json"));
assert.equal(seed.database, process.env.BINGO_LIVE_DATABASE || "bingo_live_review_20261027b");
const fixture = seed.results[1], acceptance = seed.results[0];
const output = path.resolve(".artifacts/bingo-ap3/browser");
fs.mkdirSync(output, { recursive: true });
const chrome = [process.env.CHROME_BIN, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(p => p && fs.existsSync(p));
assert.ok(chrome);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "bingo-ap3-browser-"));
const browser = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
let ws, nextId = 0, dialog = false;
const pending = new Map(), delay = ms => new Promise(r => setTimeout(r, ms));
async function until(f, message, timeout = 45000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await f()) return; await delay(80); } throw Error(message); }
function call(method, params = {}, sessionId) { return new Promise((resolve, reject) => { const id = ++nextId, timer = setTimeout(() => { pending.delete(id); reject(Error("CDP timeout: " + method)); }, 20000); pending.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } }); ws.send(JSON.stringify({ id, method, params, sessionId })); }); }
async function evaluate(s, expression) { const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, s); if (r.exceptionDetails) throw Error(r.exceptionDetails.text); return r.result?.value; }
async function tab(url, context) { const { targetId } = await call("Target.createTarget", { url, browserContextId: context }); const { sessionId } = await call("Target.attachToTarget", { targetId, flatten: true }); await call("Page.enable", {}, sessionId); return sessionId; }
async function goto(s, relative) { await call("Page.navigate", { url: origin + relative }, s); await until(() => evaluate(s, 'document.readyState==="complete"'), "page loaded"); }
async function text(s) { return evaluate(s, "document.body.innerText"); }
async function button(s, label, last = false) {
  await until(() => evaluate(s, `(()=>{const a=[...document.querySelectorAll('button')].filter(e=>e.textContent.trim()===${JSON.stringify(label)});const b=a[${last ? "a.length-1" : "0"}];return !!b&&!b.disabled})()`), "button available: " + label);
  await evaluate(s, `(()=>{const a=[...document.querySelectorAll('button')].filter(e=>e.textContent.trim()===${JSON.stringify(label)});a[${last ? "a.length-1" : "0"}].click()})()`);
}
async function set(s, label, value) {
  const selector = label.startsWith("[") ? `document.querySelector(${JSON.stringify(label)})` : `[...document.querySelectorAll('label')].filter(l=>l.textContent.trim().startsWith(${JSON.stringify(label)})).at(${label === "Begründung der Entscheidung" ? -1 : 0})?.querySelector('input,select')`;
  await until(() => evaluate(s, `(()=>{const e=${selector};return !!e&&!e.disabled})()`), "input enabled: " + label);
  await evaluate(s, `(()=>{const e=${selector},p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  await delay(40);
}
async function login(s, account) { await goto(s, "/login"); await set(s, "[name=email]", account.email); await set(s, "[name=password]", account.password); await button(s, "Einloggen"); await until(() => evaluate(s, 'location.pathname!=="/login"'), "fresh login"); }
const revision = s => evaluate(s, 'Number(document.querySelector("[data-revision]")?.dataset.revision??-1)');
async function write(s, label, last = false) { const before = await revision(s); await button(s, label, last); await until(async () => await revision(s) > before, "persisted command: " + label); }
async function screenshot(s, name, width, height) {
  await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 }, s);
  await evaluate(s, "document.fonts.ready");
  await until(() => evaluate(s, '[...document.images].every(image=>image.complete&&image.naturalWidth>0)'), name + " original images loaded");
  await delay(180);
  assert.equal(await evaluate(s, "document.documentElement.scrollWidth<=innerWidth"), true, name + " horizontal overflow");
  const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, s);
  fs.writeFileSync(path.join(output, name + ".png"), Buffer.from(shot.data, "base64"));
}
(async () => {
  await until(() => fs.existsSync(path.join(profile, "DevToolsActivePort")), "Chrome startup");
  const [port, endpoint] = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").trim().split(/\r?\n/);
  ws = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = e => { const m = JSON.parse(String(e.data)); if (m.method === "Page.javascriptDialogOpening") { dialog = true; void call("Page.handleJavaScriptDialog", { accept: false }, m.sessionId); } if (!m.id) return; const p = pending.get(m.id); pending.delete(m.id); if (m.error) p?.reject(Error(m.error.message)); else p?.resolve(m.result || {}); };
  const context = (await call("Target.createBrowserContext")).browserContextId, mod = await tab(origin + "/login", context);
  await login(mod, accounts.find(a => a.id === 1));
  await goto(mod, `/bingo/${fixture.gameId}/moderation`);
  await until(async () => /Neuen Durchlauf starten/.test(await text(mod)), "unstarted fixture");
  const audiencePath = await evaluate(mod, '[...document.querySelectorAll("a")].find(a=>a.textContent==="Präsentation vorab öffnen").getAttribute("href")');
  const audience = await tab(origin + audiencePath, context);
  await until(() => evaluate(audience, '!!document.querySelector("[data-status]")'), "presentation before start");
  const beforeStartRevision = await revision(mod), beforeStartId = await evaluate(mod, 'document.querySelector("[data-run-id]")?.dataset.runId??null');
  await set(mod, "Vorbereitete Runde", fixture.roundId); await button(mod, "Durchlauf bewusst starten"); await button(mod, "Abbrechen");
  assert.equal(await revision(mod), beforeStartRevision, "cancelled start does not create a run");
  assert.equal(await evaluate(mod, 'document.querySelector("[data-run-id]")?.dataset.runId??null'), beforeStartId);
  await button(mod, "Durchlauf bewusst starten"); await button(mod, "Bestätigen");
  await until(async () => await revision(mod) === 0, "start persisted");
  await until(() => evaluate(audience, 'document.querySelector("[data-status]")?.dataset.status==="RUNNING"&&document.querySelector("[data-revision]")?.dataset.revision==="0"'), "preopened audience receives new run");
  await set(mod, "Physisch gezogene Zahl", "23"); dialog = false;
  await evaluate(mod, 'setTimeout(()=>[...document.querySelectorAll("a")].find(a=>a.textContent==="Zum Spiel").click(),0);true');
  await until(() => dialog, "native unsaved navigation dialog");
  assert.equal(await evaluate(mod, 'location.pathname.includes("/moderation")&&[...document.querySelectorAll("label")].find(l=>l.textContent.includes("Physisch gezogene Zahl")).querySelector("input").value==="23"'), true, "cancel preserves page and input");
  await set(mod, "Physisch gezogene Zahl", "0"); await button(mod, "Zahl prüfen");
  await until(async () => /ganze Zahl von 1 bis 75/.test(await text(mod)), "invalid number rejected");
  assert.equal(await revision(mod), 0);
  await set(mod, "Physisch gezogene Zahl", "");
  await write(mod, "Bingo-Ruf jetzt erfassen"); await set(mod, "Kartenkennung", fixture.shortCode); await write(mod, "Karte für diesen Ruf prüfen");
  await set(mod, "Begründung der Entscheidung", "Kein geometrischer Gewinn beim Ruf"); await button(mod, "Gewinn bestätigen");
  await until(async () => /zum Rufzeitpunkt nicht erfüllt/.test(await text(mod)), "invalid confirmation rejected");
  await write(mod, "Ruf ablehnen");
  async function draw(number) {
    await set(mod, "Physisch gezogene Zahl", number); await button(mod, "Zahl prüfen");
    await write(mod, "Zahl veröffentlichen");
    await until(() => evaluate(audience, `document.querySelector('[data-number="${number}"]')?.dataset.state==="current"`), "audience catches draw");
  }
  for (const [stage, code, numbers] of [["BINGO", fixture.shortCode, fixture.bingo], ["DOUBLE", fixture.fullCode, fixture.double], ["TRIPLE", fixture.cardId, fixture.triple]]) {
    for (const number of numbers) await draw(number);
    await set(mod, "Gerufene Stufe", stage); await write(mod, "Bingo-Ruf jetzt erfassen");
    await set(mod, "Kartenkennung", code); await write(mod, "Karte für diesen Ruf prüfen");
    await set(mod, "Begründung der Entscheidung", "Geometrisch geprüft: " + stage); await write(mod, "Gewinn bestätigen", true);
    if (stage === "BINGO") { await set(mod, "Ziehungsziel", 5); await write(mod, "Ziehungsziel ändern"); }
  }
  await set(mod, "Physisch gezogene Zahl", fixture.correction); await set(mod, "Begründung der Korrektur", "Letzte Kugel falsch erfasst");
  const beforeCorrection = await revision(mod); await button(mod, "Letzte Zahl korrigieren"); await button(mod, "Bestätigen");
  await until(async () => await revision(mod) > beforeCorrection, "correction persisted");
  await until(async () => /Nachprüfung erforderlich/.test(await text(audience)), "audience review marker");
  await set(mod, "Begründung der Entscheidung", "Triple ausdrücklich zurücknehmen"); await write(mod, "Bestätigung zurücknehmen", true);
  await write(mod, "Pause");
  assert.equal(await evaluate(mod, '[...document.querySelectorAll("button")].find(b=>b.textContent==="Zahl prüfen").disabled'), true);
  await set(mod, "Ziehungsziel", 50); await write(mod, "Ziehungsziel ändern");
  const pausedRevision = await revision(mod); await goto(mod, `/bingo/${fixture.gameId}/moderation`);
  await until(async () => await revision(mod) === pausedRevision, "reload preserves paused state and history");
  await write(mod, "Fortsetzen");
  await until(async () => await revision(audience) === await revision(mod), "synchronized screenshot state");
  await screenshot(mod, "moderation-laptop", 1366, 768); await screenshot(mod, "moderation-mobile", 390, 844);
  for (const [w, h] of [[1280, 600], [1366, 768], [1920, 1080]]) await screenshot(audience, `audience-${w}x${h}`, w, h);
  const philAudience = await tab(origin + `/bingo/${seed.results[2].gameId}/praesentation`, context);
  await until(() => evaluate(philAudience, 'document.querySelector("[data-status]")?.dataset.status==="ENDED"'), "separate completed Phil Gud presentation");
  for (const [w, h] of [[1280, 600], [1366, 768], [1920, 1080]]) {
    await screenshot(philAudience, `audience-phil-gud-${w}x${h}`, w, h);
    assert.equal(await evaluate(philAudience, 'document.querySelector("[data-fit]")?.dataset.fit==="fitted"&&document.querySelectorAll("[data-number]").length===75'), true);
  }
  await call("Network.enable", {}, audience); await call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, audience);
  await until(async () => /Verbindung unterbrochen/.test(await text(audience)), "actual audience outage");
  const oldRevision = await revision(audience);
  await set(mod, "Ziehungsziel", 60); await write(mod, "Ziehungsziel ändern");
  assert.equal(await revision(audience), oldRevision);
  await call("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, audience);
  await until(async () => await revision(audience) === await revision(mod), "actual audience reconnect");
  const endRevision = await revision(mod); await button(mod, "Durchlauf beenden"); await button(mod, "Bestätigen");
  await until(async () => await revision(mod) > endRevision, "end persisted");
  await goto(audience, audiencePath); await until(async () => /Beendet/.test(await text(audience)), "audience reload ended");
  await goto(mod, `/bingo/${fixture.gameId}/moderation`); await until(async () => /Runde 1 · Beendet/.test(await text(mod)), "moderation reload ended");
  assert.equal(await evaluate(mod, '[...document.querySelectorAll("button")].some(b=>b.textContent==="Fortsetzen")'), false);
  const managerContext = (await call("Target.createBrowserContext")).browserContextId, manager = await tab(origin + "/login", managerContext);
  await login(manager, accounts.find(a => a.id === 2)); await goto(manager, `/bingo/${acceptance.gameId}/moderation`);
  await until(async () => /Neuen Durchlauf starten/.test(await text(manager)), "manager authorized own series");
  await goto(manager, `/bingo/${fixture.gameId}/moderation`); await until(async () => /404|not be found|nicht gefunden/i.test(await text(manager)), "foreign series denied");
  const editorContext = (await call("Target.createBrowserContext")).browserContextId, editor = await tab(origin + "/login", editorContext);
  await login(editor, accounts.find(a => a.id === 3)); await goto(editor, `/bingo/${acceptance.gameId}/moderation`);
  await until(async () => /404|not be found|nicht gefunden/i.test(await text(editor)), "editor denied");
  await goto(mod, "/quiz"); await until(async () => /AP3 synthetische Quiz-Regression/.test(await text(mod)), "existing quiz administration");
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ origin, gameId: fixture.gameId, acceptanceGameId: acceptance.gameId, audiencePath, passed: ["fresh admin/manager/editor login", "cancel start without write", "native unsaved navigation cancellation", "manual preview/publish", "invalid call and 1/2/3 lines using all card identifiers", "last correction/review/revoke", "pause/target/resume/reload", "real network interruption and catchup", "explicit end and reload", "manager foreign-series and editor denial", "quiz regression", "1366x768/390x844 moderation and 1280x600/1366x768/1920x1080 audience"], productionChanged: false }, null, 2));
  console.info("AP3 actual local browser lifecycle, separated presentation, roles, native cancellation, reload and responsive checks: PASS");
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  if (ws?.readyState === 1) { await call("Browser.close").catch(() => {}); ws.close(); }
  browser.kill();
});
