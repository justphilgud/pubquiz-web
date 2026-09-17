const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (ok, message) => { if (!ok) throw new Error(message); };

// Real elapsed time, ordinary moderator actions and server-issued deadlines.
// Background writers are paused for browser fault checks through h.pausedTeams.
export async function runSoak({ h, moderator, presentation, onProgress, answerFor, onBlockReady, beforeCountdown, afterBlockClosed }) {
  assert(typeof answerFor === 'function', 'Answer generator required');
  h.checks = { blocks: [] };
  h.pausedTeams = new Set();
  const base = `${h.origin}/quiz/${h.quizId}`;
  await moderator.goto(base + '/moderation');
  if (!await moderator.getByRole('button', { name: 'Quiz starten', exact: true }).count()) {
    if (await moderator.getByRole('button', { name: 'Später', exact: true }).count()) await moderator.getByRole('button', { name: 'Später', exact: true }).click();
    await moderator.getByRole('button', { name: 'Quiz zurücksetzen', exact: true }).click();
    await moderator.getByRole('button', { name: 'Durchlauf zurücksetzen', exact: true }).click();
  }
  await moderator.getByRole('button', { name: 'Quiz starten', exact: true }).click();
  await presentation.goto(base + '/praesentation');
  h.checks.join = await h.joinTeams(40);
  assert(h.checks.join.joined === 40, 'Soak join incomplete');
  h.checks.startedAt = new Date().toISOString();
  h.started = performance.now();
  h.startPolling(2);
  for (let block = 1; block <= 2; block++) {
    h.phase = `soak-block-${block}`; onProgress(h.phase);
    // Reach the actual question block pause, including normal reveals.
    if (await moderator.getByRole('button', { name: 'Später', exact: true }).count()) await moderator.getByRole('button', { name: 'Später', exact: true }).click();
    if (block > 1) {
      await moderator.getByRole('button', { name: 'Weiter', exact: true }).click();
      await sleep(700);
    }
    for (let i = 0; i < 100; i++) {
      if (await moderator.getByRole('heading', { name: 'Pause', exact: true }).count()) break;
      await moderator.getByRole('button', { name: 'Weiter', exact: true }).click();
      await sleep(700);
    }
    assert(await moderator.getByRole('heading', { name: 'Pause', exact: true }).count(), 'Soak pause absent');
    const full = await h.snapshot(h.teams[0], true), light = await h.snapshot(h.teams[0]);
    h.questions = full.fragen.map(q => ({ ...q, quiz_abschnitt_id: light.blockState.quizAbschnittId }));
    assert(h.questions.length === 4, 'Unexpected soak block fixture');
    const check = { block, id: light.blockState.quizAbschnittId, types: h.questions.map(q => q.interaction.type) };
    h.checks.blocks.push(check);
    onBlockReady?.({ h, block });
    // Each block runs for at least fifteen minutes including its normal countdown.
    const endWriting = performance.now() + 14 * 60000;
    await Promise.all(h.teams.map(async team => {
      let n = 0;
      await sleep(team.index * 83 % 3000);
      while (performance.now() < endWriting) {
        if (h.pausedTeams.has(team.index)) { await sleep(1000); continue; }
        const question = h.questions[n % h.questions.length];
        const answer = answerFor(question, block * 1000000 + team.index * 1000 + Math.floor(n / 4));
        n++;
        await h.save(team, question, answer.text, answer.extra);
        // Staggered bursts of four edits, then a 12–24 second thinking pause.
        await sleep(n % 4 ? 2000 + (n * 719 + team.index * 997) % 3001 : 12000 + team.index * 733 % 12001);
      }
    }));
    check.beforeClose = await h.verify();
    assert(check.beforeClose.every(c => c.validSession && !c.errors.length), 'Soak draft integrity mismatch');
    await beforeCountdown?.({ h, block });
    h.phase = `soak-peak-${block}`; onProgress(h.phase);
    await moderator.getByRole('spinbutton').fill('1');
    await moderator.getByRole('button', { name: 'Countdown starten', exact: true }).click();
    let state = await h.snapshot(h.teams[0]);
    for (let i = 0; i < 20 && state.presentationState.countdownStatus !== 'running'; i++) {
      await sleep(200); state = await h.snapshot(h.teams[0]);
    }
    assert(state.presentationState.countdownStatus === 'running', 'Soak countdown absent');
    const deadline = Date.parse(state.presentationState.countdownStartedAt) + 60000;
    const target = performance.now() + deadline - Date.parse(state.serverNow);
    check.deadline = new Date(deadline).toISOString();
    await moderator.reload(); await presentation.reload();
    const afterReload = await h.snapshot(h.teams[0]);
    assert(afterReload.presentationState.countdownStartedAt === state.presentationState.countdownStartedAt, 'Soak reload moved deadline');
    check.peak = await Promise.all(h.teams.map(async (team, index) => {
      const offset = index < 28 ? -2800 + index * 85 : 1000 + index * 10;
      await sleep(Math.max(0, target + offset - performance.now()));
      const answer = answerFor(h.questions[0], block * 9000000 + index);
      if (answer.extra.antwortId && team.confirmed.get(h.questions[0].quiz_fragen_id)?.selectedAnswerIds?.[0] === answer.extra.antwortId) {
        const options = h.questions[0].interaction.options;
        answer.extra.antwortId = options[(options.findIndex(option => option.id === answer.extra.antwortId) + 1) % options.length].id;
      }
      const result = await h.save(team, h.questions[0], answer.text, answer.extra);
      return { team: index, intendedLate: offset > 0, accepted: result.success === true, serverAt: result.draftUpdatedAt, reason: result.reason ?? result.error };
    }));
    assert(!check.peak.some(r => r.accepted && (r.intendedLate || Date.parse(r.serverAt) >= deadline)), 'Soak late write accepted');
    check.final = await h.verify();
    assert(check.final.every(c => c.closed && c.validSession && !c.errors.length), 'Soak final mismatch');
    await moderator.reload(); await presentation.reload();
    assert(/00\s*:\s*00/.test(await moderator.locator('body').innerText()), 'Soak moderator not closed');
    assert(/00\s*:\s*00/.test(await presentation.locator('body').innerText()), 'Soak presentation not closed');
    await h.report(`soak-block-${block}`);
    await afterBlockClosed?.({ h, block, check });
  }
  await h.stopPolling();
  h.checks.elapsedMs = performance.now() - h.started;
  h.checks.endedAt = new Date().toISOString();
  assert(h.checks.elapsedMs >= 30 * 60000, 'Soak duration too short');
  onProgress('soak-complete');
  return h.report('soak-complete');
}
