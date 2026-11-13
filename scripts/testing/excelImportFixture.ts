import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { hashSync } from "bcryptjs";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import * as XLSX from "xlsx";
import { headers, type Sheet } from "@/app/fragen/import/excel/format";

export const testDatabase = process.env.EXCEL_IMPORT_TEST_DATABASE_URL;
export const fixtureEmail = "excel-editor@example.test";
export const fixturePassword = "Excel-Fixture-123!";
export const fixtureSecret = "isolated-excel-import-test-secret";
export const seriesTarget = { scope: "EVENT_SERIES" as const, eventSeriesIds: [10] };

export function fixtureWorkbook(sheets: Partial<Record<Sheet, string[][]>>) {
  const book = XLSX.utils.book_new();
  for (const name of Object.keys(headers) as Sheet[]) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[...headers[name]], ...(sheets[name] ?? [])]), name);
  }
  return XLSX.write(book, { type: "buffer", compression: true }) as Buffer;
}

export async function openExcelFixture() {
  assert.ok(testDatabase, "EXCEL_IMPORT_TEST_DATABASE_URL required");
  const url = new URL(testDatabase);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "Use an isolated local PostgreSQL fixture");
  const name = `excel_import_${process.pid}_${Date.now()}`;
  const control = new Client({ connectionString: url.toString() });
  await control.connect();
  await control.query(`CREATE DATABASE ${name}`);
  url.pathname = `/${name}`;
  const sql = new Client({ connectionString: url.toString() });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  async function close() {
    await db.$disconnect();
    await sql.end();
    await control.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await control.end();
  }
  try {
    await sql.connect();
    const schema = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff",
      "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"], {
      encoding: "utf8", env: { ...process.env, DATABASE_URL: url.toString() }, maxBuffer: 10_000_000,
    });
    await sql.query(`SET search_path TO pubquiz, public;\n${schema.slice(schema.indexOf("-- CreateSchema"))}`);
    await sql.query("DROP TABLE pubquiz.excel_question_import_receipts");
    for (const name of ["20261110120000_add_person_and_pairs_question_templates", "20261113140000_add_excel_question_import_receipts"]) {
      await sql.query(readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));
    }
    await sql.query(`
      INSERT INTO pubquiz.antworttyp(antworttyp) VALUES ('Standard');
      INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug,ist_archiviert) VALUES
        (10,'Excel Testreihe','excel-test',false),(20,'Fremde Testreihe','excel-fremd',false),(30,'Archivierte Testreihe','excel-archiv',true);
      INSERT INTO pubquiz.eventarten(kennung,name) VALUES ('QUIZ','Quiz');
      INSERT INTO pubquiz.eventreihe_eventarten(eventreihe_id,eventart,ist_freigeschaltet) VALUES
        (10,'QUIZ',true),(20,'QUIZ',true),(30,'QUIZ',true);
      INSERT INTO pubquiz.fragenkategorie(fragenkategorie_id,kategorie,status) VALUES
        (10,'Alltagsphysik','ACTIVE'),(20,'Archivkategorie','ARCHIVED'),(30,'Offene Kategorie','PENDING');
    `);
    await sql.query(`
      INSERT INTO pubquiz.users(id,email,name,password_hash,role,updated_at) VALUES
        (1,$1,'Excel Editor',$2,'EDITOR',now()),
        (2,'excel-admin@example.test','Excel Admin',$2,'ADMIN',now()),
        (3,'excel-global@example.test','Excel Global',$2,'EDITOR',now());
      `, [fixtureEmail, hashSync(fixturePassword, 4)]);
    await sql.query(`
      INSERT INTO pubquiz.benutzer_reihenrollen(benutzer_id,eventreihe_id,rolle) VALUES (1,10,'EDITOR'),(1,30,'EDITOR');
      INSERT INTO pubquiz.benutzer_rollenzuweisungen(benutzer_id,rolle,scope_typ) VALUES (2,'ADMIN','GLOBAL'),(3,'EDITOR','GLOBAL');
    `);
    return { db, sql, url: url.toString(), close };
  } catch (error) {
    await close();
    throw error;
  }
}
