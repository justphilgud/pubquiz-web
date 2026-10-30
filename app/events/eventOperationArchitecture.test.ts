import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(path,"utf8");
test("shared event entries keep distinct runtime/date and ordered opt-in view links",()=>{
 const row=read("app/events/EventRow.tsx");assert.match(row,/Termin:/);assert.match(row,/entry.status/);
 assert.ok(row.indexOf('>Vorbereiten<')<row.indexOf('>Moderation<'));assert.ok(row.indexOf('>Moderation<')<row.indexOf('>Präsentation<'));
 for(const file of ['app/events/readEvents.server.ts','app/events/statusReader.server.ts'])assert.doesNotMatch(read(file),/\.create\(|\.upsert\(|\.update\(|ensureQuiz|\binitialize\w*\(|\bstartLive\(/);
 assert.match(read('app/events/readEvents.server.ts'),/hasEventTypeAccess/);
});
test("new moderation is separately scoped, retains direct calls and no embedded public preview",()=>{
 const panel=read('app/bingo/live/EventModerationPanel.tsx');assert.doesNotMatch(panel,/BingoBoard|AudienceClient|iframe/);assert.match(panel,/useContentNavigationGuard/);assert.match(panel,/PHIL_GUD.colors.yellow/);assert.match(panel,/PHIL_GUD.colors.pink/);assert.match(panel,/initial.prepareNew/);assert.match(panel,/fresh.revision<old.revision/);
 const dispatch=read('app/bingo/live/repository.server.ts');assert.match(dispatch,/readLegacyLive/);assert.match(dispatch,/row.status==="ENDED"/);
});
