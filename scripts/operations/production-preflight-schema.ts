import { canonicalCatalog } from "./catalog-comparison";
import { DIAGNOSTIC_COLUMNS_SQL, DIAGNOSTIC_CATALOG_SQL } from "./production-preflight-diagnostics";
export {DIAGNOSTIC_COLUMNS_SQL,DIAGNOSTIC_CATALOG_SQL};
export const SCHEMA_OBJECTS_SQL=`SELECT json_build_object(
 'relations',(SELECT coalesce(json_agg(x ORDER BY schema,name,kind),'[]') FROM
  (SELECT n.nspname AS schema,c.relname AS name,c.relkind AS kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','pubquiz') AND c.relkind IN ('r','p','v','m','S','f')) x),
 'triggers',(SELECT coalesce(json_agg(x ORDER BY schema,name),'[]') FROM
  (SELECT n.nspname AS schema,t.tgname AS name,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','pubquiz') AND NOT t.tgisinternal) x),
 'routines',(SELECT coalesce(json_agg(x ORDER BY schema,name,arguments),'[]') FROM
  (SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','pubquiz') AND p.prokind IN ('f','p') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')) x)) AS objects`;
export type SchemaEvidence={baselineSha:string;manifest:{name:string;checksum:string}[];major:number;columns:unknown;catalog:unknown;objects:unknown};
function normalize(value:unknown):unknown {
  if(!Array.isArray(value))return value;
  return value.filter(row=>!(row&&typeof row==='object'&&['table','tablename','name'].some(key=>(row as Record<string,unknown>)[key]==='_prisma_migrations')))
    .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
}
function fullCatalog(catalog:unknown) {
  if(!catalog||typeof catalog!=='object')return null;
  const data=canonicalCatalog(catalog) as Record<string,unknown>;
  const keys=['schemas','constraints','indexes','sequences','enums','views'];
  if(keys.some(key=>!Array.isArray(data[key])))return null;
  return Object.fromEntries(keys.map(key=>[key,normalize(data[key])]));
}
export function compareFullSchema(expected:SchemaEvidence|undefined,actual:{major:number;columns:unknown;catalog:unknown;objects:unknown},baselineSha:string,manifest:{name:string;checksum:string}[]) {
  if(!expected||expected.baselineSha!==baselineSha||expected.major!==actual.major||JSON.stringify(expected.manifest)!==JSON.stringify(manifest))return {status:'BLOCKED',code:'EXPECTED_SCHEMA_PROVENANCE_UNVERIFIED'};
  const left=fullCatalog(expected.catalog),right=fullCatalog(actual.catalog);
  const validObjects=(value:unknown)=>value&&typeof value==='object'&&['relations','triggers','routines'].every(key=>Array.isArray((value as Record<string,unknown>)[key]));
  if(!Array.isArray(expected.columns)||!Array.isArray(actual.columns)||!left||!right||!validObjects(expected.objects)||!validObjects(actual.objects))return {status:'BLOCKED',code:'SCHEMA_CATALOG_INCOMPLETE'};
  const sections:Record<string,[unknown,unknown]>={columns:[normalize(expected.columns),normalize(actual.columns)],...Object.fromEntries(Object.keys(left).map(key=>[key,[left[key],right[key]]]))};
  for(const key of ['relations','triggers','routines'])sections[key]=[normalize((expected.objects as Record<string,unknown>)[key]),normalize((actual.objects as Record<string,unknown>)[key])];
  const differences=Object.keys(sections).filter(key=>JSON.stringify(sections[key][0])!==JSON.stringify(sections[key][1]));
  return {status:differences.length?'FAIL':'PASS',code:differences.length?'SCHEMA_DRIFT':'SCHEMA_CONFIRMED',differences,
    scope:'applied immutable baseline migrations; excludes only Prisma history metadata'};
}
