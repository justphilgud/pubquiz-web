import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { answerFor, createLoadHarness, quantiles } from './ap9-3-load.mjs';
import { collectServerLogs } from './ap9-3-server-logs.mjs';

const origin = 'https://pubquiz-test-just-phil-gud.vercel.app';
const reply = body => ({ ok: () => true, status: () => 200, json: async () => body, dispose: async () => {} });
const draft = text => ({ answerText: text, selectedAnswerIds: [], structuredAnswers: [] });

test('quantiles retain tail values and sample size', () => {
  assert.deepEqual(quantiles([9, 1, 5, 3, 7]), { count: 5, p50: 5, p95: 9, p99: 9, max: 9 });
});

test('newer own edit with lost response is recovered, unrelated content is not', async () => {
  let text = 'new own edit';
  const h = await createLoadHarness({ origin, quizId: 1, artifactDir: await mkdtemp(join(tmpdir(), 'ap93-')),
    request: { post: async () => reply({ answerConfirmations: [{ questionId: 7, revision: 2,
      value: { antwortText: text, antwortIds: [], antwortfelder: {} } }] }) } });
  const team = { index: 0, session: { sessionToken: 'test-only' }, confirmed: new Map([[7, draft('old')]]),
    pending: new Map([[7, draft(text)]]), revisions: new Map([[7, 1]]) };
  h.teams = [team];
  assert.deepEqual((await h.verify())[0].recovered, [{ question: 7, revision: 2 }]);
  assert.equal(h.lostConfirmed, 0);
  assert.equal(team.revisions.get(7), 2);
  text = 'unexplained';
  assert.deepEqual((await h.verify())[0].errors, [7]);
  assert.equal(h.lostConfirmed, 1);
});

test('unavailable verification does not claim data loss', async () => {
  const h = await createLoadHarness({ origin, quizId: 1, artifactDir: await mkdtemp(join(tmpdir(), 'ap93-')),
    request: { post: async () => { throw new Error('offline'); } } });
  h.teams = [{ index: 0, session: { sessionToken: 'test-only' }, confirmed: new Map([[7, draft('old')]]) }];
  assert.equal((await h.verify())[0].unverifiable, true);
  assert.equal(h.lostConfirmed, 0);
});

test('choice and order values change across editing rounds', () => {
  const choice = { interaction: { type: 'SINGLE_CHOICE', options: [{ id: 1 }, { id: 2 }] } };
  const order = { interaction: { type: 'ORDER', items: [{ id: 'a' }, { id: 'b' }] } };
  assert.notDeepEqual(answerFor(choice, 1), answerFor(choice, 2));
  assert.notDeepEqual(answerFor(order, 1), answerFor(order, 2));
});

test('poll clients retain the refreshed private revision and request conditional full status', async () => {
  const calls = [];
  const h = await createLoadHarness({ origin, quizId: 1, artifactDir: await mkdtemp(join(tmpdir(), 'ap93-')),
    request: { post: async (_url, { data }) => {
      calls.push(data);
      return reply({ liveRevision: 'light:1', activeQuestionReference: null, answerStatus: { liveRevision: 'full:2' } });
    } } });
  const team = { index: 0, session: { sessionToken: 'test-only' } };
  await h.snapshot(team); await h.snapshot(team); await h.snapshot(team, false, 1);
  assert.equal(calls[1].knownLiveRevision, 'full:2');
  assert.equal(calls[1].knownActiveQuizFragenId, null);
  assert.equal(calls[2].knownLiveRevision, undefined, 'second device maintains its own read state');
});

test('log pagination moves time boundary and deduplicates ties', async () => {
  const observedUrl = 'https://vercel.com/api/logs/request-logs?search=requestHost%3Apubquiz-test-just-phil-gud.vercel.app';
  const row = (id, timestamp) => ({ requestId: id, timestamp, domain: new URL(origin).hostname, environment: 'preview' });
  const a = row('a', '2026-09-12T12:00:02Z'), b = row('b', '2026-09-12T12:00:01Z');
  let calls = 0;
  const result = await collectServerLogs({ observedUrl, origin, start: Date.parse('2026-09-12T12:00:00Z'), end: Date.parse('2026-09-12T12:00:03Z'),
    output: join(await mkdtemp(join(tmpdir(), 'ap93-')), 'logs.json'),
    request: { get: async url => {
      assert.equal(new URL(url).searchParams.get('page'), '0');
      if (calls++) assert.equal(new URL(url).searchParams.get('endDate'), String(Date.parse(a.timestamp)));
      return reply(calls === 1 ? { rows: [a], hasMoreRows: true } : { rows: [a, b], hasMoreRows: false });
    } } });
  assert.deepEqual(result, { complete: true, count: 2, errors: 0 });
});
