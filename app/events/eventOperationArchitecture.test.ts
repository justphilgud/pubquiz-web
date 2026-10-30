import assert from "node:assert/strict";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {EventRow} from "./EventRow";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(path,"utf8");
test("shared event entries keep distinct runtime/date and ordered opt-in view links",()=>{
 const row=read("app/events/EventRow.tsx");assert.match(row,/Termin:/);assert.match(row,/entry.status/);
 assert.ok(row.indexOf('<PencilSquareIcon')<row.indexOf('<MegaphoneIcon'));assert.ok(row.indexOf('<MegaphoneIcon')<row.indexOf('<PlayIcon'));
 for(const file of ['app/events/readEvents.server.ts','app/events/statusReader.server.ts'])assert.doesNotMatch(read(file),/\.create\(|\.upsert\(|\.update\(|ensureQuiz|\binitialize\w*\(|\bstartLive\(/);
 assert.match(read('app/events/readEvents.server.ts'),/hasEventTypeAccess/);
});
test("new moderation is separately scoped, retains direct calls and no embedded public preview",()=>{
 const panel=read('app/bingo/live/EventModerationPanel.tsx');assert.doesNotMatch(panel,/BingoBoard|AudienceClient|iframe/);assert.match(panel,/useContentNavigationGuard/);assert.match(panel,/PHIL_GUD.colors.yellow/);assert.match(panel,/PHIL_GUD.colors.pink/);assert.match(panel,/initial.prepareNew/);assert.match(panel,/fresh.revision<old.revision/);
 const dispatch=read('app/bingo/live/repository.server.ts');assert.match(dispatch,/readLegacyLive/);assert.match(dispatch,/row.status==="ENDED"/);
});

test("Quiz and Bingo retain icon-only view links with accessible names and existing destinations", () => {
 for (const typeLabel of ["Quiz", "Bingo"]) {
  const html=renderToStaticMarkup(createElement(EventRow,{entry:{id:"1",title:"Testevent",seriesName:"Reihe",typeLabel,date:null,status:"Vorbereitung",prepareHref:"/prepare?returnTo=%2Fquiz",moderationHref:"/moderation",presentationHref:"/presentation"}}));
  const nav=html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/)![1];
  const links=[...nav.matchAll(/<a([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.equal(links.length,3);
  for(const link of links){assert.match(link[1],/aria-label="[^"]*Testevent"/);assert.match(link[2],/^<svg/);assert.match(link[1],/min-h-11 min-w-11/);}
  assert.match(links[0][1],/href="\/prepare\?returnTo=%2Fquiz"/);
  assert.match(links[1][1],/href="\/moderation"/);assert.match(links[2][1],/href="\/presentation"/);
  for(const link of links.slice(1))assert.match(link[1],/target="_blank"/);
 }
 const unavailable=renderToStaticMarkup(createElement(EventRow,{entry:{id:"2",title:"Entwurf",seriesName:"Reihe",typeLabel:"Karaoke",date:null,status:"Vorbereitung",prepareHref:"/prepare"}}));
 assert.doesNotMatch(unavailable,/title="Moderation"|title="Präsentieren"/);
});
