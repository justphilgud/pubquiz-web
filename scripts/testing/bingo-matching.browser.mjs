import { matchingLiveBrowser } from './bingo-matching-live.browser.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
const hosted = process.argv.includes('--hosted'), origin = hosted ? 'https://pubquiz-web-git-codex-bingo-matching-table-just-phil-gud.vercel.app' : 'http://localhost:3058', kind = hosted ? 'hosted' : 'local', fixture = JSON.parse(fs.readFileSync(`.artifacts/matching-${kind}-fixture.json`)), accounts = JSON.parse(fs.readFileSync('.env.bingo-matching-accounts.json'));
if (!accounts.every(a => /^matching\.[a-z]+@example\.invalid$/.test(a.email)))
    throw Error('SYNTHETIC_ACCOUNTS_ONLY');
const out = path.resolve(`.artifacts/bingo-matching-${kind}`);
fs.mkdirSync(out, { recursive: true });
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
if (!chrome)
    throw Error('CHROME_REQUIRED');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bingo-matching-browser-')), browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0, dialog = false, allowNavigation = false;
const requests = new Map(), passed = [];
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(f, m, timeout = 60000) { const end = Date.now() + timeout; while (Date.now() < end) {
    if (await f())
        return;
    await delay(120);
} throw Error(m); }
function call(method, params = {}, sessionId) { return new Promise((resolve, reject) => { const key = ++id, timer = setTimeout(() => { requests.delete(key); reject(Error('CDP timeout ' + method)); }, 30000); requests.set(key, { resolve: r => { clearTimeout(timer); resolve(r); }, reject: e => { clearTimeout(timer); reject(e); } }); ws.send(JSON.stringify({ id: key, method, params, sessionId })); }); }
async function evaluate(s, expression) { const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, s); if (r.exceptionDetails)
    throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; }
async function tab(context) { const t = await call('Target.createTarget', { url: 'about:blank', browserContextId: context }); const s = (await call('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId; await call('Page.enable', {}, s); return s; }
async function goto(s, p) { const token = 'navigation-' + Date.now() + '-' + Math.random(); await evaluate(s, 'window.__matchingNavigationToken=' + JSON.stringify(token)); allowNavigation = true; try {
    await call('Page.navigate', { url: origin + p }, s);
    await until(() => evaluate(s, 'window.__matchingNavigationToken!==' + JSON.stringify(token) + '&&document.readyState==="complete"'), 'new document ready');
}
finally {
    allowNavigation = false;
} }
async function query(s, selector, tail = '') { return evaluate(s, 'document.querySelector(' + JSON.stringify(selector) + ')' + tail); }
async function text(s) { return evaluate(s, 'document.body?.innerText??""'); }
async function button(s, label) { await until(() => evaluate(s, `[...(document.querySelector('[role=dialog]')??document).querySelectorAll('button')].some(e=>(e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)})&&!e.disabled)`), 'button ready ' + label); await evaluate(s, `(()=>{const e=[...(document.querySelector('[role=dialog]')??document).querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)});if(!e||e.disabled)throw Error('Unavailable button '+${JSON.stringify(label)});e.click()})()`); await delay(100); }
async function set(s, selector, value) { await until(() => query(s, selector, "!==null"), "input ready " + selector); await evaluate(s, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`); await delay(120); }
async function selectLabel(s, label, value) { await evaluate(s, `(()=>{const label=[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)})),e=label?.querySelector('select');if(!e)throw Error('Missing dialog select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('change',{bubbles:true}))})()`); await delay(150); }
async function check(s, selector, checked) { await evaluate(s, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing checkbox');if(e.checked!==${checked})e.click()})()`); await delay(120); }
async function login(s, a) { await goto(s, '/login'); await until(() => evaluate(s, '!!document.querySelector("[name=email]")'), 'login ready'); await set(s, '[name=email]', a.email); await set(s, '[name=password]', a.password); await evaluate(s, 'document.querySelector("button[type=submit]").click()'); await until(() => evaluate(s, 'location.pathname!=="/login"'), 'fresh password login'); }
async function screenshot(s, name, w, h) { await call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 }, s); await delay(300); await evaluate(s, 'document.fonts.ready'); const r = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, s); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(r.data, 'base64')); assert.equal(await evaluate(s, 'document.documentElement.scrollWidth<=innerWidth'), true, 'page overflow ' + name); }
try {
    let endpoint;
    await until(() => { try {
        endpoint = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').trim().split(/\r?\n/);
        return endpoint.length === 2;
    }
    catch {
        return false;
    } }, 'Chrome start');
    ws = new WebSocket(`ws://127.0.0.1:${endpoint[0]}${endpoint[1]}`);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    ws.onmessage = e => { const m = JSON.parse(String(e.data)); if (m.method === 'Page.javascriptDialogOpening') {
        dialog = true;
        void call('Page.handleJavaScriptDialog', { accept: allowNavigation }, m.sessionId);
        return;
    } if (!m.id)
        return; const p = requests.get(m.id); requests.delete(m.id); if (m.error)
        p?.reject(Error(m.error.message));
    else
        p?.resolve(m.result || {}); };
    const context = (await call('Target.createBrowserContext')).browserContextId, s = await tab(context);
    await login(s, accounts.find(a => a.role === 'admin'));
    passed.push('fresh synthetic Admin login');
    if (!process.argv.includes('--live-only')) {
        const game = fixture.games.find(g => !g.prepared), route = `/bingo/${game.gameId}/matching?round=${game.rounds[0]}`;
        await goto(s, route);
        await until(() => query(s, '[data-matching-number="1"]', '!==null'), 'matching editor');
        await delay(800);
        await screenshot(s, 'matching-laptop', 1366, 768);
        await screenshot(s, 'matching-mobile', 390, 844);
        await screenshot(s, 'matching-1280', 1280, 720);
        await call('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false }, s);
        await set(s, 'input[maxlength="80"]', 'Browserprüfung ' + Date.now());
        await button(s, 'Zuordnungssatz speichern');
        await until(async () => /Neue Zuordnungsfassung gespeichert/.test(await text(s)), 'save matching');
        await goto(s, route);
        await until(() => query(s, 'input[maxlength="80"]', '?.value.startsWith("Browserprüfung")'), 'persisted reload');
        passed.push('save and full reload');
        await set(s, 'input[maxlength="80"]', 'Nicht speichern');
        dialog = false;
        await evaluate(s, '[...document.querySelectorAll("a")].find(a=>a.textContent==="Abbrechen").click()');
        await until(() => dialog, 'native unsaved dialog');
        assert.equal(await evaluate(s, 'location.pathname'), `/bingo/${game.gameId}/matching`);
        assert.equal(await query(s, 'input[maxlength="80"]', '.value'), 'Nicht speichern');
        passed.push('native navigation cancellation retains input');
        await goto(s, route);
        await delay(500);
        await set(s, '[aria-label="Bereich von"]', '15');
        await set(s, '[aria-label="Bereich bis"]', '26').catch(async () => { const sels = await evaluate(s, '[...document.querySelectorAll("input[type=number]")].map(e=>e.outerHTML)'); throw Error(JSON.stringify(sels)); });
        const rangePrefix = (await query(s, '[aria-label="Präsentationstext Kugel 15"]', '.value')).startsWith('Bereich ') ? 'Feld' : 'Bereich';
        await button(s, 'Bereich auswählen');
        await until(() => query(s, '[aria-label="Kugel 15 auswählen"]', '.checked===true'), 'range selection');
        await button(s, 'Zahl beibehalten deaktivieren');
        await until(() => evaluate(s, 'document.querySelectorAll("[data-matching-number]").length===12'), 'range 15–26');
        for (let n = 15; n <= 26; n++)
            await set(s, `[aria-label="Präsentationstext Kugel ${n}"]`, `${rangePrefix} ${n}`);
        await button(s, 'Zuordnungssatz speichern');
        await until(async () => /Neue Zuordnungsfassung gespeichert/.test(await text(s)), 'range save');
        await goto(s, route);
        await until(() => query(s, '[aria-label="Präsentationstext Kugel 15"]', '?.value===' + JSON.stringify(rangePrefix + ' 15')), 'range retained');
        assert.match(await text(s), /Originalaufnahme/);
        passed.push('15–26 save/reload preserves other media entries');
        for (let n = 2; n <= 7; n++)
            await check(s, `[aria-label="Kugel ${n}: Zahl beibehalten"]`, true);
        await button(s, 'Kugel 1: Aus Quizbestand auswählen');
        await set(s, '[role=dialog] input[maxlength="120"]', 'Matching QA Musik');
        await button(s, 'Suchen');
        await until(async () => /Matching QA Musik:/.test(await text(s)), 'source search');
        await evaluate(s, '[...document.querySelectorAll("[role=dialog] button")].find(b=>b.textContent.includes("Matching QA Musik:")).click()');
        await until(async () => /Medium und Variante/.test(await text(s)), 'actual media options');
        await screenshot(s, 'answer-dropdown', 1366, 768);
        passed.push('authorized existing source and independent answer choices');
        for (const variant of ['920000', '920001'])
            for (const label of ['Interpret', 'Titel', 'Interpret + Titel']) {
                if (!await query(s, '[role=dialog]', '!==null')) {
                    await button(s, 'Kugel 1: Aus Quizbestand auswählen');
                    await set(s, '[role=dialog] input[maxlength="120"]', 'Matching QA Musik');
                    await button(s, 'Suchen');
                    await until(async () => /Matching QA Musik:/.test(await text(s)), 'source repeat');
                    await evaluate(s, '[...document.querySelectorAll("[role=dialog] button")].find(b=>b.textContent.includes("Matching QA Musik:")).click()');
                    await until(async () => /Medium und Variante/.test(await text(s)), 'variants ready');
                }
                const before = await evaluate(s, '[...document.querySelectorAll("[role=dialog] label")].find(l=>l.textContent.startsWith("Bingokarte")).querySelector("select").value');
                await selectLabel(s, 'Medium und Variante', variant);
                assert.equal(await evaluate(s, '[...document.querySelectorAll("[role=dialog] label")].find(l=>l.textContent.startsWith("Bingokarte")).querySelector("select").value'), before, 'variant does not change answer');
                const option = await evaluate(s, `[...[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Bingokarte')).querySelector('select').options].find(o=>o.textContent.startsWith(${JSON.stringify(label + ' —')})).value`);
                await selectLabel(s, 'Bingokarte', option);
                assert.ok(await query(s, '[role=dialog] audio', '?.src.endsWith("/' + variant + '")'));
                await button(s, 'Zuordnung übernehmen');
                await set(s, 'input[maxlength="80"]', 'Kombination ' + variant + ' ' + label + ' ' + Date.now());
                await button(s, 'Zuordnungssatz speichern');
                await until(async () => /Neue Zuordnungsfassung gespeichert/.test(await text(s)), 'combination save');
                await until(() => query(s, 'button[type=submit]', '.disabled===true'), 'saved baseline');
            }
        passed.push('all six original/reverse × artist/title/combination UI saves; variant preserves answer');
        await button(s, '1–90');
        assert.equal(await evaluate(s, 'document.querySelectorAll("[data-matching-number]").length'), 90);
        assert.match(await text(s), /Außerhalb 75er-Modus/);
        passed.push('90 editor entries explicitly retain 75-ball mode');
        const stale = await tab(context);
        await goto(stale, route);
        await until(() => query(stale, 'input[maxlength="80"]', '!==null'), 'stale editor');
        await set(s, 'input[maxlength="80"]', 'Aktuelle Fassung ' + Date.now());
        await button(s, 'Zuordnungssatz speichern');
        await until(async () => /Neue Zuordnungsfassung gespeichert/.test(await text(s)), 'new concurrent version');
        await set(stale, 'input[maxlength="80"]', 'Konflikt bleibt erhalten');
        await button(stale, 'Zuordnungssatz speichern');
        await until(async () => /inzwischen geändert/.test(await text(stale)), 'CAS visible');
        assert.equal(await query(stale, 'input[maxlength="80"]', '.value'), 'Konflikt bleibt erhalten');
        passed.push('two-tab CAS rejects stale save and preserves local edit');
        for (const role of ['manager', 'editor', 'management', 'none']) {
            const ctx = (await call('Target.createBrowserContext')).browserContextId, t = await tab(ctx);
            await login(t, accounts.find(a => a.role === role));
            await goto(t, route);
            await until(async () => role === 'manager' ? /Bingo-Matching-Tabelle|Zuordnungssatz/.test(await text(t)) : /404|not be found|nicht gefunden/i.test(await text(t)), 'role ' + role);
            passed.push('fresh ' + role + ' direct-link policy');
            await call('Target.disposeBrowserContext', { browserContextId: ctx });
        }
    }
    if (!process.argv.includes('--editor-only'))
        await matchingLiveBrowser({ s, context, fixture, origin, out, tab, goto, query, text, set, button, until, evaluate, call, delay, screenshot, passed });
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ origin, passed, productionTouched: false, complete: false }, null, 2));
    console.log(JSON.stringify({ origin, passed }));
}
catch (e) {
    console.error(e.stack);
    process.exitCode = 1;
}
finally {
    if (ws?.readyState === 1) {
        await call('Browser.close').catch(() => { });
        ws.close();
    }
    browser.kill();
}
