import { parseTermSet } from '../preparation/termSet';
import {assertUuid,type FrozenRound} from "./live";
export function parseRoundSnapshot(value:unknown,id?:string):FrozenRound {
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("INVALID_FROZEN_ROUND");
 const r=value as FrozenRound;
 if(Object.keys(r).sort().join()!==('id,issued,label,seriesIds,target'+(r.terms?',terms':'')+(r.matching?',matching':'')).split(',').sort().join()||r.terms&&r.matching||id!==undefined&&r.id!==id||typeof r.label!=="string"||!r.label.trim()||r.label.length>80||!Number.isInteger(r.target)||r.target<1||r.target>75||(r.issued!==null&&(!Number.isSafeInteger(r.issued)||r.issued<0))||!Array.isArray(r.seriesIds)||!r.seriesIds.length||new Set(r.seriesIds).size!==r.seriesIds.length)throw Error("INVALID_FROZEN_ROUND");
 if(r.matching){assertUuid(r.matching.id);if(Object.keys(r.matching).sort().join()!=='hash,id,publication'||!/^[a-f0-9]{64}$/.test(r.matching.hash)||!['DIRECT','APPROVAL','HIDDEN'].includes(r.matching.publication))throw Error('INVALID_FROZEN_MATCHING');}
 assertUuid(r.id);r.seriesIds.forEach(assertUuid);return r.terms?{...r,terms:parseTermSet(r.terms)}:r;
}
