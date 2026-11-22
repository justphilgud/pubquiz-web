import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {changePrintFormat} from '../../app/bingo/preparation/printFormats';
import {execFileSync} from 'node:child_process';
import {Client as PgClient} from 'pg';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import type {Client} from 'pg';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectRow} from '../operations/acceptance-policy';
type Api=typeof import('../../app/bingo/preparation/repository.server')&{print:typeof import('../../app/bingo/preparation/printDesignRepository.server');creation:typeof import('../../app/bingo/eventCreation.server')};
/** Runs only inside the existing disposable PostgreSQL acceptance database. */
export async function exercisePrintTemplates(db:Client,api:Api){
 const migration=readFileSync('prisma/migrations/20261106210000_bingo_print_templates_v4/migration.sql','utf8');
 // Populated migration keeps every existing print/config/identity byte intact.
 const rows=async()=> (await db.query(`SELECT jsonb_build_object('cards',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM pubquiz.bingo_cards c),'series',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM pubquiz.bingo_card_series s),'versions',(SELECT jsonb_agg(to_jsonb(v) ORDER BY series_id,version) FROM pubquiz.bingo_print_versions v),'games',(SELECT jsonb_agg(to_jsonb(g) ORDER BY id) FROM pubquiz.game_drafts g),'rounds',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM pubquiz.bingo_rounds r)) data`)).rows[0].data;
 const before=await rows();await db.query(migration.replace(/COMMIT;\s*$/,'ROLLBACK;'));assert.deepEqual(await rows(),before);await db.query(migration);assert.deepEqual(await rows(),before);
 const game=await api.creation.createBingoEvent(1,{seriesId:10,title:'V4 isolated acceptance',date:'',time:'',roundCount:1,requestId:randomUUID()}),target={kind:'BINGO',id:game.id};
 let data=await api.print.readPrintDesign(1,target);
 for(const id of ['bingo-print-phil-gud','bingo-print-lovd-phil-gud'])assert.ok(data.templates.some(t=>t.id===id));
 for(const id of ['phil-gud','missing-print',randomUUID()])await assert.rejects(api.print.savePrintDesign(1,{target,expectedStateHash:data.stateHash,config:{version:2,templateId:id,format:'A4_FOUR'}}));
 const selection={version:2,templateId:'bingo-print-lovd-phil-gud',format:'A4_SIX'};
 for(const user of [2,4,5,6])await assert.rejects(api.print.savePrintDesign(user,{target,expectedStateHash:data.stateHash,config:selection}));
 await api.print.savePrintDesign(1,{target,expectedStateHash:data.stateHash,config:selection});data=await api.print.readPrintDesign(1,target);assert.deepEqual(data.selection,selection);assert.equal(data.settings.layout?.version,4);assert.equal(data.settings.layout?.format,'A4_SIX');
 let prep=await api.readPreparation(1,game.id);const command={gameId:game.id,expectedSeriesId:10,revision:prep.revision,operation:'generate',roundId:prep.rounds[0].id,count:7,requestId:randomUUID()};const generated=await api.writePreparation(1,command);const sid=generated.seriesId!;
 const original=await api.readExport(1,game.id,sid,1,7);assert.equal(original.snapshot.version,4);const originalCards=original.cards;
 data=await api.print.readPrintDesign(1,target);await api.print.savePrintDesign(1,{target,expectedStateHash:data.stateHash,config:{...selection,templateId:'bingo-print-phil-gud',format:'A6_ONE'}});
 const preview=await api.print.previewPrintDesign(1,{target,seriesId:sid});prep=await api.readPreparation(1,game.id);
 await api.print.redesignSeries(1,{gameId:game.id,seriesId:sid,expectedRevision:prep.revision,previewHash:preview.hash,confirmed:true});
 const after=await api.readExport(1,game.id,sid,1,7,2);assert.deepEqual(after.cards,originalCards);assert.equal(after.snapshot.version,4);assert.deepEqual((await api.readExport(1,game.id,sid,1,7,1)).snapshot,original.snapshot);
 for(const row of (await db.query('SELECT to_jsonb(v) data FROM pubquiz.bingo_print_versions v WHERE series_id=$1',[sid])).rows)assert.doesNotThrow(()=>inspectRow(row.data,new Set(),'pubquiz','bingo_print_versions'));
 // Direct selection does not bypass DRAFT/ARCHIVED or wrong-purpose checks.
 const cfg=JSON.stringify({...original.snapshot.design.config,purpose:'BINGO_PRINT'});
 await db.query("INSERT INTO pubquiz.presentation_templates(presentation_template_id,name,status,ist_systemtemplate,contract_version,theme_config_json,tags,created_by_user_id,updated_at) VALUES('v4-blocked','Blocked','DRAFT',false,1,$1,'{}',1,now())",[cfg]);
 data=await api.print.readPrintDesign(1,target);await assert.rejects(api.print.savePrintDesign(1,{target,expectedStateHash:data.stateHash,config:{...selection,templateId:'v4-blocked'}}),/nicht mehr aktiv/);
 await db.query("UPDATE pubquiz.presentation_templates SET status='ARCHIVED' WHERE presentation_template_id='v4-blocked'");await assert.rejects(api.print.savePrintDesign(1,{target,expectedStateHash:data.stateHash,config:{...selection,templateId:'v4-blocked'}}));
 const stableCards=(await db.query('SELECT to_jsonb(c) data FROM pubquiz.bingo_cards c WHERE series_id=$1 ORDER BY id',[sid])).rows;
 await db.query("UPDATE pubquiz.eventreihe_eventarten SET ist_freigeschaltet=false WHERE eventreihe_id=10 AND eventart='BINGO'");await assert.rejects(api.print.readPrintDesign(1,target));await assert.rejects(api.print.savePrintDesign(1,{target,expectedStateHash:data.stateHash,config:selection}));await db.query("UPDATE pubquiz.eventreihe_eventarten SET ist_freigeschaltet=true WHERE eventreihe_id=10 AND eventart='BINGO'");
 assert.deepEqual((await db.query('SELECT to_jsonb(c) data FROM pubquiz.bingo_cards c WHERE series_id=$1 ORDER BY id',[sid])).rows,stableCards);
 // SRA3 is an explicit generation choice, independent of an inherited 89-mm profile.
 const inheritedBefore=(await db.query('SELECT bingo_print_config FROM pubquiz.eventreihen WHERE eventreihe_id=10')).rows[0].bingo_print_config;
 await db.query('UPDATE pubquiz.eventreihen SET bingo_print_config=$1 WHERE eventreihe_id=10',[JSON.stringify(selection)]);
 const sraGame=await api.creation.createBingoEvent(1,{seriesId:10,title:'SRA3 13-card acceptance',date:'',time:'',roundCount:1,requestId:randomUUID()});
 const sraTarget={kind:'BINGO',id:sraGame.id};
 let sraPrep=await api.readPreparation(1,sraGame.id);
 assert.deepEqual(JSON.parse(JSON.stringify(sraPrep.printLayout)),{format:'A4_SIX'});
 const sraLayout=changePrintFormat(sraPrep.printLayout!,'SRA3_TWELVE');
 const sraCommand={gameId:sraGame.id,expectedSeriesId:10,revision:sraPrep.revision,operation:'generate',roundId:sraPrep.rounds[0].id,count:13,requestId:randomUUID(),printLayout:sraLayout};
 const sraCreated=await api.writePreparation(1,sraCommand);
 assert.equal((await api.writePreparation(1,sraCommand)).seriesId,sraCreated.seriesId);
 await assert.rejects(api.writePreparation(1,{...sraCommand,printLayout:{format:'SRA3_TWELVE',cardProfile:'A4_FOUR'}}),/anderen Angaben/);
 const sraReload=await api.readExport(1,sraGame.id,sraCreated.seriesId!,1,13);
 assert.ok(sraReload.snapshot.version===4);
 if(sraReload.snapshot.version!==4)throw Error('SRA3 snapshot');
 assert.deepEqual(sraReload.snapshot.settings.layout,{version:4,format:'SRA3_TWELVE',cardProfile:'A4_SIX',textFont:'PHIL_GUD'});
 if(process.env.BINGO_SRA3_OUTPUT){mkdirSync(process.env.BINGO_SRA3_OUTPUT,{recursive:true});writeFileSync(join(process.env.BINGO_SRA3_OUTPUT,'generated.json'),JSON.stringify(sraReload));writeFileSync(join(process.env.BINGO_SRA3_OUTPUT,'generation.json'),JSON.stringify({gameId:sraGame.id,seriesId:sraCreated.seriesId,shortCodes:sraReload.cards.map(c=>c.shortCode),layout:sraReload.snapshot.settings.layout}));}
 // Additional print version of the same cards, preserving the original frozen version.
 const sraDesign=await api.print.readPrintDesign(1,sraTarget);
 await api.print.savePrintDesign(1,{target:sraTarget,expectedStateHash:sraDesign.stateHash,config:{...selection,format:'A6_ONE'}});
 const sraPreview=await api.print.previewPrintDesign(1,{target:sraTarget,seriesId:sraCreated.seriesId});
 sraPrep=await api.readPreparation(1,sraGame.id);
 await api.print.redesignSeries(1,{gameId:sraGame.id,seriesId:sraCreated.seriesId,expectedRevision:sraPrep.revision,previewHash:sraPreview.hash,confirmed:true});
 assert.deepEqual((await api.readExport(1,sraGame.id,sraCreated.seriesId!,1,13,2)).cards,sraReload.cards);
 assert.deepEqual((await api.readExport(1,sraGame.id,sraCreated.seriesId!,1,13,1)).snapshot,sraReload.snapshot);
 // Existing baseline series can likewise receive SRA3 as a new, explicitly confirmed version.
 data=await api.print.readPrintDesign(1,target);
 await api.print.savePrintDesign(1,{target,expectedStateHash:data.stateHash,config:{...selection,...sraLayout}});
 const newPreview=await api.print.previewPrintDesign(1,{target,seriesId:sid});prep=await api.readPreparation(1,game.id);
 await api.print.redesignSeries(1,{gameId:game.id,seriesId:sid,expectedRevision:prep.revision,previewHash:newPreview.hash,confirmed:true});
 const added=await api.readExport(1,game.id,sid,1,7,3);
 assert.deepEqual(added.cards,originalCards);assert.equal(added.snapshot.version===4&&added.snapshot.settings.layout?.cardProfile,'A4_SIX');
 assert.deepEqual((await api.readExport(1,game.id,sid,1,7,1)).snapshot,original.snapshot);
 await db.query('UPDATE pubquiz.eventreihen SET bingo_print_config=$1 WHERE eventreihe_id=10',[inheritedBefore]);
 // New LOVD defaults are resolved through real series inheritance without promoting V3 typography.
 const lovdSeriesBefore=(await db.query('SELECT shared_design_template_id,bingo_print_config FROM pubquiz.eventreihen WHERE eventreihe_id=10')).rows[0];
 await db.query("UPDATE pubquiz.eventreihen SET shared_design_template_id='lovd-ungegoogelt',bingo_print_config=NULL WHERE eventreihe_id=10");
 const lovdGame=await api.creation.createBingoEvent(1,{seriesId:10,title:'LOVD inherited partner correction',date:'',time:'',roundCount:1,requestId:randomUUID()});
 const lovdPrep=await api.readPreparation(1,lovdGame.id);
 const lovdGenerated=await api.writePreparation(1,{gameId:lovdGame.id,expectedSeriesId:10,revision:lovdPrep.revision,operation:'generate',roundId:lovdPrep.rounds[0].id,count:13,requestId:randomUUID(),printLayout:{format:'SRA3_TWELVE',cardProfile:'A4_FOUR'}});
 const lovdExport=await api.readExport(1,lovdGame.id,lovdGenerated.seriesId!,1,13);
 assert.equal(lovdExport.snapshot.version,3);if(lovdExport.snapshot.version!==3)throw Error('V3 retained');assert.equal(lovdExport.snapshot.settings.partnerBack,1);assert.equal(lovdExport.snapshot.settings.colors.header,'#74291D');assert.ok(lovdExport.snapshot.codeFont);
 for(const row of (await db.query('SELECT to_jsonb(s) data FROM pubquiz.bingo_card_series s WHERE id=$1',[lovdGenerated.seriesId])).rows)assert.doesNotThrow(()=>inspectRow(row.data,new Set(),'pubquiz','bingo_card_series'));
 await db.query('UPDATE pubquiz.eventreihen SET shared_design_template_id=$1,bingo_print_config=$2 WHERE eventreihe_id=10',[lovdSeriesBefore.shared_design_template_id,lovdSeriesBefore.bingo_print_config]);
 console.info('LOVD real inherited V3 generation, corrected RGB, frozen regular code face and backup integrity PASS');
 console.info('SRA3 inherited profile, explicit generation, idempotence/reload, immutable historical and additional print versions: PASS');
 console.info('V4 populated additive migration, strict template selection, role/product gates, immutable redesign, historical export and frozen integrity: PASS');
}

/** Complete schema-only local/CI copy; never accepts a hosted source or an existing target. */
export async function verifyEmptyPrintMigration(source:URL,matching=false){
 assert.ok(['127.0.0.1','localhost'].includes(source.hostname));assert.match(source.pathname,/^\/bingo_ap2_qa_\d+$/);
 const name=`bingo_print_empty_${Date.now()}`,controlUrl=new URL(source);controlUrl.pathname='/editorial_import_ci';
 const control=new PgClient({connectionString:controlUrl.toString()});await control.connect();let created=false;
 const container=process.env.BINGO_PG_CONTAINER;if(container)assert.match(container,/^[a-f0-9]{12,64}$/);
 function tool(command:string,args:string[],database:string,input?:Buffer){const env={...process.env,PGHOST:source.hostname,PGPORT:source.port||'5432',PGUSER:decodeURIComponent(source.username),PGPASSWORD:decodeURIComponent(source.password),PGDATABASE:database,PGSSLMODE:'disable'};
  if(container)return execFileSync('docker',['exec','-i','-e','PGPASSWORD',container,command,'-h','127.0.0.1','-U',env.PGUSER,'-d',database,...args],{env,input,maxBuffer:100*1024*1024});
  const windows=`C:/Program Files/PostgreSQL/18/bin/${command}.exe`;return execFileSync(existsSync(windows)?windows:command,command==='pg_restore'?['-d',database,...args]:args,{env,input,maxBuffer:100*1024*1024});
 }
 try{
  await control.query(`CREATE DATABASE ${name}`);created=true;const target=new URL(source);target.pathname='/'+name;const db=new PgClient({connectionString:target.toString()});await db.connect();
  try{
   assert.equal((await db.query('SELECT current_database() db')).rows[0].db,name);await db.query('DROP SCHEMA public');
   const dump=tool('pg_dump',['--format=custom','--schema-only','--no-owner','--no-acl','--schema=public','--schema=pubquiz'],source.pathname.slice(1));
   tool('pg_restore',['--no-owner','--no-acl','--exit-on-error','--single-transaction'],name,dump);
   assert.equal((await db.query('SELECT count(*)::int n FROM pubquiz.bingo_cards')).rows[0].n,0);
   await db.query(readFileSync('prisma/migrations/20261106210000_bingo_print_templates_v4/migration.sql','utf8'));
   const constraints=(await db.query("SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conname='bingo_print_versions_snapshot_check'")).rows;
   assert.ok(constraints.some(r=>r.definition.includes("'4'")));
   assert.equal((await db.query('SELECT count(*)::int n FROM pubquiz.bingo_cards')).rows[0].n,0);
   if(matching){assert.equal((await db.query("SELECT to_regclass('pubquiz.bingo_matching_assets') t")).rows[0].t,null);await db.query(readFileSync('prisma/migrations/20261107150000_bingo_matching/migration.sql','utf8'));assert.equal((await db.query('SELECT count(*)::int n FROM pubquiz.bingo_matching_assets')).rows[0].n,0);assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname IN ('bingo_matching_assets_immutable','bingo_term_sets_immutable')")).rows[0].n,2);}
   console.info(matching?'Matching migration on a complete empty disposable schema-only database: PASS':'V4 migration on a complete empty disposable schema-only database: PASS');
  }finally{await db.end();}
 }finally{if(created){assert.match(name,/^bingo_print_empty_\d+$/);await control.query(`DROP DATABASE ${name} WITH (FORCE)`);}await control.end();}
}
