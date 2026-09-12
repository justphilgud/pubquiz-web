export async function participantPage({ browser, cookies, h, team }) {
  const context = await browser.newContext({ storageState: {
    cookies,
    origins: [{ origin: h.origin, localStorage: [{ name: `quiz-session-${h.quizId}`, value: JSON.stringify(team.session) }] }],
  } });
  const page = await context.newPage();
  await page.goto(`${h.origin}/quiz/${h.quizId}/antworten`);
  return { context, page };
}

export async function installFaults(page) {
  const faults = { mode: 'normal', holdSnapshots: false, saves: [], releases: [], statuses: [], errors: [] };
  page.on('pageerror', error => faults.errors.push(String(error).split('\n')[0]));
  const observer = `observeAP93_${Date.now()}`;
  await page.exposeFunction(observer, statuses => faults.statuses.push({ at: new Date().toISOString(), statuses }));
  await page.evaluate(name => {
    const emit = () => window[name](Array.from(document.querySelectorAll('[data-save-status]'), element => ({
      status: element.dataset.saveStatus, text: element.innerText,
    })));
    new MutationObserver(emit).observe(document.body, { attributes: true, childList: true, subtree: true });
    emit();
  }, observer);
  await page.route('**/api/quiz/team-answer-draft', async route => {
    const input = route.request().postDataJSON();
    const mode = faults.mode;
    const record = { mode, question: input.quizFragenId, at: new Date().toISOString() };
    faults.saves.push(record);
    if (mode === 'holdBefore') await new Promise(resolve => faults.releases.push(resolve));
    try {
      const response = await route.fetch();
      record.result = await response.json();
      record.receivedAt = new Date().toISOString();
      if (mode === 'lost') {
        await new Promise(resolve => faults.releases.push(resolve));
        await route.abort('failed').catch(() => {});
      } else await route.fulfill({ response });
    } catch (error) {
      record.transport = String(error).split('\n')[0].slice(0, 200);
      await route.abort('failed').catch(() => {});
    }
  });
  await page.route('**/api/quiz/team-live-snapshot', route => faults.holdSnapshots ? route.abort('internetdisconnected') : route.continue());
  faults.restore = () => { faults.mode = 'normal'; faults.holdSnapshots = false; faults.releases.splice(0).forEach(release => release()); };
  return faults;
}

export async function sampleAnimationFrames(page) {
  await page.bringToFront();
  return page.evaluate(() => new Promise(resolve => {
    const gaps = [];
    const start = performance.now();
    let previous = start;
    const frame = now => {
      gaps.push(now - previous); previous = now;
      if (now - start < 3000) return requestAnimationFrame(frame);
      gaps.sort((a, b) => a - b);
      resolve({ frames: gaps.length, maxGapMs: gaps.at(-1), p95GapMs: gaps[Math.ceil(gaps.length * .95) - 1], hidden: document.hidden });
    };
    requestAnimationFrame(frame);
  }));
}

export async function prepareDeadlineFaults(h, clients) {
  const b = clients.find(c => c.label === 'B'), c = clients.find(c => c.label === 'C');
  if (!b || !c) throw new Error('Deadline browser clients absent');
  for (const client of [b, c]) {
    await client.page.reload();
    await client.page.unrouteAll({ behavior: 'wait' });
    client.faults = await installFaults(client.page);
    client.faults.holdSnapshots = true;
  }
  b.faults.mode = 'lost'; c.faults.mode = 'holdBefore';
  const testCase = { question: h.questions[0].quiz_fragen_id,
    acceptedText: 'AP93 before deadline accepted response lost',
    blockedText: 'AP93 never accepted before deadline' };
  await b.page.locator('textarea').first().fill(testCase.acceptedText);
  await c.page.locator('textarea').first().fill(testCase.blockedText);
  for (let i = 0; i < 150 && (!b.faults.saves.some(r => r.result?.success) || !c.faults.releases.length); i++) await b.page.waitForTimeout(100);
  const [bs, cs] = await Promise.all([h.snapshot({ ...b, index: 41 }, true), h.snapshot({ ...c, index: 42 }, true)]);
  testCase.acceptedBefore = bs.answerConfirmations.find(a => a.questionId === testCase.question);
  testCase.blockedBefore = cs.answerConfirmations.find(a => a.questionId === testCase.question) ?? null;
  if (testCase.acceptedBefore?.value.antwortText !== testCase.acceptedText || testCase.blockedBefore?.value.antwortText === testCase.blockedText) throw new Error('Deadline fault setup failed');
  return testCase;
}

export async function finishDeadlineFaults(h, clients, testCase) {
  const b = clients.find(c => c.label === 'B'), c = clients.find(c => c.label === 'C');
  b.faults.restore(); c.faults.restore();
  await c.page.locator('[data-save-status="closed"]').waitFor();
  await b.page.waitForFunction(text => Array.from(document.querySelectorAll('[data-save-status="saved"]')).some(e => e.innerText.includes(text)), testCase.acceptedText);
  await Promise.all([b.page.reload(), c.page.reload()]);
  await c.page.locator('[data-save-status="closed"]').waitFor();
  const [bs, cs] = await Promise.all([h.snapshot({ ...b, index: 41 }, true), h.snapshot({ ...c, index: 42 }, true)]);
  const result = { ...testCase,
    acceptedAfter: bs.answerConfirmations.find(a => a.questionId === testCase.question),
    blockedAfter: cs.answerConfirmations.find(a => a.questionId === testCase.question) ?? null,
    rejectedRequests: c.faults.saves.filter(r => r.result && !r.result.success).length,
    unexpectedAccepted: c.faults.saves.some(r => r.result?.success),
    closedClientText: await c.page.locator('[data-save-status="closed"]').first().innerText(),
  };
  if (result.acceptedAfter?.value.antwortText !== testCase.acceptedText || result.acceptedAfter?.revision !== testCase.acceptedBefore?.revision ||
    JSON.stringify(result.blockedAfter?.value ?? null) !== JSON.stringify(testCase.blockedBefore?.value ?? null) ||
    result.unexpectedAccepted || !result.rejectedRequests) throw new Error('Deadline browser integrity failed');
  return result;
}

export async function joinBrowserClients({ browser, cookies, h }) {
  const clients = [];
  let joinRecovery;
  for (const label of ['A', 'B', 'C']) {
    const context = await browser.newContext({ storageState: { cookies, origins: [] } });
    const page = await context.newPage();
    const attempts = [];
    if (label === 'C') await page.route('**/api/quiz/team-session', async route => {
      const input = route.request().postDataJSON();
      const response = await route.fetch();
      const result = await response.json();
      attempts.push({ proof: input.joinRequestId, id: result.session?.quiz_team_session_id });
      if (attempts.length === 1) await route.abort('failed');
      else await route.fulfill({ response });
    });
    await page.goto(`${h.origin}/quiz/${h.quizId}/antworten`);
    const name = `AP93 Browser ${label} ${Date.now()}`;
    await page.getByLabel('Teamname', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Team starten', exact: true }).click();
    if (label === 'C') {
      for (let i = 0; i < 100 && !attempts.length; i++) await page.waitForTimeout(100);
      if (!attempts[0]?.id) throw Error('Lost Join was not accepted');
      await page.reload();
      await page.getByLabel('Teamname', { exact: true }).fill(name);
      await page.getByRole('button', { name: 'Team starten', exact: true }).click();
    }
    await page.getByText('Team angemeldet', { exact: true }).waitFor();
    const session = await page.evaluate(id => JSON.parse(localStorage.getItem(`quiz-session-${id}`)), h.quizId);
    clients.push({ label, context, page, session });
    if (label === 'C') {
      joinRecovery = { attempts: attempts.length, sameProof: typeof attempts[0].proof === 'string' && attempts[0].proof.length > 20 && attempts[0].proof === attempts[1]?.proof,
        sameSession: attempts[0].id === session.quiz_team_session_id };
      if (!joinRecovery.sameProof || !joinRecovery.sameSession) throw Error('Browser Join recovery mismatch');
      await page.unrouteAll({ behavior: 'wait' });
    }
  }
  const a2 = await participantPage({ browser, cookies, h, team: clients[0] });
  clients.push({ ...a2, label: 'A2', session: clients[0].session });
  return { clients, joinRecovery };
}

export async function checkBrowserRecovery(h, clients) {
  const [a, b, , a2] = clients;
  const result = {};
  for (const c of [a, b]) c.faults = await installFaults(c.page);
  a.faults.mode = 'holdBefore'; a.faults.holdSnapshots = true;
  b.faults.mode = 'lost'; b.faults.holdSnapshots = true;
  await a.context.setOffline(true);
  await a.page.locator('textarea').first().fill('AP93 offline reconnect');
  await b.page.locator('textarea').first().fill('AP93 accepted response lost');
  await a.page.waitForTimeout(20000);
  const read = async c => ({ label: c.label,
    value: await c.page.locator('textarea').first().inputValue(),
    status: await c.page.locator('[data-save-status]').first().getAttribute('data-save-status'),
    server: (await h.snapshot({ ...c, index: c.label === 'A' ? 40 : 41 }, true)).answerConfirmations,
  });
  result.before = await Promise.all([a, b].map(read));
  if (result.before[0].server.length || result.before[1].server[0]?.value.antwortText !== 'AP93 accepted response lost') throw Error('Fault setup wrong');
  await a.context.setOffline(false); a.faults.restore(); b.faults.restore();
  for (const c of [a, b]) await c.page.waitForFunction(() => document.querySelector('[data-save-status]')?.dataset.saveStatus === 'saved');
  result.after = await Promise.all([a, b].map(read));
  for (const r of result.after) if (r.server[0]?.value.antwortText !== r.value || r.status !== 'saved') throw Error('Reconnect confirmation wrong');
  result.statuses = [a, b].map(c => ({ label: c.label, states: [...new Set(c.faults.statuses.flatMap(r => r.statuses.map(x => x.status)))] }));
  await Promise.all([a.page.reload(), b.page.reload()]);
  result.reloaded = await Promise.all([a, b].map(read));
  for (const r of result.reloaded) if (r.server[0]?.value.antwortText !== r.value || r.status !== 'saved') throw Error('Reload confirmation wrong');
  await a.page.unrouteAll({ behavior: 'wait' }); a.faults = await installFaults(a.page);
  await a2.page.reload();
  a.faults.mode = 'holdBefore'; a.faults.holdSnapshots = true;
  await a.page.locator('textarea').first().fill('AP93 stale held edit');
  while (!a.faults.releases.length) await a.page.waitForTimeout(100);
  const response = a2.page.waitForResponse(r => r.url().endsWith('/api/quiz/team-answer-draft') && r.request().method() === 'POST');
  await a2.page.locator('textarea').first().fill('AP93 other window wins');
  if (!(await (await response).json()).success) throw Error('Concurrent winner not accepted');
  a.faults.restore(); a.faults.holdSnapshots = true; // Decision must work before any poll can repair it.
  await a.page.getByRole('button', { name: 'Gespeicherte Antwort verwenden', exact: true }).waitFor();
  result.conflictText = await a.page.locator('[data-save-status]').first().innerText();
  if (!result.conflictText.includes('Zuletzt bestätigt: AP93 other window wins')) throw Error('Conflict comparison stale');
  await a.page.getByRole('button', { name: 'Gespeicherte Antwort verwenden', exact: true }).click();
  result.choice = await read(a);
  if (result.choice.value !== 'AP93 other window wins' || result.choice.status !== 'saved' || result.choice.server[0]?.value.antwortText !== result.choice.value) throw Error('Immediate choice wrong');
  a.faults.restore();
  return result;
}
