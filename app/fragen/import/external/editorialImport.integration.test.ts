import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";
import { Client } from "pg";
import { runEditorialDatabaseImport } from "./editorialImportDatabase";
import { parseEditorialPool, sha256, type EditorialSource } from "./editorialImport";

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
  } finally {await client.end();}
});
