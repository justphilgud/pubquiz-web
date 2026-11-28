import {isGameId} from '@/app/games/gameDraft';
import {BingoPreparationError} from './policy';

export const CARD_SET_LIMIT=1000;
export const WILDCARD_COLOR='#38264F';
export type CardSetConfig={version:1;defaultCount:number;rounds:{id:string;selected:boolean;count:number|null}[];wildcards:number};
export function cardQuantity(value:unknown,zero=false):number{
 if(!Number.isSafeInteger(value)||Number(value)<(zero?0:1)||Number(value)>CARD_SET_LIMIT)throw new BingoPreparationError(`Bitte ${zero?'0':'1'} bis ${CARD_SET_LIMIT} Karten angeben.`);
 return Number(value);
}
export function parseCardSetConfig(value:unknown):CardSetConfig{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new BingoPreparationError('Ungültiger Kartensatz.');
 const r=value as Record<string,unknown>;
 if(Object.keys(r).sort().join()!=='defaultCount,rounds,version,wildcards'||r.version!==1||!Array.isArray(r.rounds)||r.rounds.length>10)throw new BingoPreparationError('Ungültige Rundenauswahl.');
 const ids=new Set<string>();
 const rounds=r.rounds.map((entry):CardSetConfig['rounds'][number]=>{
  if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new BingoPreparationError('Ungültige Runde.');
  const e=entry as Record<string,unknown>;
  if(Object.keys(e).sort().join()!=='count,id,selected'||!isGameId(e.id)||ids.has(e.id)||typeof e.selected!=='boolean')throw new BingoPreparationError('Runden bitte genau einmal auswählen.');
  ids.add(e.id);return {id:e.id,selected:e.selected,count:e.count===null?null:cardQuantity(e.count)};
 });
 return {version:1,defaultCount:cardQuantity(r.defaultCount),rounds,wildcards:cardQuantity(r.wildcards,true)};
}
/** Selection is a print plan only; stock is never deleted to fit a lower target. */
export function cardSetSummary(config:CardSetConfig){
 const sections=config.rounds.filter(r=>r.selected).map(r=>({id:r.id,count:r.count??config.defaultCount}));
 return {sections,cards:sections.reduce((sum,s)=>sum+s.count,config.wildcards),pages:sections.reduce((sum,s)=>sum+2*Math.ceil(s.count/12),config.wildcards?2*Math.ceil(config.wildcards/12):0)};
}
