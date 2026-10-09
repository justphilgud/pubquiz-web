import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";
import { Client } from "pg";
import { runEditorialDatabaseImport, editorialIntegritySnapshot } from "./editorialImportDatabase";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { transitionStoredQuestionStatus } from "../../editor/questionStatusPersistence";
import { repairEditorialTestQuestions } from "../../../../scripts/editorial-test-question-repair";
import { parseEditorialPool, sha256, candidateDigest, type EditorialSource } from "./editorialImport";

const connectionString=process.env.EDITORIAL_IMPORT_TEST_DATABASE_URL;
test("real PostgreSQL: read-only dry-run, atomic manifest, repeat/concurrent imports, rollback and unchanged protected rows",{skip:!connectionString},async()=>{
  assert.equal(process.env.CI,"true");
  const url=new URL(connectionString!);assert.equal(url.hostname,"127.0.0.1");assert.equal(url.pathname,"/editorial_import_ci");
  url.searchParams.delete("schema");const client=new Client({connectionString:url.toString()});await client.connect();
  try{
    // Historical 0_init contains a BOM and overlaps later migrations. Do not repair
    // production migration history. Bootstrap ONLY this fresh CI database from the
    // current model minus our new column, then test the actual additive migration.
    const baselinePath=resolve(".editorial-ci-baseline.prisma");
    writeFileSync(baselinePath,readFileSync("prisma/schema.prisma","utf8").replace(/^\s*redaktionelle_schwierigkeit[^\n]*$/m,""),{flag:"wx"});
    try {
      const sql=execFileSync(process.execPath,[resolve("node_modules/prisma/build/index.js"),"migrate","diff","--from-empty","--to-schema",baselinePath,"--script"],{env:{...process.env,JITI_CACHE:"false"},encoding:"utf8"});
      const start=sql.indexOf("-- CreateSchema");assert.ok(start>=0,"Expected generated PostgreSQL schema SQL");
      // Existing prisma.config.ts logs its non-sensitive source label to stdout.
      await client.query("CREATE SCHEMA IF NOT EXISTS pubquiz; SET search_path TO pubquiz, public");
      await client.query(sql.slice(start));
    } finally {unlinkSync(baselinePath);}
    await client.query(readFileSync("prisma/migrations/20261008090000_editorial_question_difficulty/migration.sql","utf8"));
    await client.query(readFileSync("prisma/migrations/20260724120000_add_phase_one_question_templates/migration.sql","utf8"));
    const operator=(await client.query("INSERT INTO pubquiz.users(email,password_hash,updated_at) VALUES('editorial-ci@example.invalid','test-only',now()) RETURNING id")).rows[0].id;
    await client.query("INSERT INTO pubquiz.antworttyp(antworttyp) VALUES('Standard') ON CONFLICT DO NOTHING");
    const raw=readFileSync(new URL("../../../../editorial/paule-oktober-2026/anagrams.json",import.meta.url),"utf8");
    const estimatesRaw=readFileSync("editorial/paule-oktober-2026/estimates.json","utf8");
    const candidates=[...parseEditorialPool("anagrams.json",raw).slice(0,3),parseEditorialPool("estimates.json",estimatesRaw)[0]];
    for(const category of new Set(candidates.map(c=>c.categories[0]))) await client.query("INSERT INTO pubquiz.fragenkategorie(kategorie) VALUES($1) ON CONFLICT DO NOTHING",[category]);
    const existing=(await client.query("INSERT INTO pubquiz.fragen(frage,quelle) VALUES('Existing integrity fixture','untouched') RETURNING fragen_id")).rows[0].fragen_id;
    const source:EditorialSource={provider:"Editorial:integration",files:[{name:"anagrams.json",sha256:sha256(raw)},{name:"estimates.json",sha256:sha256(estimatesRaw)}],candidates};
    const options={connectionString:connectionString!,source,operatorUserId:operator};
    await client.query('CREATE TABLE IF NOT EXISTS pubquiz._prisma_migrations (migration_name text, checksum text, finished_at timestamptz, rolled_back_at timestamptz)');
    const { approvedProductionEditorialSource } = await import('./editorialProductionPolicy');
    const frozenProductionSource = approvedProductionEditorialSource();
    const beforeProduction = await editorialIntegritySnapshot(client);
    const productionPreflight = await runEditorialDatabaseImport({connectionString:connectionString!, source:frozenProductionSource, mode:'dry-run', productionPreflight:true});
    assert.equal(productionPreflight.decisions.length,79);
    assert.deepEqual(productionPreflight.before,productionPreflight.after);
    assert.deepEqual(await editorialIntegritySnapshot(client),beforeProduction);
    assert.equal(productionPreflight.mode,'dry-run');
    if (productionPreflight.mode === 'dry-run') assert.ok(productionPreflight.productionSchema);
    await assert.rejects(runEditorialDatabaseImport({connectionString:connectionString!,source:frozenProductionSource,mode:'import',productionPreflight:true,operatorUserId:operator}),/WRITE_NOT_AUTHORIZED/);
    const before=(await client.query("SELECT count(*)::int AS count FROM pubquiz.fragen")).rows[0].count;
    const preview=await runEditorialDatabaseImport({...options,operatorUserId:undefined,mode:"dry-run"});
    await assert.rejects(runEditorialDatabaseImport({...options,operatorUserId:undefined,mode:"import",expectedDryRunDigest:preview.digest}),/OPERATOR_REQUIRED/);
    assert.equal(preview.decisions.filter(d=>d.action==="IMPORTIEREN").length,4);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM pubquiz.fragen")).rows[0].count,before);
    const parallel=await Promise.allSettled([1,2].map(()=>runEditorialDatabaseImport({...options,mode:"import",expectedDryRunDigest:preview.digest})));
    assert.equal(parallel.filter(r=>r.status==="fulfilled").length,1);assert.equal(parallel.filter(r=>r.status==="rejected").length,1);
    const success=parallel.find(r=>r.status==="fulfilled");assert.ok(success?.status==="fulfilled");
    assert.equal(success.value.questionIds.length,4);assert.equal(success.value.manifest?.items.length,4);
    const estimateManifest=success.value.manifest?.items.find(i=>i.template==="schaetzfrage");
    assert.equal(estimateManifest?.unit,"Knochen");assert.equal(estimateManifest?.referenceValue,206);
    assert.equal(estimateManifest?.solution,"206 Knochen");assert.deepEqual(estimateManifest?.sources,candidates[3].sources);
    assert.deepEqual(estimateManifest?.sourceFiles,source.files);
    const inserted=await client.query("SELECT freigegeben,review_status,redaktionelle_schwierigkeit,template_config_json FROM pubquiz.fragen WHERE fragen_id=ANY($1::int[])",[success.value.questionIds]);
    assert.ok(inserted.rows.every(r=>!r.freigegeben&&r.review_status==="DRAFT"&&r.redaktionelle_schwierigkeit==="LEICHT"));
    assert.deepEqual(success.value.before,preview.before);assert.equal(success.value.after.fragen.count,before+4);
    const repeat=await runEditorialDatabaseImport({...options,mode:"dry-run"});assert.ok(repeat.decisions.every(d=>d.action==="ÜBERSPRINGEN"));
    const repeated=await runEditorialDatabaseImport({...options,mode:"import",expectedDryRunDigest:repeat.digest});assert.equal(repeated.questionIds.length,0);
    assert.deepEqual(repeated.manifest?.items.map(i=>i.questionId),success.value.questionIds);
    const remaining=parseEditorialPool("anagrams.json",raw).slice(3,5);const rollbackSource={...source,provider:"Editorial:rollback",candidates:remaining};
    const rollbackOptions={...options,source:rollbackSource};const rollbackPreview=await runEditorialDatabaseImport({...rollbackOptions,mode:"dry-run"});
    await client.query(`CREATE FUNCTION pubquiz.editorial_fail_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.frage=$q$${remaining[1].question}$q$ THEN RAISE EXCEPTION 'Injected rollback failure'; END IF; RETURN NEW; END $$`);
    await client.query("CREATE TRIGGER editorial_fail_test BEFORE INSERT ON pubquiz.fragen FOR EACH ROW EXECUTE FUNCTION pubquiz.editorial_fail_test()");
    await assert.rejects(runEditorialDatabaseImport({...rollbackOptions,mode:"import",expectedDryRunDigest:rollbackPreview.digest}));
    await client.query("DROP TRIGGER editorial_fail_test ON pubquiz.fragen");await client.query("DROP FUNCTION pubquiz.editorial_fail_test()");
    assert.equal((await client.query("SELECT count(*)::int AS count FROM pubquiz.external_question_import_batches WHERE provider='Editorial:rollback'")).rows[0].count,0);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM pubquiz.fragen")).rows[0].count,before+4);
    assert.equal((await client.query("SELECT quelle FROM pubquiz.fragen WHERE fragen_id=$1",[existing])).rows[0].quelle,"untouched");
    // Trigger mutates an existing row: postflight must detect and roll back both writes.
    await client.query(`CREATE FUNCTION pubquiz.editorial_integrity_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE pubquiz.fragen SET quelle='unexpected' WHERE fragen_id=${existing}; RETURN NEW; END $$`);
    await client.query("CREATE TRIGGER editorial_integrity_test AFTER INSERT ON pubquiz.fragen FOR EACH ROW EXECUTE FUNCTION pubquiz.editorial_integrity_test()");
    const integrityPreview=await runEditorialDatabaseImport({...rollbackOptions,mode:"dry-run"});
    await assert.rejects(runEditorialDatabaseImport({...rollbackOptions,mode:"import",expectedDryRunDigest:integrityPreview.digest}),/INTEGRITY_CHANGED/);
    assert.equal((await client.query("SELECT quelle FROM pubquiz.fragen WHERE fragen_id=$1",[existing])).rows[0].quelle,"untouched");
    await client.query("DROP TRIGGER editorial_integrity_test ON pubquiz.fragen");await client.query("DROP FUNCTION pubquiz.editorial_integrity_test()");
    // Even a trigger changing only a NEW row must not bypass metadata/approval checks.
    await client.query("CREATE FUNCTION pubquiz.editorial_new_row_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.freigegeben=true; RETURN NEW; END $$");
    await client.query("CREATE TRIGGER editorial_new_row_test BEFORE INSERT ON pubquiz.fragen FOR EACH ROW EXECUTE FUNCTION pubquiz.editorial_new_row_test()");
    const newRowPreview=await runEditorialDatabaseImport({...rollbackOptions,mode:"dry-run"});
    await assert.rejects(runEditorialDatabaseImport({...rollbackOptions,mode:"import",expectedDryRunDigest:newRowPreview.digest}),/PERSISTED_CONTENT_MISMATCH/);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM pubquiz.fragen")).rows[0].count,before+4);
    await client.query("DROP TRIGGER editorial_new_row_test ON pubquiz.fragen");await client.query("DROP FUNCTION pubquiz.editorial_new_row_test()");

    // Real status transitions with existing quiz assignments, submissions and manual scores.
    const questionIds = [success.value.questionIds[0], success.value.questionIds[3]];
    const series = (await client.query("INSERT INTO pubquiz.eventreihen(name,slug,updated_at) VALUES('Status CI','status-ci',now()) RETURNING eventreihe_id")).rows[0].eventreihe_id;
    const quiz = (await client.query("INSERT INTO pubquiz.quiz(eventreihe_id,titel) VALUES($1,'Status CI') RETURNING quiz_id", [series])).rows[0].quiz_id;
    const block = (await client.query("INSERT INTO pubquiz.quiz_abschnitte(quiz_id,titel,abschnitt_typ,sortierung) VALUES($1,'Block','FRAGEN',1) RETURNING quiz_abschnitt_id", [quiz])).rows[0].quiz_abschnitt_id;
    const team = (await client.query("INSERT INTO pubquiz.teams(teamname,teamname_normalisiert,updated_at) VALUES('Status CI','status ci',now()) RETURNING team_id")).rows[0].team_id;
    const session = (await client.query("INSERT INTO pubquiz.quiz_team_sessions(quiz_id,team_id,teamname) VALUES($1,$2,'Status CI') RETURNING quiz_team_session_id", [quiz,team])).rows[0].quiz_team_session_id;
    for (const id of questionIds) {
      const assignment = (await client.query("INSERT INTO pubquiz.quiz_fragen(quiz_id,fragen_id,quiz_abschnitt_id) VALUES($1,$2,$3) RETURNING quiz_fragen_id", [quiz,id,block])).rows[0].quiz_fragen_id;
      const run = (await client.query("INSERT INTO pubquiz.quiz_interaction_runs(quiz_id,quiz_fragen_id,interaction_type,config_snapshot,updated_at) VALUES($1,$2,'FREE_TEXT','{}',now()) RETURNING interaction_run_id", [quiz,assignment])).rows[0].interaction_run_id;
      const answer = (await client.query("INSERT INTO pubquiz.team_antworten(quiz_id,quiz_abschnitt_id,quiz_fragen_id,quiz_team_session_id,antwort_text,manuelle_punkte,vergebene_punkte,ist_manuell_richtig,interaction_run_id) VALUES($1,$2,$3,$4,'Preserve answer',1,1,true,$5) RETURNING team_antwort_id", [quiz,block,assignment,session,run])).rows[0].team_antwort_id;
      await client.query("INSERT INTO pubquiz.team_answer_submissions(interaction_run_id,team_antwort_id,quiz_team_session_id,status,interaction_type,payload,draft_revision) VALUES($1,$2,$3,'AUTO_FINALIZED','FREE_TEXT','{\"text\":\"Preserve answer\"}',1)", [run,answer,session]);
      await client.query("INSERT INTO pubquiz.antworten(fragen_id,antwort,ist_richtig,antworttyp_id) SELECT $1,'Preserved variant',true,antworttyp_id FROM pubquiz.antworttyp WHERE antworttyp='Standard'",[id]);
    }
    const statusDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
    const actor = { userId: operator, assignments: [{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }] };
    const protectedBefore = await editorialIntegritySnapshot(client, questionIds);
    const content = async (id: number) => (await client.query(`SELECT to_jsonb(f) - ARRAY['review_status','freigegeben','approved_by_user_id','approved_at','reviewed_by_user_id','reviewed_at','review_feedback','last_modified_by_user_id','updated_at'] AS content FROM pubquiz.fragen f WHERE fragen_id=$1`,[id])).rows[0].content;
    try {
      for (const id of questionIds) {
        const original = await content(id);
        for (const target of ["APPROVED", "DRAFT"] as const) {
          const updatedAt = (await client.query("SELECT updated_at FROM pubquiz.fragen WHERE fragen_id=$1",[id])).rows[0].updated_at.toISOString();
          await statusDb.$transaction(tx => transitionStoredQuestionStatus(tx, actor, {questionId:id,target,expectedUpdatedAt:updatedAt}, async draft => {
            assert.ok(draft.questionText); assert.ok(draft.sourceOrRemark); assert.equal(draft.answers.length,2);
          }));
          assert.deepEqual(await content(id),original);
          assert.deepEqual(await editorialIntegritySnapshot(client,questionIds),protectedBefore);
        }
        await assert.rejects(statusDb.$transaction(tx => transitionStoredQuestionStatus(tx,actor,{questionId:id,target:"APPROVED",expectedUpdatedAt:"2000-01-01T00:00:00.000Z"},async()=>{})),/STALE_QUESTION/);
        const updatedAt = (await client.query("SELECT updated_at FROM pubquiz.fragen WHERE fragen_id=$1",[id])).rows[0].updated_at.toISOString();
        await assert.rejects(statusDb.$transaction(tx => transitionStoredQuestionStatus(tx,actor,{questionId:id,target:"APPROVED",expectedUpdatedAt:updatedAt},async()=>{throw new Error("INVALID_CONTENT");})),/INVALID_CONTENT/);
        assert.deepEqual(await content(id),original);
      }
      // Seed the exact 79-row recovery fixture only in this disposable CI database.
      const recoveryCandidates = [...parseEditorialPool("anagrams.json",raw), ...parseEditorialPool("estimates.json",estimatesRaw)]
        .filter(c=>!c.metadata.editorialHoldReason&&!c.metadata.editorialExcludeReason);
      assert.equal(recoveryCandidates.length,79); assert.equal(recoveryCandidates[53].externalId,"EST-09");
      const legacyBefore = await editorialIntegritySnapshot(client);
      const batch = (await client.query("INSERT INTO pubquiz.external_question_import_batches(provider,requested_count,status,created_by_user_id,report_json) VALUES('Editorial:PR93',79,'COMPLETED',$1,$2::jsonb) RETURNING import_batch_id",[operator,JSON.stringify({before:legacyBefore})])).rows[0].import_batch_id;
      await client.query("INSERT INTO pubquiz.benutzer_rollenzuweisungen(benutzer_id,rolle,scope_typ,updated_at) VALUES($1,'ADMIN','GLOBAL',now())",[operator]);
      for (const [index,c] of recoveryCandidates.entries()) {
        const id = 154+index;
        const template = (await client.query("SELECT vorlage_id FROM pubquiz.frage_vorlagen WHERE code=$1",[c.templateId])).rows[0].vorlage_id;
        await client.query("INSERT INTO pubquiz.fragen(fragen_id,frage,quelle,vorlage_id,template_config_json,redaktionelle_schwierigkeit,created_by_user_id,last_modified_by_user_id) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$7)",[id,c.question,c.sources.join("\n"),template,JSON.stringify(c.templateConfig),c.difficulty,operator]);
        await client.query("INSERT INTO pubquiz.antworten(fragen_id,antwort,ist_richtig,antworttyp_id) SELECT $1,$2,true,antworttyp_id FROM pubquiz.antworttyp WHERE antworttyp='Standard'",[id,c.solution]);
        for (const category of c.categories) {
          await client.query("INSERT INTO pubquiz.fragenkategorie(kategorie) VALUES($1) ON CONFLICT DO NOTHING",[category]);
          await client.query("INSERT INTO pubquiz.fragen_kategorien(fragen_id,fragenkategorie_id) SELECT $1,fragenkategorie_id FROM pubquiz.fragenkategorie WHERE kategorie=$2",[id,category]);
        }
        await client.query(`INSERT INTO pubquiz.external_question_import_items(import_batch_id,provider,external_reference,license,license_url,original_language,original_category,original_difficulty,original_type,original_question,original_correct_answer,original_incorrect_answers,provider_payload_json,content_fingerprint,question_id)
          VALUES($1,'Editorial:PR93',$2,'CI only','','de',$3,$4,$5,$6,$7,'[]',$8::jsonb,$9,$10)`,[batch,c.externalId,c.categories.join(" / "),c.difficulty,c.templateId,c.question,c.solution,JSON.stringify({candidate:c}),candidateDigest(c),id]);
      }
      for (const id of [154,207]) {
        const c = recoveryCandidates[id-154];
        const config = structuredClone(c.templateConfig) as {templateData:Record<string,unknown>};
        if(id===154){config.templateData.selectedSolution="OLD WEST ACTION";config.templateData.suggestions=["OLD WEST ACTION"];}
        await client.query("UPDATE pubquiz.fragen SET freigegeben=true,review_status='APPROVED',approved_by_user_id=$1,template_config_json=$2::jsonb WHERE fragen_id=$3",[operator,JSON.stringify({...config,stageDurationsSeconds:{stage1:15,stage2:15,stage3:15},createPixelQuestionByAnswer:{answer1:false,answer2:false}}),id]);
        const assignment=(await client.query("INSERT INTO pubquiz.quiz_fragen(quiz_id,fragen_id,quiz_abschnitt_id) VALUES($1,$2,$3) RETURNING quiz_fragen_id",[quiz,id,block])).rows[0].quiz_fragen_id;
        await client.query("INSERT INTO pubquiz.team_antworten(quiz_id,quiz_abschnitt_id,quiz_fragen_id,quiz_team_session_id,antwort_text,manuelle_punkte,vergebene_punkte,ist_manuell_richtig) VALUES($1,$2,$3,$4,'Recovery answer',1,1,true)",[quiz,block,assignment,session]);
      }
      const recovery=await repairEditorialTestQuestions(statusDb);
      assert.equal(recovery.protectedTablesUnchanged,true); assert.equal(recovery.otherQuestionsUnchanged,true);
      assert.equal(recovery.after.comparisons.length,79);
      assert.ok(recovery.after.comparisons.every(row=>!row.differences.length&&!row.approved&&row.reviewStatus==="DRAFT"));
      const repeated=await repairEditorialTestQuestions(statusDb);
      assert.ok(repeated.changes.every(row=>!row.configRestored&&!row.statusChanged));
      // A trigger touching existing evaluations must abort the complete recovery.
      await client.query("UPDATE pubquiz.fragen SET freigegeben=true,review_status='APPROVED' WHERE fragen_id IN (154,207)");
      const guardedBefore=await editorialIntegritySnapshot(client);
      await client.query(`CREATE FUNCTION pubquiz.recovery_integrity_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE pubquiz.team_antworten SET vergebene_punkte=99 WHERE quiz_id=${quiz}; RETURN NEW; END $$`);
      await client.query("CREATE TRIGGER recovery_integrity_test AFTER UPDATE ON pubquiz.fragen FOR EACH ROW EXECUTE FUNCTION pubquiz.recovery_integrity_test()");
      await assert.rejects(repairEditorialTestQuestions(statusDb),/PROTECTED_TABLE_CHANGED/);
      assert.deepEqual(await editorialIntegritySnapshot(client),guardedBefore);
      await client.query("DROP TRIGGER recovery_integrity_test ON pubquiz.fragen"); await client.query("DROP FUNCTION pubquiz.recovery_integrity_test()");
    } finally { await statusDb.$disconnect(); }
  } finally {await client.end();}
});
