import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { readMigrationSession } from "./production-preflight";
test("actual PostgreSQL SELECT-role preflight never mutates data; missing permission blocks", {skip:!process.env.PREFLIGHT_TEST_DATABASE_URL},async()=>{
  const connectionString=process.env.PREFLIGHT_TEST_DATABASE_URL!;
  const identity=new URL(connectionString);
  assert.equal(process.env.CI,"true");assert.equal(identity.hostname,"127.0.0.1");assert.equal(identity.pathname,"/preflight_ci");
  const admin=new Client({connectionString});await admin.connect();
  const reader=new Client({connectionString,options:"-c role=preflight_reader"});
  try {
    // Fixture creation is confined to disposable CI; the Production module has no DDL.
    await admin.query("CREATE SCHEMA pubquiz; CREATE TABLE public._prisma_migrations(migration_name text,checksum text,finished_at timestamptz,rolled_back_at timestamptz,started_at timestamptz,applied_steps_count int); CREATE TABLE pubquiz.protected_fixture(value int); INSERT INTO pubquiz.protected_fixture VALUES(1)");
    await admin.query("INSERT INTO public._prisma_migrations VALUES('a','1',now(),null,now(),1)");
    await admin.query("CREATE ROLE preflight_reader NOLOGIN; GRANT USAGE ON SCHEMA pubquiz TO preflight_reader; GRANT SELECT ON public._prisma_migrations, pubquiz.protected_fixture TO preflight_reader");
    await reader.connect();
    const before=(await admin.query("SELECT md5(string_agg(to_jsonb(t)::text,',')) AS digest FROM public._prisma_migrations t")).rows;
    const candidate=[{name:"a",checksum:"1"},{name:"b",checksum:"2"}];
    const result=await readMigrationSession(reader,candidate,candidate.slice(0,1),"preflight_reader","preflight_ci");
    assert.equal(result.gate.status,"PASS");assert.ok('pending' in result);assert.deepEqual(result.pending,["b"]);
    const {prismaChecksumEvidence}=await import('./production-preflight-diagnostics');
    const {createHash}=await import('node:crypto');const script='SELECT 1;\n',stored=createHash('sha256').update(script.replaceAll('\n','\r\n')).digest('hex');
    await admin.query("INSERT INTO public._prisma_migrations VALUES('0_init',$1,now(),null,now(),1)",[stored]);
    const variants=prismaChecksumEvidence(Buffer.from(script),stored);assert.equal(variants.prismaCompatible,true);
    const evidence={baseline:{sha:'a'.repeat(40),bytes:Buffer.from(script)},candidate:{sha:'b'.repeat(40),bytes:Buffer.from(script)},inventory:{tables:[{schema:'pubquiz',table:'protected_fixture',columns:['value']}],enums:[]}};
    const diagnostic=await readMigrationSession(reader,[...candidate,{name:'0_init',checksum:variants.sha256.repository}],candidate.slice(0,1),'preflight_reader','preflight_ci',evidence);
    assert.equal(diagnostic.gate.code,'MIGRATION_DRIFT');assert.ok('additionalDiagnostics' in diagnostic);
    assert.equal(diagnostic.additionalDiagnostics?.checksumComparison.diagnosis,'LINE_ENDINGS_ONLY');
    assert.equal(diagnostic.additionalDiagnostics?.schemaComparison.status,'INCOMPLETE');
    await admin.query("DELETE FROM public._prisma_migrations WHERE migration_name='0_init'");
    assert.deepEqual((await admin.query("SELECT md5(string_agg(to_jsonb(t)::text,',')) AS digest FROM public._prisma_migrations t")).rows,before);
    await reader.query("BEGIN READ ONLY");await assert.rejects(reader.query("UPDATE pubquiz.protected_fixture SET value=2"));await reader.query("ROLLBACK");
    assert.equal((await admin.query("SELECT value FROM pubquiz.protected_fixture")).rows[0].value,1);
    // Even a privileged session cannot write inside this explicit read-only transaction.
    await admin.query("BEGIN READ ONLY");await assert.rejects(admin.query("UPDATE pubquiz.protected_fixture SET value=3"),error=>(error as {code:string}).code==="25006");await admin.query("ROLLBACK");
    for (const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE']) {
      await admin.query(`GRANT ${privilege} ON public._prisma_migrations TO preflight_reader`);
      assert.equal((await readMigrationSession(reader,candidate,candidate.slice(0,1),'preflight_reader','preflight_ci')).gate.code,'DATABASE_READER_PRIVILEGES_REJECTED');
      await admin.query(`REVOKE ${privilege} ON public._prisma_migrations FROM preflight_reader`);
    }
    await admin.query('CREATE ROLE preflight_parent NOLOGIN; GRANT preflight_parent TO preflight_reader');
    assert.equal((await readMigrationSession(reader,candidate,candidate.slice(0,1),'preflight_reader','preflight_ci')).gate.code,'DATABASE_READER_PRIVILEGES_REJECTED');
    await admin.query('REVOKE preflight_parent FROM preflight_reader');
    assert.equal((await readMigrationSession(admin,candidate,candidate.slice(0,1),'preflight_ci','preflight_ci')).gate.code,'DATABASE_READER_PRIVILEGES_REJECTED');
    await admin.query("CREATE TABLE pubquiz._prisma_migrations (LIKE public._prisma_migrations)");
    assert.equal((await readMigrationSession(reader,candidate,candidate.slice(0,1),'preflight_reader','preflight_ci')).gate.code,'MIGRATION_SCHEMA_BINDING_UNVERIFIED');
    await admin.query("DROP TABLE pubquiz._prisma_migrations");
    await admin.query("ALTER TABLE public._prisma_migrations SET SCHEMA pubquiz");
    assert.equal((await readMigrationSession(reader,candidate,candidate.slice(0,1),'preflight_reader','preflight_ci')).gate.code,'MIGRATION_SCHEMA_BINDING_UNVERIFIED');
    await admin.query("ALTER TABLE pubquiz._prisma_migrations SET SCHEMA public");
    await admin.query("REVOKE SELECT ON public._prisma_migrations FROM preflight_reader");
    assert.equal((await readMigrationSession(reader,candidate,candidate.slice(0,1),"preflight_reader","preflight_ci")).gate.code,"DATABASE_SELECT_PERMISSION_MISSING");

  } finally {await reader.end();await admin.end();}
});
