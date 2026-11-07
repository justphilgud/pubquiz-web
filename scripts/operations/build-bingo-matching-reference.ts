/** Offline exact trigger reference. No database or credentials. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const name='20261107150000_bingo_matching',sql=readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8').replaceAll('\r\n','\n');
if(/CREATE\s+(?:OR REPLACE\s+)?FUNCTION/i.test(sql))throw Error('NEW_ROUTINE_REQUIRES_SEPARATE_REVIEW');
const names=['bingo_matching_assets','bingo_term_sets'];
const triggers=names.map(table=>{if(!sql.includes(`CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON pubquiz.${table} FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();`))throw Error('EXACT_MATCHING_TRIGGER_REQUIRED');return {schema:'pubquiz',name:`${table}_immutable`,table,functionSchema:'pubquiz',functionName:'bingo_immutable_record',type:27,enabled:'O',deferrable:false,deferred:false,constraint:false,columns:'',arguments:'',condition:null};});
if((sql.match(/CREATE TRIGGER/g)??[]).length!==2)throw Error('EXACT_TWO_MATCHING_TRIGGERS_REQUIRED');
writeFileSync('scripts/operations/schema-reference/bingo-matching-routines.json',JSON.stringify({migrations:[{name,sha256:createHash('sha256').update(sql).digest('hex')}],tables:['bingo_matching_assets'],triggers},null,2)+'\n');
