import { writeFile } from 'node:fs/promises';

// observedUrl is the authenticated, read-only request-log URL emitted by the
// existing Vercel Logs UI after filtering to the immutable Preview hostname.
export async function collectServerLogs({ request, observedUrl, origin, start, end, output }) {
  const url = new URL(observedUrl);
  if (url.origin !== 'https://vercel.com' || url.pathname !== '/api/logs/request-logs') throw new Error('Unexpected log endpoint');
  if (url.searchParams.get('search') !== `requestHost:${new URL(origin).hostname}`) throw new Error('Preview filter required');
  url.searchParams.set('startDate', String(start));
  url.searchParams.set('endDate', String(end));
  const rows = [];
  const seen = new Set();
  let complete = false;
  for (let page = 0; page < 50; page++) {
    // Time is the cursor. Keep page zero to avoid applying two offsets.
    url.searchParams.set('page', '0');
    let response;
    try { response = await request.get(url.toString(), { timeout: 15000 }); }
    catch (error) { throw new Error(String(error).split('\n')[0]); }
    if (!response.ok()) throw new Error(`Log read ${response.status()}`);
    const data = await response.json();
    await response.dispose();
    if (data.rows?.length && data.rows.every(row => seen.has(row.requestId))) break;
    for (const row of data.rows ?? []) {
      if (seen.has(row.requestId)) continue;
      seen.add(row.requestId);
      if (row.environment !== 'preview' || row.domain !== new URL(origin).hostname) throw new Error('Unexpected log scope');
      rows.push({
        requestId: row.requestId, timestamp: row.timestamp, path: row.requestPath,
        status: row.statusCode, durationMs: row.requestDurationMs,
        errorCode: row.errorCode, crashed: row.hasFunctionCrashed,
        functions: (row.functionEvents ?? []).filter(e => e.route !== '/_middleware').map(e => ({
          durationMs: e.durationMs, memoryMB: e.functionMaxMemoryUsed,
          concurrency: e.concurrency, instance: e.instanceId, cold: e.functionStartType,
        })),
        diagnostics: (row.logs ?? []).flatMap(l => {
          if (!l.message?.startsWith('live-performance ')) return [];
          try { return [JSON.parse(l.message.slice('live-performance '.length))]; } catch { return []; }
        }),
        errors: (row.logs ?? []).filter(l => ['error', 'fatal'].includes(l.level)).map(l => l.message),
      });
    }
    if (!data.hasMoreRows) { complete = true; break; }
    // The UI's page number is not a server offset. Walk the descending time
    // boundary, retain ties, and deduplicate request IDs between pages.
    const earliest = Math.min(...data.rows.map(row => Date.parse(row.timestamp)));
    if (!Number.isFinite(earliest) || earliest <= start) { complete = true; break; }
    url.searchParams.set('endDate', String(earliest));
  }
  const result = { origin, start: new Date(start).toISOString(), end: new Date(end).toISOString(), complete, rows };
  await writeFile(output, JSON.stringify(result, null, 2));
  return { complete, count: rows.length, errors: rows.filter(r => r.status >= 500 || r.crashed || r.errors.length).length };
}
