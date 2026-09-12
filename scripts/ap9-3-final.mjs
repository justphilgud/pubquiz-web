import { writeFile } from 'node:fs/promises';
import { createLoadHarness, runLevel, answerFor } from './ap9-3-load.mjs?final=79a91d4';
import * as browserChecks from './ap9-3-browser.mjs?final=79a91d4';
import { runPixel } from './ap9-3-pixel.mjs?final=79a91d4';
import { runSoak } from './ap9-3-soak.mjs?final=79a91d4';

// Call from the existing authenticated Playwright owner. Never attach another
// CDP controller or create credentials. All objects with sessions stay in RAM.
export async function runFinalAcceptance(s, artifactDir) {
  s.pipeline = { running: true, phase: 'matrix' };
  const create = quizId => createLoadHarness({ request: s.ctx.request, origin: s.origin, quizId, artifactDir });
  try {
    s.matrix = { running: true, phase: 'initializing', completed: [] };
    for (const count of [20, 40]) {
      s.matrix.current = count;
      s.load = s.currentHarness = await create(41);
      s.matrix.completed.push(await runLevel({ h: s.load, moderator: s.dm, presentation: s.ds, count,
        onProgress: phase => { s.matrix.phase = phase; } }));
    }
    s.matrix.running = false; s.finalMatrix = s.matrix; s.finalLoad = s.load;
    s.pipeline.phase = 'pixel'; s.pixelStatus = { running: true };
    s.pixelLoad = s.currentHarness = await create(42);
    s.pixelViews = [];
    s.pixelResult = await runPixel({ h: s.pixelLoad, moderator: s.dm, presentation: s.ds,
      onProgress: phase => { s.pixelStatus.phase = phase; }, reloadParticipants: async h => {
        const cookies = await s.ctx.cookies(s.origin);
        s.pixelViews = await Promise.all(h.teams.slice(0, 3).map(team => browserChecks.participantPage({ browser: s.browser, cookies, h, team })));
        await Promise.all(s.pixelViews.map(v => v.page.reload()));
      } });
    s.pixelStatus.running = false;
    for (const v of s.pixelViews) await v.context.close();
    s.pipeline.phase = 'soak'; s.soakStatus = { running: true }; s.realFinal = [];
    s.soak = s.currentHarness = await create(43);
    s.soakResult = await runSoak({ h: s.soak, moderator: s.dm, presentation: s.ds, answerFor,
      onProgress: phase => { s.soakStatus.phase = phase; },
      onBlockReady: ({ h, block }) => {
        if (block !== 1) return;
        s.browserStatus = { running: true };
        s.browserTask = (async () => {
          const cookies = await s.ctx.cookies(s.origin);
          const joined = await browserChecks.joinBrowserClients({ browser: s.browser, cookies, h });
          s.realFinal = joined.clients;
          s.finalBrowser = { joinRecovery: joined.joinRecovery, recovery: await browserChecks.checkBrowserRecovery(h, s.realFinal) };
          await writeFile(artifactDir + '/browser-under-load.json', JSON.stringify(s.finalBrowser, null, 2));
          s.browserStatus.running = false;
        })().catch(error => { s.browserStatus.running = false; s.browserStatus.error = String(error).split('\n')[0]; });
      },
      beforeCountdown: async ({ h, block }) => {
        if (block !== 1) return;
        await s.browserTask;
        if (s.browserStatus.error) throw Error(s.browserStatus.error);
        s.finalDeadlineCase = await browserChecks.prepareDeadlineFaults(h, s.realFinal);
      },
      afterBlockClosed: async ({ h, block }) => {
        if (block !== 1) return;
        h.checks.browserDeadline = await browserChecks.finishDeadlineFaults(h, s.realFinal, s.finalDeadlineCase);
        await writeFile(artifactDir + '/browser-deadline.json', JSON.stringify(h.checks.browserDeadline, null, 2));
      },
    });
    s.soakStatus.running = false; s.pipeline = { running: false, phase: 'complete' };
  } catch (error) {
    s.pipeline.running = false; s.pipeline.error = String(error).split('\n')[0];
    await s.currentHarness?.stopPolling();
    await s.currentHarness?.report('final-interrupted-' + s.pipeline.phase);
  }
}
