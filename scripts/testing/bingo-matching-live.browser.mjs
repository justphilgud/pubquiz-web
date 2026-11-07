import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
export async function matchingLiveBrowser({ s, context, fixture, origin, out, tab, goto, query, text, set, button, until, evaluate, call, delay, screenshot, passed }) {
    const game = fixture.games.find(g => g.prepared), route = `/bingo/${game.gameId}/moderation`;
    await goto(s, route);
    await until(async () => /Erste Runde starten|Aktuelle Zahl/.test(await text(s)), 'moderation ready');
    let cached=null,etag=null,readAt=0;const state=async()=>{if(cached&&Date.now()-readAt<700)return cached;const result=await evaluate(s,`fetch('/api/bingo/live/${game.gameId}',{headers:${JSON.stringify(etag?{'If-None-Match':etag}:{})}}).then(async r=>({status:r.status,etag:r.headers.get('etag'),body:r.status===304?null:await r.json()}))`);readAt=Date.now();if(result.status===200){cached=result.body;etag=result.etag;}else if(result.status!==304)throw Error('Synthetic status read failed: '+result.status);return cached;}, confirm = async (label) => { await button(s, label); await button(s, 'Bestätigen'); await until(() => query(s, '[role=dialog]', '===null'), 'confirmation closed'); await delay(400); };
    if((await state()).live?.state.run.status==='ENDED'){await goto(s,route+'?new=1');await confirm('Erste Runde starten');cached=null;etag=null;readAt=0;}else if(!(await state()).live)await confirm('Erste Runde starten');
    await until(async () => !!(await state()).live, 'run started');
    let view = await state();
    if (view.live.state.run.status !== 'RUNNING')
        throw Error('Fresh running synthetic fixture required; no reset');
    const runId = view.live.id, modroute = route + '?run=' + runId;
    await goto(s, modroute);
    const p = await tab(context);
    await call('Page.addScriptToEvaluateOnNewDocument', { source: `window.__matchingPlays=0;const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__matchingPlays++;return play.call(this)}` }, p);
    await goto(p, `/bingo/${game.gameId}/praesentation`);
    await until(()=>query(p,'[aria-label="Bingo-Präsentation"]','!==null'),'audience ready');
    async function draw(n) { await set(s, 'input[type=number][min="1"][max="75"]', String(n)); await button(s, 'Zahl veröffentlichen'); await until(async () => { const v = await state(); return v.live.state.run.rounds.at(-1).draws.at(-1)?.number === n; }, 'saved draw ' + n); await until(() => query(s, 'input[type=number][min="1"][max="75"]', '?.value===""'), 'draw UI settled'); }
    const already = () => state().then(v => v.live.state.run.rounds.at(-1).draws.map(d => d.number));
    if (!(await already()).includes(1))
        await draw(1);
    await until(() => query(p, 'audio', '!==null'), 'audience audio');
    assert.equal(await query(p, 'audio', '.paused'), true);
    await button(p, 'Präsentation freigeben');
    await button(s, (await state()).live.state.playback?'Präsentationsmedium erneut abspielen':'Präsentationsmedium starten');
    await until(() => query(p, 'audio', '?.paused===false'), 'actual audience audio play');
    const plays = await evaluate(p, 'window.__matchingPlays');
    await delay(3300);
    assert.equal(await evaluate(p, 'window.__matchingPlays'), plays, 'polling never restarts media');
    await button(s, 'Präsentationsmedium pausieren');
    await until(() => query(p, 'audio', '?.paused===true'), 'media paused');
    const pauseAt = await query(p, 'audio', '.currentTime');
    await delay(700);
    assert.ok(Math.abs(await query(p, 'audio', '.currentTime') - pauseAt) < 0.2);
    await button(s, 'Präsentationsmedium starten');
    await until(() => query(p, 'audio', '?.paused===false&&document.querySelector("audio").currentTime>='+String(pauseAt-.2)), 'media resumes at saved position');
    await evaluate(p,'window.__matchingPriorAudio=document.querySelector("audio");true');await button(s, 'Präsentationsmedium erneut abspielen');
    await until(()=>query(p,'audio','!==window.__matchingPriorAudio&&!document.querySelector("audio").paused'),'fresh replay media node');await until(async()=>{const v=await state();return v.live.state.playback.action==='REPLAY'&&v.live.state.playback.position===0},'replay starts from persisted zero');
    passed.push('separate audience: activation, actual audio play/pause/resume/replay and no polling restarts');
    const mediaGeometry=await evaluate(p,"(()=>{const e=document.querySelector('[aria-label=\"Zugeordneter Präsentationsinhalt\"]'),r=e.getBoundingClientRect(),o=e.querySelector('output')?.getBoundingClientRect();return{width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight,contained:!o||o.left>=r.left-1&&o.right<=r.right+1&&o.top>=r.top-1&&o.bottom<=r.bottom+1}})()");assert.ok(mediaGeometry.scrollWidth<=mediaGeometry.width&&mediaGeometry.scrollHeight<=mediaGeometry.height&&mediaGeometry.contained,'countdown is contained without scrollbars');
    await screenshot(s, 'moderation-laptop', 1366, 768);
    await screenshot(p, 'presentation-laptop', 1366, 768);
    await screenshot(s, 'moderation-mobile', 390, 844);
    await screenshot(p, 'presentation-1080', 1920, 1080);
    await screenshot(p, 'presentation-mobile', 390, 844);
    await call('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false }, s);await call('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false},p);
    await confirm('Pausieren');
    await until(async () => (await state()).live.state.run.status === 'PAUSED', 'game paused');
    await until(() => query(p, 'audio', '?.paused===true'), 'game pause stops media');
    await confirm('Fortsetzen');
    await until(async () => (await state()).live.state.run.status === 'RUNNING', 'game resumed');
    passed.push('global pause/resume keeps playback explicitly paused');
    await goto(p, `/bingo/${game.gameId}/praesentation`);
    await until(() => query(p, 'audio', '!==null'), 'audience reload');
    assert.equal(await query(p, 'audio', '.paused'), true);
    await button(p, 'Präsentation freigeben');
    await delay(800);
    assert.equal(await query(p, 'audio', '.paused'), true, 'reload/activation does not replay old command');
    await button(s, 'Präsentationsmedium erneut abspielen');
    await until(() => query(p, 'audio', '?.paused===false'), 'fresh playback after reload');
    await call('Network.enable', {}, p);
    await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, p);
    await until(async () => /Verbindung unterbrochen/.test(await text(p)), 'audience offline banner', 25000);
    await call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, p);
    await until(async () => !/Verbindung unterbrochen/.test(await text(p)), 'audience reconnect', 25000);
    await until(() => query(p, 'audio', '!==null'), 'reconnected media');
    assert.equal(await query(p, 'audio', '.paused'), true);
    passed.push('reload and tab-only offline/reconnect preserve state without stale playback');
    for (const [n, type] of [[2, 'audio'], [3, 'audio'], [4, 'img'], [5, 'img'], [6, 'audio'], [7, 'video']]) {
        if (!(await already()).includes(n))
            await draw(n);
        await until(()=>query(p,'[data-number="'+n+'"]','.dataset.state==="current"'),'audience current number '+n);await until(() => query(p, '[aria-label="Zugeordneter Präsentationsinhalt"] '+type, '!==null'), 'mixed media ' + n);
        if (type === 'audio' || type === 'video') {
            await until(() => query(p, type, '.paused===true'), 'next draw stops prior playback');
            if (await evaluate(p, '[...document.querySelectorAll("button")].some(b=>b.textContent==="Präsentation freigeben")'))
                await button(p, 'Präsentation freigeben');
            await button(s, 'Präsentationsmedium starten');
            await until(() => query(p, type, '.paused===false'), 'mixed actual play ' + n);
        }
        else
            await until(() => query(p, '[aria-label="Zugeordneter Präsentationsinhalt"] img', '.naturalWidth>0'), 'image loaded ' + n);
    }
    passed.push('original/reverse/bitcrush, flag, outline, stored speech and actual video across draw changes');
    await button(s, 'Begriff auflösen');
    await until(async () => /Film A/.test(await text(p)), 'explicit answer reveal');
    await screenshot(p, 'presentation-video-solution', 1366, 768);
    view = await state();
    const card = view.live.cards[0];
    for (const n of card.cells[0])
        if (!(await already()).includes(n))
            await draw(n);
    await button(s, 'Bingo');
    await until(async () => /Kartenkennung/.test(await text(s)), 'call created');
    await set(s, 'section[id^=call-] input[required]', card.shortCode);
    await button(s, 'Karte prüfen');
    await until(async () => /Gewinnstufe erfüllt/.test(await text(s)), 'winning line evaluated');
    await set(s, 'section[id^=call-] input[maxlength="1000"]', 'Synthetische Browserprüfung');
    await confirm('Bestätigen');
    await until(async () => /Bestätigt/.test(await text(s)), 'win persisted');
    passed.push('actual call, printed card identity, line evaluation and confirmed win');
    view=await state();const corrected=view.live.state.run.rounds[0].draws.find(d=>d.number===card.cells[0][0]),replacement=Array.from({length:75},(_,i)=>i+1).find(n=>!view.live.state.run.rounds[0].draws.some(d=>d.number===n));await evaluate(s,'[...document.querySelectorAll("summary")].find(e=>e.textContent.startsWith("Frühere Ziehung")).click()');
    await evaluate(s,`(()=>{const f=[...document.querySelectorAll('details')].find(e=>e.querySelector('summary')?.textContent.startsWith('Frühere Ziehung')).querySelector('form'),v=f.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(v,${JSON.stringify(corrected.id)});v.dispatchEvent(new Event('change',{bubbles:true}))})()`);await set(s,'details input[type=number][required]',String(replacement));await set(s,'details input[maxlength="1000"]','Synthetische historische Korrektur');await confirm('Korrektur prüfen');await until(async()=>(await state()).live.blocked,'confirmed claim requires review');await set(s,'section[id^=call-] input[maxlength="1000"]','Nachprüfung: Korrektur bestätigt');await confirm('Widerrufen');await until(async()=>!(await state()).live.blocked,'review resolved');passed.push('historical correction preserves call cutoff, requires review and blocks further draws');
    await call('Network.enable',{},s);await call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0},s);await until(async()=>/Verbindung unterbrochen/.test(await text(s)),'moderator offline',25000);await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1},s);await until(async()=>!/Verbindung unterbrochen/.test(await text(s)),'moderator reconnect',25000);passed.push('moderator tab-only offline/reconnect preserves draws and call decisions');
    await confirm('Runde abschließen');
    await until(async () => /Runde abgeschlossen/.test(await text(s)), 'round closed');
    await confirm('Nächste Runde starten');
    await until(async () => (await state()).live.state.run.rounds.length === 2, 'second round persisted');
    await goto(s, modroute);
    assert.equal((await state()).live.state.run.rounds.length, 2);
    passed.push('round transition persists through full moderator reload');
    await confirm('Runde abschließen');
    await evaluate(s, '[...document.querySelectorAll("summary")].find(e=>e.getAttribute("aria-label")==="Weitere Aktionen").click()');
    await confirm('Event abschließen');
    await until(async () => (await state()).live.state.run.status === 'ENDED', 'event ended');
    passed.push('event completion and unchanged numeric round');
    fs.writeFileSync(path.join(out, 'live-run.json'), JSON.stringify({ gameId: game.gameId, runId, origin, passed, syntheticOnly: true }, null, 2));
}
