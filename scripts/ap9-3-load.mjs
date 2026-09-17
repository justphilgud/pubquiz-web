import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function quantiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = p => sorted.length ? Math.round(sorted[Math.ceil(p * sorted.length) - 1]) : null;
  return { count: sorted.length, p50: at(.5), p95: at(.95), p99: at(.99), max: sorted.at(-1) ?? null };
}

// Uses an already authenticated Preview browser's APIRequestContext. No secrets
// or response bodies are written to measurement files. Sessions stay in memory.
export async function createLoadHarness({ request, origin, quizId, artifactDir }) {
  if (!/^https:\/\/pubquiz-[a-z0-9]+-just-phil-gud\.vercel\.app$/.test(origin)) {
    throw new Error('An immutable PubQuiz Preview URL is required');
  }
  if (!Number.isSafeInteger(quizId) || quizId < 1) throw new Error('Invalid quiz');
  await mkdir(artifactDir, { recursive: true });
  const h = { origin, quizId, teams: [], records: [], active: false, tasks: [], phase: 'setup', lostConfirmed: 0 };
  h.call = async (kind, path, data, meta = {}) => {
    const start = performance.now();
    const record = { kind, phase: h.phase, at: new Date().toISOString(), ...meta };
    let response;
    try {
      response = await request.post(origin + path, { data, timeout: kind === 'join' ? 30000 : 12000 });
      record.status = response.status();
      const body = await response.json();
      record.includesAnswerStatus = Boolean(body.answerStatus);
      record.success = response.ok() && body.success !== false && !body.error;
      record.reason = body.reason ?? body.error ?? (body.success === false ? body.message : null);
      record.serverAt = body.draftUpdatedAt ?? body.serverNow ?? null;
      if (body.blockState) record.closed = body.blockState.isClosed;
      return body;
    } catch (error) {
      record.success = false;
      record.reason = /timeout/i.test(String(error)) ? 'TIMEOUT' : 'TRANSPORT_OR_JSON_ERROR';
      record.transport = String(error).split('\n')[0].slice(0, 240);
      return { success: false, error: record.reason };
    } finally {
      record.ms = performance.now() - start;
      h.records.push(record);
      await response?.dispose();
    }
  };
  h.snapshot = async (team, full = false, client = 0) => {
    team.clientStates ??= new Map();
    const known = team.clientStates.get(client);
    const result = await h.call('snapshot', '/api/quiz/team-live-snapshot', {
      quizId, quizTeamSessionToken: team.session.sessionToken, includeAnswerStatus: full,
      ...(full ? {} : { knownLiveRevision: known?.revision, knownActiveQuizFragenId: known?.question }),
    }, { team: team.index, client, full });
    if (!result.error && result.liveRevision) team.clientStates.set(client, {
      revision: result.answerStatus?.liveRevision ?? result.liveRevision,
      question: full ? result.activeQuizFragenId : result.activeQuestionReference?.quizFragenId ?? null,
    });
    return result;
  };
  h.joinTeams = async count => {
    const stamp = Date.now();
    const pending = Array.from({ length: count }, async (_, index) => {
      const input = { quizId, teamname: `AP93 ${stamp} T${index + 1}`, spielerAnzahl: 4, joinRequestId: randomUUID() };
      let result = await h.call('join', '/api/quiz/team-session', input, { team: index });
      if (!result.success) {
        await sleep(2000);
        result = await h.call('join-retry', '/api/quiz/team-session', input, { team: index });
      }
      if (!result.success) return { index, failed: true };
      const team = { index, input, session: result.session, revisions: new Map(), confirmed: new Map(), pending: new Map() };
      return team;
    });
    h.teams = await Promise.all(pending);
    return { joined: h.teams.filter(t => !t.failed).length, requested: count,
      distinctSessions: new Set(h.teams.filter(t => !t.failed).map(t => t.session.quiz_team_session_id)).size };
  };
  h.save = async (team, question, text, extra = {}) => {
    const key = question.quiz_fragen_id;
    const intended = { answerText: text, selectedAnswerIds: extra.antwortIds ?? (extra.antwortId ? [extra.antwortId] : []),
      structuredAnswers: (extra.antwortfelder ?? []).map(f => ({ fieldId: f.antwortfeldId, answerText: f.antwortText })) };
    team.pending.set(key, intended);
    const payload = {
      quizId, quizAbschnittId: question.quiz_abschnitt_id, quizFragenId: key,
      interactionRunId: question.interactionRun.id,
      expectedDraftRevision: team.revisions.get(key) ?? 0,
      quizTeamSessionToken: team.session.sessionToken,
      antwortText: text, antwortId: null, ...extra,
    };
    let result;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt) await sleep([2000, 5000, 10000][attempt - 1]);
      result = await h.call('save', '/api/quiz/team-answer-draft', payload,
        { team: team.index, question: key, intended, baseRevision: payload.expectedDraftRevision, attempt });
      if (!result.error) break;
    }
    if (result.success) {
      team.revisions.set(key, result.draftRevision);
      team.confirmed.set(key, result.confirmedDraft);
      team.pending.delete(key);
    }
    return result;
  };
  h.startPolling = (clientsPerTeam = 1) => {
    h.active = true;
    h.tasks = h.teams.filter(t => !t.failed).flatMap(team => Array.from({ length: clientsPerTeam }, (_, client) => (async () => {
      await sleep((team.index * 47 + client * 197) % 500);
      let failures = 0;
      while (h.active) {
        const result = await h.snapshot(team, false, client);
        failures = result.error ? Math.min(failures + 1, 4) : 0;
        await sleep(Math.min(8000, 500 * 2 ** failures));
      }
    })()));
    h.tasks.push((async () => {
      while (h.active) {
        const start = performance.now();
        const record = { kind: 'static-probe', phase: h.phase, at: new Date().toISOString() };
        let response;
        try {
          response = await request.get(origin + '/favicon.ico', { timeout: 5000 });
          record.status = response.status(); record.success = response.ok();
        } catch (error) { record.success = false; record.transport = String(error).split('\n')[0].slice(0, 240); }
        finally { record.ms = performance.now() - start; h.records.push(record); await response?.dispose(); }
        const before = performance.now(); await sleep(2000);
        h.records.push({ kind: 'generator-timer', phase: h.phase, at: new Date().toISOString(), success: true,
          ms: Math.max(0, performance.now() - before - 2000), rssMB: process.memoryUsage().rss / 1024 / 1024 });
      }
    })());
  };
  h.stopPolling = async () => { h.active = false; await Promise.all(h.tasks); };
  h.verify = async () => {
    const checks = await Promise.all(h.teams.filter(t => !t.failed).map(async team => {
      const full = await h.snapshot(team, true);
      if (full.error) return { team: team.index, errors: [], recovered: [], unverifiable: true, validSession: false };
      const errors = [];
      const recovered = [];
      for (const [id, expected] of team.confirmed) {
        const confirmation = full.answerConfirmations?.find(a => a.questionId === id);
        const actual = confirmation?.value;
        const matches = candidate => actual && candidate && actual.antwortText === candidate.answerText &&
          JSON.stringify(actual.antwortIds ?? []) === JSON.stringify(candidate.selectedAnswerIds ?? []) &&
          (candidate.structuredAnswers ?? []).every(f => actual.antwortfelder?.[f.fieldId] === f.answerText);
        if (matches(expected)) continue;
        if (matches(team.pending.get(id))) {
          // A lost response may hide a newer, successfully committed OWN edit.
          // Reconcile it from the authenticated snapshot; this is not data loss.
          team.confirmed.set(id, team.pending.get(id));
          team.pending.delete(id);
          team.revisions.set(id, confirmation.revision);
          recovered.push({ question: id, revision: confirmation.revision });
        } else errors.push(id);
      }
      return { team: team.index, errors, recovered, closed: full.blockIstGesperrt, validSession: !full.error };
    }));
    h.lostConfirmed = checks.reduce((n, c) => n + c.errors.length, 0);
    return checks;
  };
  h.report = async name => {
    const kinds = [...new Set(h.records.map(r => r.kind))];
    const summary = Object.fromEntries(kinds.map(kind => {
      const rows = h.records.filter(r => r.kind === kind);
      return [kind, { ...quantiles(rows.map(r => r.ms)), success: rows.filter(r => r.success).length,
        reasons: rows.filter(r => !r.success).reduce((out, r) => ({ ...out, [r.reason]: (out[r.reason] ?? 0) + 1 }), {}) }];
    }));
    const byPhase = Object.fromEntries([...new Set(h.records.map(r => r.phase))].map(phase => [phase,
      Object.fromEntries(kinds.map(kind => {
        const rows = h.records.filter(r => r.kind === kind && r.phase === phase);
        return [kind, { ...quantiles(rows.map(r => r.ms)), failed: rows.filter(r => !r.success).length }];
      }))]));
    const result = { origin, quizId, name, summary, byPhase, checks: h.checks ?? {}, lostConfirmed: h.lostConfirmed, records: h.records };
    await writeFile(join(artifactDir, name + '.json'), JSON.stringify(result, null, 2));
    return { name, summary, byPhase, checks: h.checks ?? {}, lostConfirmed: h.lostConfirmed };
  };
  return h;
}

export function answerFor(question, ordinal) {
  const interaction = question.interaction;
  if (interaction.type === 'NUMBER') return { text: String(604800 + ordinal % 100), extra: {} };
  if (interaction.type === 'MULTI_CHOICE') return { text: null, extra: { antwortIds: [interaction.options[ordinal % interaction.options.length].id] } };
  if (interaction.type === 'SINGLE_CHOICE') return { text: null, extra: { antwortId: interaction.options[ordinal % interaction.options.length].id } };
  if (interaction.type === 'ORDER') {
    const ids = interaction.items.map(item => item.id);
    const offset = ordinal % ids.length;
    return { text: JSON.stringify([...ids.slice(offset), ...ids.slice(0, offset)]), extra: {} };
  }
  if (interaction.type === 'STRUCTURED_TEXT') return { text: null, extra: { antwortfelder: interaction.fields.map(field => ({ antwortfeldId: field.id, antwortText: `Field ${ordinal}` })) } };
  return { text: `AP93 confirmed edit ${ordinal}`, extra: {} };
}

export async function runLevel({ h, moderator, presentation, count, onProgress = () => {} }) {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const qurl = `${h.origin}/quiz/${h.quizId}`;
  h.phase = `${count}-setup`;
  onProgress(h.phase);
  await moderator.goto(qurl + '/moderation');
  if (await moderator.getByRole('button', { name: 'Später', exact: true }).count()) await moderator.getByRole('button', { name: 'Später', exact: true }).click();
  try {
    await moderator.getByRole('button', { name: 'Quiz zurücksetzen', exact: true }).click({ timeout: 2000 });
  } catch (error) {
    // The finished-countdown dialog can appear after the first live poll.
    const later = moderator.getByRole('button', { name: 'Später', exact: true });
    if (!await later.isVisible()) throw error;
    await later.click();
    await moderator.getByRole('button', { name: 'Quiz zurücksetzen', exact: true }).click();
  }
  await moderator.getByRole('button', { name: 'Durchlauf zurücksetzen', exact: true }).click();
  await moderator.getByRole('button', { name: 'Quiz starten', exact: true }).click();
  for (let i = 0; i < 100; i++) {
    if (await moderator.getByRole('heading', { name: 'Pause', exact: true }).count()) break;
    await moderator.getByRole('button', { name: 'Weiter', exact: true }).click();
    await sleep(700);
  }
  assert(await moderator.getByRole('heading', { name: 'Pause', exact: true }).count(), 'No pause reached');
  await presentation.goto(qurl + '/praesentation');
  h.phase = `${count}-join`;
  onProgress(h.phase);
  h.checks = { join: await h.joinTeams(count) };
  assert(h.checks.join.joined === count, 'Join failed: inspect records');
  const full = await h.snapshot(h.teams[0], true);
  const light = await h.snapshot(h.teams[0]);
  const questions = full.fragen.map(q => ({ ...q, quiz_abschnitt_id: light.blockState.quizAbschnittId }));
  assert(questions.length >= 2, 'Insufficient active questions');
  h.questions = questions;
  h.checks.types = questions.map(q => q.interaction.type);
  const recoveredJoin = await h.call('join-recovery', '/api/quiz/team-session', h.teams[0].input);
  h.checks.joinRecoverySameSession = recoveredJoin.session?.quiz_team_session_id === h.teams[0].session.quiz_team_session_id;
  assert(h.checks.joinRecoverySameSession, 'Duplicate join session');
  for (const clients of [1, 2]) {
    h.phase = `${count}-${clients === 1 ? 'A' : 'B'}`;
    onProgress(h.phase);
    h.startPolling(clients);
    const end = Date.now() + 45000;
    await Promise.all(h.teams.map(async team => {
      let n = 0;
      await sleep(team.index * 137 % 2000);
      while (Date.now() < end) {
        const question = questions[n % questions.length];
        const answer = answerFor(question, team.index * 10000 + clients * 1000 + Math.floor(n / questions.length) + 1);
        n++;
        await h.save(team, question, answer.text, answer.extra);
        await sleep(2000 + ((team.index * 997 + n * 719) % 3001));
      }
    }));
    await h.stopPolling();
    assert((await h.verify()).every(c => !c.errors.length && c.validSession), 'Confirmed answer lost');
    await h.report(`baseline-${count}-${clients === 1 ? 'A' : 'B'}`);
  }
  h.phase = `${count}-peak`;
  onProgress(h.phase);
  h.startPolling(2);
  await moderator.getByRole('spinbutton').fill('1');
  await moderator.getByRole('button', { name: 'Countdown starten', exact: true }).click();
  let state = await h.snapshot(h.teams[0]);
  for (let i = 0; i < 10 && state.presentationState.countdownStatus !== 'running'; i++) { await sleep(200); state = await h.snapshot(h.teams[0]); }
  assert(state.presentationState.countdownStatus === 'running', 'Countdown not running');
  const deadline = Date.parse(state.presentationState.countdownStartedAt) + 60000;
  const target = performance.now() + deadline - Date.parse(state.serverNow);
  h.checks.deadline = new Date(deadline).toISOString();
  await moderator.reload();
  await presentation.reload();
  const reloaded = await h.snapshot(h.teams[0]);
  assert(reloaded.presentationState.countdownStartedAt === state.presentationState.countdownStartedAt, 'Reload moved deadline');
  const peakCount = Math.ceil(count * .7);
  const visibility = Promise.all([['moderator', moderator], ['presentation', presentation]].map(async ([name, page]) => {
    await sleep(Math.max(0, target - 1500 - performance.now()));
    for (let i = 0; i < 120; i++) {
      if (/00\s*:\s*00/.test(await page.locator('body').innerText())) return { name, zeroObservedAfterDeadlineMs: Math.round(performance.now() - target) };
      await sleep(100);
    }
    return { name, missing: true };
  }));
  const results = await Promise.all(h.teams.map(async (team, index) => {
    const offset = index < peakCount ? -2800 + index * (2400 / peakCount) : 1000 + index * 20;
    await sleep(Math.max(0, target + offset - performance.now()));
    const answer = answerFor(questions[0], 90000 + team.index);
    const result = await h.save(team, questions[0], answer.text, answer.extra);
    return { team: index, intendedLate: offset > 0, accepted: result.success === true, serverAt: result.draftUpdatedAt, reason: result.reason ?? result.error };
  }));
  h.checks.peak = results;
  h.checks.visibility = await visibility;
  assert(!results.some(r => r.accepted && Date.parse(r.serverAt) >= deadline), 'Server accepted after deadline');
  assert(!results.some(r => r.intendedLate && r.accepted), 'Late save accepted');
  await sleep(1500);
  state = await h.snapshot(h.teams[0]);
  assert(state.blockState.isClosed, 'Block not closed');
  h.checks.closedObservedAt = state.serverNow;
  await h.stopPolling();
  h.checks.final = await h.verify();
  assert(h.checks.final.every(c => c.closed && c.validSession && !c.errors.length), 'Final integrity mismatch');
  await moderator.reload();
  await presentation.reload();
  assert(/00\s*:\s*00/.test(await moderator.locator('body').innerText()), 'Moderator not zero');
  assert(/00\s*:\s*00/.test(await presentation.locator('body').innerText()), 'Presentation not zero');
  return h.report(`baseline-${count}-complete`);
}
