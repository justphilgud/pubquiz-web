const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (ok, message) => { if (!ok) throw new Error(message); };

export async function runPixel({ h, moderator, presentation, onProgress, reloadParticipants }) {
  const base = `${h.origin}/quiz/${h.quizId}`;
  await moderator.goto(base + '/moderation');
  if (!await moderator.getByRole('button', { name: 'Quiz starten', exact: true }).count()) {
    await moderator.getByRole('button', { name: 'Quiz zurücksetzen', exact: true }).click();
    await moderator.getByRole('button', { name: 'Durchlauf zurücksetzen', exact: true }).click();
  }
  await moderator.getByRole('button', { name: 'Quiz starten', exact: true }).click();
  await presentation.goto(base + '/praesentation');
  h.phase = 'pixel-join'; h.checks = { join: await h.joinTeams(40) };
  assert(h.checks.join.joined === 40, 'Pixel join failed');
  let state;
  for (let i = 0; i < 100; i++) {
    state = await h.snapshot(h.teams[0]);
    if (state.pixelState?.mode === 'STAGED') break;
    await moderator.getByRole('button', { name: 'Weiter', exact: true }).click();
    await sleep(600);
  }
  assert(state.pixelState?.mode === 'STAGED' && state.pixelState.effectivePixelStage === 1, 'Pixel initial stage missed');
  const full = await h.snapshot(h.teams[0], true);
  const question = full.fragen.find(q => q.quiz_fragen_id === full.activeQuizFragenId);
  assert(question, 'Pixel question contract absent');
  question.quiz_abschnitt_id = state.blockState.quizAbschnittId;
  h.questions = [question];
  h.startPolling(2);
  h.checks.stages = [];
  for (const stage of [1, 2, 3]) {
    if (stage > 1) {
      for (let i = 0; i < 160; i++) {
        state = await h.snapshot(h.teams[0]);
        if (state.pixelState.effectivePixelStage === stage) break;
        await sleep(200);
      }
    }
    assert(state.pixelState.effectivePixelStage === stage, `Pixel stage ${stage} absent`);
    h.phase = `pixel-visible-${4 - stage}`; onProgress(h.phase);
    const target = performance.now() + Date.parse(state.pixelState.stageDeadlineAt) - Date.parse(state.serverNow);
    h.checks.stages.push({ serverAt: state.serverNow, pixel: state.pixelState });
    const teams = stage === 1 ? h.teams : stage === 2 ? h.teams.slice(13) : h.teams.slice(26);
    await Promise.all(teams.map(async team => {
      const correct = stage === 1 ? team.index < 13 : stage === 2 ? team.index < 26 : true;
      const result = await h.save(team, question, correct ? 'Frosch' : `Pixel stage ${stage} team ${team.index}`);
      assert(result.success, 'Pixel stage save failed');
    }));
    if (stage < 3) {
      if (stage === 1) {
        await reloadParticipants(h);
        await moderator.reload(); await presentation.reload();
        const reloaded = await h.snapshot(h.teams[0]);
        assert(reloaded.pixelState.stageDeadlineAt === state.pixelState.stageDeadlineAt, 'Pixel reload moved deadline');
      }
      // Boundary edits remain deliberately wrong; the final correct edit must
      // earn points only from the stage in which it was actually accepted.
      await sleep(Math.max(0, target - performance.now() - 1000));
      await Promise.all(h.teams.slice(26).map(team => h.save(team, question, `Boundary ${stage} team ${team.index}`)));
    }
  }
  await sleep(25000);
  state = await h.snapshot(h.teams[0]);
  assert(state.pixelState.stageDeadlineAt === null && state.pixelState.state === 'OPEN', 'Pixel last stage closed automatically');
  h.checks.openEnded = { serverAt: state.serverNow, pixel: state.pixelState };
  h.checks.beforeClose = await h.verify();
  assert(h.checks.beforeClose.every(c => c.validSession && !c.errors.length), 'Pixel draft mismatch');
  await moderator.getByRole('button', { name: 'Block schließen', exact: true }).click();
  for (let i = 0; i < 50; i++) {
    state = await h.snapshot(h.teams[0]);
    if (state.blockState.isClosed) break;
    await sleep(200);
  }
  assert(state.blockState.isClosed, 'Pixel manual close not acknowledged');
  h.checks.manualClosedObservedAt = state.serverNow;
  h.checks.late = await Promise.all(h.teams.map(async team => {
    const result = await h.save(team, question, 'LATE PIXEL MUST NOT SAVE');
    return { team: team.index, accepted: result.success === true, reason: result.reason ?? result.error };
  }));
  assert(h.checks.late.every(r => !r.accepted), 'Pixel accepted after manual close');
  h.checks.final = await h.verify();
  assert(h.checks.final.every(c => c.closed && c.validSession && !c.errors.length), 'Pixel final mismatch');
  await h.stopPolling();
  return h.report('pixel-40-complete');
}
