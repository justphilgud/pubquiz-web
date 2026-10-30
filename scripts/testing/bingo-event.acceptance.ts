import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import type {Client} from "pg";
import type * as EventApi from "../../app/bingo/live/eventRepository.server";
import type * as Creation from "../../app/bingo/eventCreation.server";
import type * as Prep from "../../app/bingo/preparation/repository.server";
import {eventSeriesSettingsRevision} from "../../app/eventreihen/settingsRevision";
import type * as Settings from "../../app/eventreihen/settingsRepository.server";
import type {EventCommand} from "../../app/bingo/live/eventRun";
export async function exerciseBingoEvent(db:Client,api:typeof EventApi,creation:typeof Creation,prep:typeof Prep,settings:typeof Settings){
 const input={seriesId:10,title:"V3.1 three plus one",date:"",time:"",roundCount:3,requestId:randomUUID()};
 const creates=await Promise.all([creation.createBingoEvent(1,input),creation.createBingoEvent(1,input)]);assert.equal(creates[0].id,creates[1].id);const game=creates[0];
 await assert.rejects(creation.createBingoEvent(1,{...input,title:"changed"}),/anderen Angaben/);
 for(const userId of [2,4,5,6])await assert.rejects(creation.createBingoEvent(userId,{...input,requestId:randomUUID()}));
 let pv=await prep.readPreparation(1,game.id);assert.equal(pv.roundCount,3);assert.equal(pv.seriesCount,0);
 const first=pv.rounds[0].id;
 await prep.writePreparation(1,{gameId:game.id,expectedSeriesId:10,revision:pv.revision,operation:"generate",roundId:first,count:3,requestId:randomUUID()});
 pv=await prep.readPreparation(1,game.id);const source=pv.rounds[0].series[0].id;
 for(const r of pv.rounds.slice(1)){
  let current=await prep.readPreparation(1,game.id);await prep.writePreparation(1,{gameId:game.id,expectedSeriesId:10,revision:current.revision,operation:"saveRound",roundId:r.id,label:r.label,target:30,strategy:"EXISTING",issued:null});
  current=await prep.readPreparation(1,game.id);await prep.writePreparation(1,{gameId:game.id,expectedSeriesId:10,revision:current.revision,operation:"attach",roundId:r.id,seriesId:source});
 }
 pv=await prep.readPreparation(1,game.id);const start={gameId:game.id,requestId:randomUUID(),expectedSeriesId:10,preparationRevision:pv.revision};
 const starts=await Promise.all([api.startEventRun(1,start),api.startEventRun(1,start)]);assert.equal(starts[0].runId,starts[1].runId);const runId=starts[0].runId;
 const view=()=>api.readEventModeration(1,game.id,runId);
 const request=async(command:EventCommand)=>({gameId:game.id,runId,requestId:randomUUID(),revision:(await view()).live!.revision,command});
 const send=async(command:EventCommand)=>{const r=await request(command);await api.commandEventRun(1,r);return r.requestId;};
 const original=(await view()).live!,card=original.cards[0];
 for(const userId of [2,4,5,6]){await assert.rejects(api.readEventModeration(userId,game.id,runId));await assert.rejects(api.commandEventRun(userId,await request({kind:"pause"})));}
 for(const n of card.cells[0])await send({kind:"draw",number:n!});
 const atCall=(await view()).live!,a=await request({kind:"call",stage:"BINGO",context:atCall.callContext}),b={...a,requestId:randomUUID(),command:{kind:"call" as const,stage:"DOUBLE" as const,context:atCall.callContext}};
 await Promise.all([api.commandEventRun(1,a),api.commandEventRun(1,b)]);assert.equal((await view()).live!.state.calls.length,2);
 await api.commandEventRun(1,a);assert.equal((await view()).live!.state.calls.length,2);
 await assert.rejects(send({kind:"draw",number:75}),/OPEN_CLAIMS/);await assert.rejects(send({kind:"closeRound"}),/OPEN_CLAIMS/);
 for(const call of [a,b])await send({kind:"identify",callId:call.requestId,cardId:card.id});
 await send({kind:"decide",callId:a.requestId,action:"CONFIRM",reason:"Linie"});await send({kind:"decide",callId:b.requestId,action:"REJECT",reason:"Nur eine Linie"});
 const prior=(await view()).live!,draw=prior.state.run.rounds[0].draws[0];
 await send({kind:"correct",drawId:draw.id,number:Array.from({length:75},(_,i)=>i+1).find(n=>!prior.state.run.rounds[0].draws.some(d=>d.number===n))!,reason:"Frühere Ziehung korrigiert"});
 const corrected=(await view()).live!;assert.equal(corrected.state.run.rounds[0].draws[0].id,draw.id);assert.equal(corrected.state.run.rounds[0].draws.at(-1)?.number,prior.state.run.rounds[0].draws.at(-1)?.number);assert.equal(corrected.blocked,true);
 await assert.rejects(send({kind:"draw",number:74}),/OPEN_CLAIMS/);
 await assert.rejects(api.commandEventRun(1,{...a,requestId:randomUUID()}),/CALL_CONTEXT_CONFLICT/);
 await send({kind:"decide",callId:a.requestId,action:"REVOKE",reason:"Nachprüfung"});
 await send({kind:"closeRound"});const history=JSON.stringify((await view()).live!.state.run.rounds[0]);
 await assert.rejects(send({kind:"correct",drawId:draw.id,number:74,reason:"Geschlossen"}),/ROUND_NOT_OPEN/);
 for(const round of pv.rounds.slice(1)){
  const current=await view();await send({kind:"startRound",roundId:round.id,preparationRevision:current.preparationRevision});
  const live=(await view()).live!;assert.equal(live.state.run.rounds.at(-1)!.draws.length,0);assert.equal(JSON.stringify(live.state.run.rounds[0]),history);
  if(round.id===pv.rounds[1].id){const current=await view();await send({kind:"appendRound",label:"Zusatzrunde",target:30,preparationRevision:current.preparationRevision});}
  await send({kind:"closeRound"});
 }
 let current=await view();const extra=current.rounds.find(r=>r.label==="Zusatzrunde")!;assert.ok(extra);
 await assert.rejects(send({kind:"startRound",roundId:extra.id,preparationRevision:current.preparationRevision}),/NO_ASSIGNED_CARDS/);
 pv=await prep.readPreparation(1,game.id);await prep.writePreparation(1,{gameId:game.id,expectedSeriesId:10,revision:pv.revision,operation:"generate",roundId:extra.id,count:2,requestId:randomUUID()});
 current=await view();await send({kind:"startRound",roundId:extra.id,preparationRevision:current.preparationRevision});await send({kind:"pause"});assert.equal((await view()).live!.state.run.status,"PAUSED");await send({kind:"resume"});await send({kind:"closeRound"});await send({kind:"end"});
 assert.equal((await view()).live!.summary.length,4);assert.equal((await view()).live!.state.run.status,"ENDED");assert.equal(JSON.stringify((await view()).live!.state.run.rounds[0]),history);
 await assert.rejects(send({kind:"resume"}),/RUN_ENDED/);
 const newPreparation=await api.readEventModeration(1,game.id,undefined,true);assert.equal(newPreparation.live,null);assert.equal(newPreparation.runs.length,1);
 const historicLabel=(await view()).live!.round.label;let editable=await prep.readPreparation(1,game.id);await prep.writePreparation(1,{gameId:game.id,expectedSeriesId:10,revision:editable.revision,operation:'saveRound',roundId:first,label:'Neue Vorbereitung',target:30,strategy:'NEW',issued:null});editable=await prep.readPreparation(1,game.id);
 const restarted=await api.startEventRun(1,{gameId:game.id,expectedSeriesId:10,preparationRevision:editable.revision,requestId:randomUUID()});assert.notEqual(restarted.runId,runId);assert.equal((await view()).live!.round.label,historicLabel);assert.equal((await api.readEventModeration(1,game.id,restarted.runId)).live!.state.run.rounds[0].draws.length,0);
 const audience=await api.readEventAudience(1,(await view()).live!.audienceKey);assert.equal(audience.status,"ENDED");assert.equal(audience.draws.length,0);
 await assert.rejects(db.query("UPDATE pubquiz.bingo_event_rounds SET round_snapshot='{}' WHERE run_id=$1",[runId]));

 // Real competing transactions, not a mocked lock-order assertion.
 await db.query("INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug)VALUES(90,'Atomic settings','atomic-settings');INSERT INTO pubquiz.eventreihe_eventarten(eventreihe_id,eventart,ist_freigeschaltet)SELECT 90,t,true FROM unnest(ARRAY['QUIZ','BINGO','POWERPOINT_KARAOKE'])t;INSERT INTO pubquiz.eventreihe_verwaltung(benutzer_id,eventreihe_id)VALUES(6,90)");
 const savedSeries=async()=>{const row=(await db.query(`SELECT *,to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS revision_time FROM pubquiz.eventreihen WHERE eventreihe_id=90`)).rows[0];const products=(await db.query('SELECT eventart,ist_freigeschaltet FROM pubquiz.eventreihe_eventarten WHERE eventreihe_id=90')).rows;return {row,revision:eventSeriesSettingsRevision(row.revision_time,products,row.logo_url),value:{name:row.name,publicName:row.oeffentlicher_name,description:row.beschreibung,internalNote:row.interne_bemerkung,reservationUrl:row.reservierungs_url,isPublic:row.ist_oeffentlich,defaultPresentationTemplateId:row.default_presentation_template_id,defaultAnswerFormTemplateId:row.default_answer_form_template_id}};};
 const baseline=await savedSeries();
 await assert.rejects(settings.persistSeriesSettings(6,90,{...baseline.value,name:'Forbidden product change'},{expectedRevision:baseline.revision,enabledEventTypes:[]}));
 assert.equal((await savedSeries()).revision,baseline.revision);
 const edits=await Promise.allSettled(['First save','Other tab'].map(name=>settings.persistSeriesSettings(1,90,{...baseline.value,name},{expectedRevision:baseline.revision})));
 assert.equal(edits.filter(r=>r.status==='fulfilled').length,1,edits.map(r=>r.status==='rejected'?String(r.reason):'saved').join(' | '));assert.equal(edits.filter(r=>r.status==='rejected').length,1);
 const raceGame=await creation.createBingoEvent(1,{...input,seriesId:90,title:'Concurrent start and deactivate',roundCount:1,requestId:randomUUID()});
 let racePrep=await prep.readPreparation(1,raceGame.id);
 await prep.writePreparation(1,{gameId:raceGame.id,expectedSeriesId:90,revision:racePrep.revision,operation:'generate',roundId:racePrep.rounds[0].id,count:1,requestId:randomUUID()});racePrep=await prep.readPreparation(1,raceGame.id);
 const beforeRace=await savedSeries();
 const race=await Promise.allSettled([api.startEventRun(1,{gameId:raceGame.id,expectedSeriesId:90,preparationRevision:racePrep.revision,requestId:randomUUID()}),settings.persistSeriesSettings(1,90,{...beforeRace.value,name:'Disabled atomically'},{expectedRevision:beforeRace.revision,enabledEventTypes:['QUIZ','POWERPOINT_KARAOKE']})]);
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.filter(r=>r.status==='rejected').length,1);
 const product=(await db.query("SELECT ist_freigeschaltet enabled FROM pubquiz.eventreihe_eventarten WHERE eventreihe_id=90 AND eventart='BINGO'")).rows[0].enabled;
 let running=(await db.query("SELECT id FROM pubquiz.bingo_live_runs WHERE game_id=$1 AND status IN ('RUNNING','PAUSED')",[raceGame.id])).rows;
 assert.equal(product,running.length===1);
 if(!running.length){const current=await savedSeries();await settings.persistSeriesSettings(1,90,current.value,{expectedRevision:current.revision,enabledEventTypes:["QUIZ","BINGO","POWERPOINT_KARAOKE"]});const started=await api.startEventRun(1,{gameId:raceGame.id,expectedSeriesId:90,preparationRevision:racePrep.revision,requestId:randomUUID()});running=[{id:started.runId}];}
 if(running.length){
  const paused=await api.readEventModeration(1,raceGame.id,running[0].id);
  await api.commandEventRun(1,{gameId:raceGame.id,runId:running[0].id,requestId:randomUUID(),revision:paused.live!.revision,command:{kind:'pause'}});
  const beforeBlocked=await savedSeries();await assert.rejects(settings.persistSeriesSettings(1,90,{...beforeBlocked.value,name:'Must roll back'},{expectedRevision:beforeBlocked.revision,enabledEventTypes:[]}));
  assert.equal((await savedSeries()).revision,beforeBlocked.revision);assert.equal((await savedSeries()).row.name,beforeBlocked.row.name);
 }
 console.info('V3.1 PostgreSQL series CAS, management-only product denial, atomic rollback and start/deactivation race: PASS');
 console.info("V3.1 PostgreSQL atomic creation, independent calls/retries, stale contexts, historical correction, four rounds and immutable bindings: PASS");
}
