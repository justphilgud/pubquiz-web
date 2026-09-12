import { readFile } from 'node:fs/promises';
import { quantiles } from './ap9-3-load.mjs';

// Read-only analysis of sanitized generator evidence. Expected late/conflict
// rejections stay separate from HTTP/transport failures and successful latency.
for (const path of process.argv.slice(2)) {
  const data = JSON.parse(await readFile(path, 'utf8'));
  const records = data.records;
  if (!records?.length) continue;
  const start = records.reduce((min, r) => Math.min(min, Date.parse(r.at)), Infinity);
  const end = records.reduce((max, r) => Math.max(max, Date.parse(r.at) + r.ms), -Infinity);
  const network = records.filter(r => !['generator-timer', 'static-probe'].includes(r.kind));
  const failures = network.filter(r => r.status >= 500 || !r.status);
  const successfulSave = records.filter(r => r.kind === 'save' && r.success);
  const deadlines = data.checks?.blocks?.map(b => b.deadline).filter(Boolean) ?? [data.checks?.deadline].filter(Boolean);
  const closedObservations = deadlines.map(deadline => {
    const at = Date.parse(deadline);
    const first = records.filter(r => r.kind === 'snapshot' && r.closed && Date.parse(r.serverAt) >= at)
      .reduce((min, r) => Math.min(min, Date.parse(r.serverAt) - at), Infinity);
    return { deadline, firstClosedServerObservationAfterMs: Number.isFinite(first) ? first : null };
  });
  const bins = [];
  for (let at = start; at < end; at += 300000) {
    const samples = successfulSave.filter(r => Date.parse(r.at) >= at && Date.parse(r.at) < at + 300000);
    const timers = records.filter(r => r.kind === 'generator-timer' && Date.parse(r.at) >= at && Date.parse(r.at) < at + 300000);
    bins.push({ minute: (at - start) / 60000, save: quantiles(samples.map(r => r.ms)),
      generatorRssMB: timers.length ? Math.max(...timers.map(r => r.rssMB)) : null });
  }
  console.log(JSON.stringify({ name: data.name, elapsedSeconds: (end - start) / 1000,
    requestCount: network.length, requestsPerSecond: network.length / ((end - start) / 1000),
    http5xxOrTransport: failures.length, errorPercent: failures.length / network.length * 100,
    retries: network.filter(r => r.attempt > 0 || r.kind === 'join-retry').length,
    conflicts: network.filter(r => /CONFLICT/.test(r.reason)).length,
    timeouts: network.filter(r => r.reason === 'TIMEOUT').length,
    successfulSave: quantiles(successfulSave.map(r => r.ms)),
    allSave: data.summary.save, join: data.summary.join, snapshot: data.summary.snapshot,
    lostConfirmed: data.lostConfirmed, closedObservations, bins }, null, 2));
}
