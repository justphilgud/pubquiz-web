import type {Prisma} from '@/app/generated/prisma/client';
import {getActorEventSeriesIds,hasAnyEditorialAssignment,isAdministrator,type AuthorizationActor} from '@/app/roles/roleAssignmentPolicy';
import {mediaSlotDefinitions} from '@/app/fragen/editor/mediaSlots';
import type {QuestionMediaType} from '@/app/fragen/editor/types';
import {GENERAL_TEMPLATE} from './templateOptions';

/** SQL counterpart of canViewScopedQuestion for approved sources only. Final object checks remain. */
export function matchingReadableWhere(actor:AuthorizationActor):Prisma.fragenWhereInput {
 if(isAdministrator(actor))return {};
 return {OR:[...(hasAnyEditorialAssignment(actor)?[{geltungsbereich:'GLOBAL' as const}]:[]),
  {geltungsbereich:'EVENT_SERIES',eventreihen:{some:{eventreihe_id:{in:getActorEventSeriesIds(actor)}}}}]};
}
export function matchingEligibleWhere(actor:AuthorizationActor,seriesId:number,now:Date):Prisma.fragenWhereInput {
 return {freigegeben:true,ist_archiviert:false,
  OR:[{geltungsbereich:'GLOBAL'},{geltungsbereich:'EVENT_SERIES',eventreihen:{some:{eventreihe_id:seriesId}}}],
  AND:[matchingReadableWhere(actor),{OR:[{gueltig_bis:null},{gueltig_bis:{gte:now}}]}]};
}
function mediaTypeWhere(kind:QuestionMediaType):Prisma.medientypWhereInput {
 const contains=(text:string)=>({medientyp:{contains:text,mode:'insensitive' as const}});
 const image={OR:[contains('bild'),contains('image')]};
 // Match the existing name classifier's IMAGE > AUDIO > VIDEO priority.
 if(kind==='IMAGE')return image;
 if(kind==='AUDIO')return {AND:[{NOT:image},contains('audio')]};
 return {AND:[{NOT:image},{NOT:contains('audio')},contains('video')]};
}
export function matchingMediaWhere(kind:QuestionMediaType):Prisma.fragenWhereInput {
 const file:Prisma.medienWhereInput={datei:{not:''},medientyp:mediaTypeWhere(kind)};
 const slots=Object.values(mediaSlotDefinitions).filter(s=>s.scope==='QUESTION'&&s.mediaType===kind).map(s=>s.key);
 return {OR:[{medien:{some:{...file,OR:[{slot_key:null},{slot_key:''},{slot_key:{in:slots}}]}}},
  ...(kind==='IMAGE'?[
   {antwortfelder:{some:{medien:{some:{...file,slot_key:'answer_image'}}}}},
   {antworten:{some:{ist_richtig:true,medien:{some:{...file,slot_key:'answer_image'}}}}},
  ]:[])]};
}
export function matchingTemplateWhere(code:string):Prisma.fragenWhereInput {
 return code===GENERAL_TEMPLATE?{source_vorlage_id:null,vorlage_id:null}:
  {OR:[{source_vorlage:{code}},{source_vorlage_id:null,vorlage:{code}}]};
}
export const matchingSourceMetadataSelect={fragen_id:true,geltungsbereich:true,created_by_user_id:true,review_status:true,
 ist_archiviert:true,freigegeben:true,eventreihen:{select:{eventreihe_id:true}},
 vorlage:{select:{code:true,name:true}},source_vorlage:{select:{code:true,name:true}}} satisfies Prisma.fragenSelect;
