import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { COLUMN_SQL, CATALOG_SQL } from "./snapshot";

const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export function prismaChecksumEvidence(bytes:Buffer,stored:string) {
  const script=bytes.toString('utf8');
  const variants={repository:digest(bytes),lf:digest(script.replaceAll('\r\n','\n')),crlf:digest(script.replaceAll('\n','\r\n'))};
  // Match Prisma Engine e922089... checksum.rs, including legacy unpadded hex.
  // Preserve BOM, whitespace, final newline and all SQL. Do not modify the gate.
  const legacy=(hex:string)=>hex.match(/../g)!.map(byte=>parseInt(byte,16).toString(16)).join('');
  const matches=Object.entries(variants).filter(([,hex])=>(stored.length===64?hex:legacy(hex))===stored).map(([name])=>name);
  return {storedChecksum:stored,sha256:variants,prismaCompatible:matches.length>0,matches,
    diagnosis:matches.includes('repository')?'EXACT_BYTES':matches.length?'LINE_ENDINGS_ONLY':'OTHER_CHECKSUM',
    acceptedByPreflight:false};
}
export function initRepositoryEvidence(sha:string) {
  if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('DIAGNOSTIC_SHA_INVALID');
  const bytes=execFileSync('git',['show',`${sha}:prisma/migrations/0_init/migration.sql`]);
  return {sha,bytes};
}
type Inventory={tables:{schema:string;table:string;columns:string[]}[];enums:{schema:string;name:string;labels:string[]}[]};
// Deliberately only an inventory comparison, never a complete schema-equivalence claim.
export function prismaInventory(source:string):Inventory {
  const enums=[...source.matchAll(/enum\s+(\w+)\s*\{([^}]+)\}/g)].map(([,name,body])=>({schema:body.match(/@@schema\("(\w+)"\)/)?.[1]??'pubquiz',name:body.match(/@@map\("(\w+)"\)/)?.[1]??name,
    labels:body.split('\n').map(line=>line.trim()).filter(line=>/^[A-Za-z_]\w*(?:\s|$)/.test(line)&&!line.startsWith('//')).map(line=>line.match(/@map\("([^"\n]+)"\)/)?.[1]??line.match(/^\w+/)![0])}));
  const scalar=new Set(['Int','BigInt','Float','Decimal','String','Boolean','DateTime','Json','Bytes',...enums.map(e=>e.name)]);
  const tables=[...source.matchAll(/model\s+(\w+)\s*\{([^}]+)\}/g)].map(([,name,body])=>({schema:body.match(/@@schema\("(\w+)"\)/)?.[1]??'pubquiz',table:body.match(/@@map\("(\w+)"\)/)?.[1]??name,
    columns:body.split('\n').flatMap(line=>{const field=line.trim().match(/^(\w+)\s+(\w+)(?:\?|\[\])?(?:\s|$)/);return field&&scalar.has(field[2])&&!/@ignore/.test(line)?[line.match(/@map\("(\w+)"\)/)?.[1]??field[1]]:[];})}));
  if(!tables.length)throw new Error('SCHEMA_INVENTORY_UNAVAILABLE');return {tables,enums};
}
export function inventoryFromGit(sha:string) {
  if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('DIAGNOSTIC_SHA_INVALID');
  return prismaInventory(execFileSync('git',['show',`${sha}:prisma/schema.prisma`],{encoding:'utf8'}));
}
export const DIAGNOSTIC_COLUMNS_SQL=`SELECT (${COLUMN_SQL}) AS columns`;
export const DIAGNOSTIC_CATALOG_SQL=`SELECT (${CATALOG_SQL}) AS catalog`;
export function compareSchemaInventory(expected:Inventory,columns:unknown,catalog:unknown) {
  if(!Array.isArray(columns)||!catalog||typeof catalog!=='object')return {status:'INCOMPLETE',reason:'CATALOG_UNAVAILABLE'};
  const rows=columns as {schema:string;table:string;column:string}[];
  const actual=new Set(rows.filter(row=>row.schema==='pubquiz').map(row=>`${row.schema}.${row.table}.${row.column}`));
  const wanted=new Set(expected.tables.flatMap(table=>table.columns.map(column=>`${table.schema}.${table.table}.${column}`)));
  const missing=[...wanted].filter(key=>!actual.has(key)),extra=[...actual].filter(key=>!wanted.has(key));
  const labels=(catalog as {enums?:{schema:string;name:string;label:string}[]}).enums;
  const expectedEnums=expected.enums.flatMap(e=>e.labels.map(label=>`${e.schema}.${e.name}.${label}`));
  const actualEnums=Array.isArray(labels)?labels.map(e=>`${e.schema}.${e.name}.${e.label}`):[];
  return {status:'INCOMPLETE',inventoryMatches:!missing.length&&!extra.length&&Array.isArray(labels)&&expectedEnums.length===actualEnums.length&&expectedEnums.every(key=>actualEnums.includes(key)),missing,extra,
    missingEnumLabels:expectedEnums.filter(key=>!actualEnums.includes(key)),extraEnumLabels:actualEnums.filter(key=>!expectedEnums.includes(key)),
    checked:'Prisma model table/column and enum label inventory',
    unverified:['complete SQL replay equivalence','column types/nullability/defaults','constraint and index equivalence','sequence and view equivalence']};
}
