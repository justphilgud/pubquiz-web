import {parsePrintSnapshot,type PrintSnapshot} from './printSnapshot';
import {denied} from './policy';
import {assertUuid} from '../live/live';
export type CardSetManifest={version:1;title:string;sections:{roundId:string;label:string;wildcard:boolean;cardIds:string[];snapshot:PrintSnapshot}[]};
export function parseManifest(value:unknown):CardSetManifest{
 if(!value||typeof value!=='object'||Array.isArray(value))throw denied();
 const m=value as CardSetManifest;
 if(Object.keys(m).sort().join()!=='sections,title,version'||m.version!==1||typeof m.title!=='string'||!Array.isArray(m.sections)||!m.sections.length||m.sections.length>11)throw denied();
 const ids=new Set<string>();let sawWildcard=false;
 for(const s of m.sections){
  if(Object.keys(s).sort().join()!=='cardIds,label,roundId,snapshot,wildcard'||typeof s.label!=='string'||!s.label||s.label.length>100||typeof s.wildcard!=='boolean'||sawWildcard)throw denied();
  assertUuid(s.roundId);sawWildcard=s.wildcard;
  if(!Array.isArray(s.cardIds)||!s.cardIds.length||s.cardIds.length>1000)throw denied();
  for(const id of s.cardIds){assertUuid(id);if(ids.has(id))throw denied();ids.add(id);}
  s.snapshot=parsePrintSnapshot(s.snapshot);
  if((s.snapshot.version!==3&&s.snapshot.version!==4)||s.snapshot.settings.layout?.format!=='SRA3_TWELVE'||s.snapshot.settings.layout.cardProfile!=='A4_FOUR')throw denied();
 }
 return m;
}
