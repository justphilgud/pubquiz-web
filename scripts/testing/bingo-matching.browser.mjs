import {prepareMatchingReview} from './bingo-matching-review.browser.mjs';
import {matchingPdfDownload} from './bingo-matching-pdf.browser.mjs';
import {uploadMatchingFixtures} from './bingo-matching-upload.browser.mjs';
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
const appendProgress=passed.push.bind(passed);passed.push=(...items)=>{const count=appendProgress(...items);fs.writeFileSync(path.join(out,'progress-'+(process.argv.includes('--live-only')?'live':process.argv.includes('--editor-only')?'editor':'other')+'.json'),JSON.stringify({origin,passed},null,2));return count;};
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(f, m, timeout = 60000) { const end = Date.now() + timeout; while (Date.now() < end) {
    if (await f())
        return;
    await delay(120);
} throw Error(m); }
function call(method, params = {}, sessionId) { return new Promise((resolve, reject) => { const key = ++id, timer = setTimeout(() => { requests.delete(key); reject(Error('CDP timeout ' + method)); }, 30000); requests.set(key, { resolve: r => { clearTimeout(timer); resolve(r); }, reject: e => { clearTimeout(timer); reject(e); } }); ws.send(JSON.stringify({ id: key, method, params, sessionId })); }); }
async function evaluate(s, expression) { const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, s); if (r.exceptionDetails)
    throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; }
async function tab(context) { const t = await call('Target.createTarget', { url: 'about:blank', browserContextId: context }); const s = (await call('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId; await call('Page.enable', {}, s);if(hosted){if(!process.env.VERCEL_AUTOMATION_BYPASS_SECRET)throw Error('Existing authorized Preview automation credential required');await call('Fetch.enable',{patterns:[{urlPattern:origin+'/*',requestStage:'Request'}]},s);}return s; }
async function goto(s, p) { const token = 'navigation-' + Date.now() + '-' + Math.random(); await evaluate(s, 'window.__matchingNavigationToken=' + JSON.stringify(token)); allowNavigation = true; try {
    await call('Page.navigate', { url: origin + p }, s);
    await until(() => evaluate(s, 'window.__matchingNavigationToken!==' + JSON.stringify(token) + '&&document.readyState==="complete"'), 'new document ready');
}
finally {
    allowNavigation = false;
} }
async function query(s, selector, tail = '') { return evaluate(s, 'document.querySelector(' + JSON.stringify(selector) + ')' + tail); }
async function text(s) { return evaluate(s, 'document.body?.innerText??""'); }
async function button(s, label) { await until(() => evaluate(s, `[...(document.querySelector('[role=dialog]')??document).querySelectorAll('button')].some(e=>(e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)})&&!e.matches(':disabled'))`), 'button ready ' + label); await evaluate(s, `(()=>{const e=[...(document.querySelector('[role=dialog]')??document).querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)});if(!e||e.matches(':disabled'))throw Error('Unavailable button '+${JSON.stringify(label)});e.click()})()`); await delay(100); }
async function set(s, selector, value) { await until(() => query(s, selector, "!==null&&!document.querySelector("+JSON.stringify(selector)+").matches(':disabled')"), "input ready " + selector); await evaluate(s, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`); await delay(120); }
async function selectLabel(s, label, value) { await evaluate(s, `(()=>{const label=[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)})),e=label?.querySelector('select');if(!e)throw Error('Missing dialog select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('change',{bubbles:true}))})()`); await delay(150); }
async function saveUi(s){const count=await query(s,'select','.options.length');await button(s,'Zuordnungssatz speichern');await until(()=>query(s,'select','.options.length>'+count),'new immutable version loaded');}
async function check(s, selector, checked) { await evaluate(s, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing checkbox');if(e.checked!==${checked})e.click()})()`); await delay(120); }
async function login(s, a) { await goto(s, '/login'); await until(() => evaluate(s, '!!document.querySelector("[name=email]")'), 'login ready'); await set(s, '[name=email]', a.email); await set(s, '[name=password]', a.password); await evaluate(s, 'document.querySelector("button[type=submit]").click()'); await until(() => evaluate(s, 'location.pathname!=="/login"'), 'fresh password login'); }
async function screenshot(s, name, w, h) { await call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 }, s); await delay(300); await evaluate(s, 'document.fonts.ready.then(()=>true)'); const r = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, s); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(r.data, 'base64')); assert.equal(await evaluate(s, 'document.documentElement.scrollWidth<=innerWidth'), true, 'page overflow ' + name); }
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
    ws.onmessage = e => { const m = JSON.parse(String(e.data));if(m.method==='Fetch.requestPaused'){const q=m.params;if(new URL(q.request.url).origin!==origin)throw Error('Foreign origin interception forbidden');const headers=Object.entries(q.request.headers).map(([name,value])=>({name,value:String(value)}));headers.push({name:'x-vercel-protection-bypass',value:process.env.VERCEL_AUTOMATION_BYPASS_SECRET});void call('Fetch.continueRequest',{requestId:q.requestId,headers},m.sessionId).catch(()=>{process.exitCode=1});return;} if (m.method === 'Page.javascriptDialogOpening') {
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
    if(process.argv.includes('--prepare-review'))await prepareMatchingReview({s,fixture,kind,out,goto,query,set,button,until,evaluate,selectLabel,saveUi,screenshot,call,passed});
    if(process.argv.includes('--verify-only')){const expected=JSON.parse(fs.readFileSync('.artifacts/matching-preview-deployment.json')).sha;const runtime=await evaluate(s,"fetch('/api/admin/monitoring').then(r=>r.json())");assert.equal(runtime.release,expected);assert.equal(runtime.environment,'preview');assert.equal(runtime.db.ok,true);fs.writeFileSync(path.join(out,'runtime-proof.json'),JSON.stringify({release:runtime.release,environment:runtime.environment,dbOk:runtime.db.ok},null,2));passed.push('actual authenticated runtime SHA and Preview database read');}
    if(process.argv.includes('--pdf-only'))await matchingPdfDownload({s,context,fixture,out,goto,query,set,button,until,evaluate,call,screenshot,passed});
    if(process.argv.includes('--upload-fixtures')){await uploadMatchingFixtures({s,origin,out,evaluate});passed.push('existing authenticated upload into own branch prefix');}
    if (!process.argv.includes('--live-only')&&!process.argv.includes('--upload-fixtures')&&!process.argv.includes('--pdf-only')&&!process.argv.includes('--verify-only')&&!process.argv.includes('--prepare-review')) {
        const game = fixture.games.find(g => !g.prepared), route = `/bingo/${game.gameId}/matching?round=${game.rounds[0]}`;
        await goto(s, route);
        await until(() => query(s, '[data-matching-number="1"]', '!==null'), 'matching editor');
        await delay(800);
        await screenshot(s, 'matching-laptop', 1366, 768);
        await screenshot(s, 'matching-mobile', 390, 844);
        await screenshot(s, 'matching-1280', 1280, 720);
        await call('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false }, s);
        await set(s, 'input[maxlength="80"]', 'Browserprüfung ' + Date.now());
        await saveUi(s);
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
        const outsideBefore=await query(s,'[data-matching-number="1"]','.innerText');await set(s, '[aria-label="Bereich von"]', '15');
        await set(s, '[aria-label="Bereich bis"]', '26').catch(async () => { const sels = await evaluate(s, '[...document.querySelectorAll("input[type=number]")].map(e=>e.outerHTML)'); throw Error(JSON.stringify(sels)); });
        const rangePrefix = (await query(s, '[aria-label="Präsentationstext Kugel 15"]', '.value')).startsWith('Bereich ') ? 'Feld' : 'Bereich';
        await button(s, 'Bereich auswählen');
        await until(() => query(s, '[aria-label="Kugel 15 auswählen"]', '.checked===true'), 'range selection');
        await button(s, 'Zahl beibehalten deaktivieren');
        await until(() => evaluate(s, 'document.querySelectorAll("[data-matching-number]").length===12'), 'range 15–26');
        for (let n = 15; n <= 26; n++)
            {await set(s, `[aria-label="Präsentationstext Kugel ${n}"]`, `${rangePrefix} ${n}`);assert.equal(await query(s,`[aria-label="Eigener Kartentext Kugel ${n}"]`,'.value'),`${rangePrefix} ${n}`,'coupled card control displays its actual printed text');}
        await saveUi(s);
        await goto(s, route);
        await until(() => query(s, '[aria-label="Präsentationstext Kugel 15"]', '?.value===' + JSON.stringify(rangePrefix + ' 15')), 'range retained');
        assert.equal(await query(s,'[data-matching-number="1"]','.innerText'),outsideBefore,'range edits preserve the full outside row');
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
                await saveUi(s);
                await until(() => query(s, 'button[type=submit]', '.disabled===true'), 'saved baseline');
            }
        passed.push('all six original/reverse × artist/title/combination UI saves; variant preserves answer');
        await set(s,'#kind-8','MEDIA');for(const [search,label]of [['Matching QA Browser-Sprachausgabe','Browser-Sprachausgabe ohne Aufnahme'],['Matching QA fehlende Aufnahme','fehlende gespeicherte Mediendatei']]){await button(s,'Kugel 8: Aus Quizbestand auswählen');await set(s,'[role=dialog] input[maxlength="120"]',search);await button(s,'Suchen');await until(()=>evaluate(s,`[...document.querySelectorAll('[role=dialog] button')].some(b=>b.textContent.includes(${JSON.stringify(search)}))`),'negative source result');await evaluate(s,`[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent.includes(${JSON.stringify(search)})).click()`);await until(async()=>/keine ladbare Mediendatei/.test(await text(s)),'unavailable source explained');assert.equal(await evaluate(s,'[...[...document.querySelectorAll("[role=dialog] label")].find(l=>l.textContent.startsWith("Medium und Variante")).querySelector("select").options].length'),1);assert.equal(await evaluate(s,'[...document.querySelectorAll("[role=dialog] button")].find(b=>b.textContent==="Zuordnung übernehmen").disabled'),true);passed.push(label+' rejected without invented media');await button(s,'Schließen');}await goto(s,route);
        await check(s,'[aria-label="Kugel 9: Zahl beibehalten"]',false);await set(s,'[aria-label="Präsentationstext Kugel 9"]','W'.repeat(121));await until(()=>query(s,'[data-matching-number="9"] [role=alert]','?.textContent.includes("120 Zeichen")'),'long selected text has a row error');assert.equal(await query(s,'button[type=submit]','.disabled'),true);await goto(s,route);for(const n of [9,10]){await check(s,`[aria-label="Kugel ${n}: Zahl beibehalten"]`,false);await set(s,`[aria-label="Präsentationstext Kugel ${n}"]`,'Mehrdeutig');}await until(()=>query(s,'[data-matching-number="10"] [role=alert]','?.textContent.includes("Gleiche Kartenbeschriftung")'),'duplicate label row error');assert.equal(await query(s,'button[type=submit]','.disabled'),true);await goto(s,route);passed.push('long and duplicate labels are explained on their rows before saving');
        await button(s, '1–90');
        assert.equal(await evaluate(s, 'document.querySelectorAll("[data-matching-number]").length'), 90);
        assert.match(await text(s), /Außerhalb 75er-Modus/);
        passed.push('90 editor entries explicitly retain 75-ball mode');
        const stale = await tab(context);
        await goto(stale, route);
        await until(() => query(stale, 'input[maxlength="80"]', '!==null'), 'stale editor');
        await set(s, 'input[maxlength="80"]', 'Aktuelle Fassung ' + Date.now());
        await saveUi(s);
        await set(stale, 'input[maxlength="80"]', 'Konflikt bleibt erhalten');
        await button(stale, 'Zuordnungssatz speichern');
        await until(async () => /inzwischen geändert/.test(await text(stale)), 'CAS visible');
        assert.equal(await query(stale, 'input[maxlength="80"]', '.value'), 'Konflikt bleibt erhalten');
        passed.push('two-tab CAS rejects stale save and preserves local edit');
        const assetPath=await evaluate(s,"new URL(document.querySelector('[data-matching-number=\"1\"] audio').src).pathname");
        for (const role of ['manager', 'editor', 'management', 'none']) {
            const ctx = (await call('Target.createBrowserContext')).browserContextId, t = await tab(ctx);
            await login(t, accounts.find(a => a.role === role));
            await goto(t, route);
            await until(async () => role === 'manager' ? /Bingo-Matching-Tabelle|Zuordnungssatz/.test(await text(t)) : /404|not be found|nicht gefunden/i.test(await text(t)), 'role ' + role);
            if(role!=='manager')assert.equal(await evaluate(t,`fetch(${JSON.stringify(assetPath)}).then(r=>r.status)`),404,'known immutable asset still checks fresh role');passed.push('fresh ' + role + ' direct-link and immutable asset policy');
            await call('Target.disposeBrowserContext', { browserContextId: ctx });
        }
    }
    if (!process.argv.includes('--editor-only')&&!process.argv.includes('--upload-fixtures')&&!process.argv.includes('--pdf-only')&&!process.argv.includes('--verify-only')&&!process.argv.includes('--prepare-review'))
        await matchingLiveBrowser({ s, context, fixture, origin, out, tab, goto, query, text, set, button, until, evaluate, call, delay, screenshot, passed });
    const phase=process.argv.includes('--prepare-review')?'review':process.argv.includes('--verify-only')?'verify':process.argv.includes('--pdf-only')?'pdf':process.argv.includes('--live-only')?'live':process.argv.includes('--editor-only')?'editor':process.argv.includes('--upload-fixtures')?'upload':'full';fs.writeFileSync(path.join(out,phase+'-results.json'),JSON.stringify({origin,phase,passed,phasePassed:true,productionTouched:false},null,2));
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
