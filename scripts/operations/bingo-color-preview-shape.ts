import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export const ROUND_SHAPE_SQL="SELECT jsonb_build_object('columns',(SELECT jsonb_agg(jsonb_build_object('name',column_name,'type',data_type,'udt',udt_name,'nullable',is_nullable,'length',character_maximum_length,'default',column_default) ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='pubquiz' AND table_name='bingo_rounds'),'constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) ORDER BY conname) FROM pg_constraint WHERE conrelid='pubquiz.bingo_rounds'::regclass),'indexes',(SELECT jsonb_agg(jsonb_build_object('name',indexname,'definition',indexdef) ORDER BY indexname) FROM pg_indexes WHERE schemaname='pubquiz' AND tablename='bingo_rounds')) AS shape";
export function verifySyntheticRoundShape(value:unknown){
 const shape=value as {columns:Record<string,unknown>[];constraints:Record<string,unknown>[];indexes:unknown[]};
 assert.ok(shape&&Array.isArray(shape.columns)&&Array.isArray(shape.constraints));
 const color=shape.columns.filter(c=>c.name==='presentation_color'),check=shape.constraints.filter(c=>c.name==='bingo_round_color_hex');
 assert.ok(color.length===0&&check.length===0||color.length===1&&check.length===1);
 if(color.length){assert.deepEqual(color[0],{udt:'varchar',name:'presentation_color',type:'character varying',length:7,default:null,nullable:'YES'});assert.equal(check[0].definition,"CHECK (((presentation_color IS NULL) OR ((presentation_color)::text ~ '^#[0-9A-Fa-f]{6}$'::text)))");}
 const baseline=JSON.parse(readFileSync('scripts/operations/bingo-color-preview-baseline.json','utf8'));
 assert.deepEqual({...shape,columns:shape.columns.filter(c=>c.name!=='presentation_color'),constraints:shape.constraints.filter(c=>c.name!=='bingo_round_color_hex')},baseline);
 return color.length===0;
}
