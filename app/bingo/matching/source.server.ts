import 'server-only';
import type {Prisma} from '@/app/generated/prisma/client';
import {prisma} from '@/app/lib/prisma';
import {getActorPermissions} from '@/app/roles/roleAssignments.server';
import {canViewScopedQuestion,isQuestionEligibleForQuiz} from '@/app/fragen/editor/questionScopePolicy';
import {mapQuestionAccessContext} from '@/app/fragen/editor/questionAccess.server';
import {createQuestionMediaDraftFromStoredMedia,getQuestionMediaTypeFromName} from '@/app/fragen/editor/questionMedia';
import {preparationContext} from '../preparation/access.server';
import {canonical,sha256} from '../preparation/printSnapshot';
import {matchingAnswers,MatchingError} from '../preparation/matching';
import {isMediaSlotKey,getMediaSlotDefinition} from '@/app/fragen/editor/mediaSlots';
const sourceSelect={fragen_id:true,frage:true,updated_at:true,ist_archiviert:true,freigegeben:true,gueltig_bis:true,geltungsbereich:true,created_by_user_id:true,review_status:true,eventreihen:{select:{eventreihe_id:true}},vorlage:{select:{code:true,name:true}},source_vorlage:{select:{code:true,name:true}},antwortfelder:{orderBy:{sortierung:'asc' as const},select:{antwortfeld_id:true,label:true,medien:{select:{medien_id:true,datei:true,slot_key:true,medientyp:{select:{medientyp:true}}}},loesungen:{where:{ist_akzeptiert:true},orderBy:{sortierung:'asc' as const},select:{loesung_text:true}}}},antworten:{where:{ist_richtig:true},select:{antwort_id:true,antwort:true,medien:{select:{medien_id:true,datei:true,slot_key:true,medientyp:{select:{medientyp:true}}}}}},medien:{select:{medien_id:true,datei:true,slot_key:true,medientyp:{select:{medientyp:true}}}}} satisfies Prisma.fragenSelect;
type SourceRow=Prisma.fragenGetPayload<{select:typeof sourceSelect}>;
export function matchingMediaRows(q:SourceRow){return [...q.medien,...q.antwortfelder.flatMap(f=>f.medien),...q.antworten.flatMap(a=>a.medien)];}
export function projectMatchingSource(q:SourceRow){
 const revision=sha256(canonical({...q,updated_at:q.updated_at.toISOString(),gueltig_bis:q.gueltig_bis?.toISOString()??null}));
 const media=createQuestionMediaDraftFromStoredMedia(q.medien,q.vorlage?.code).filter(m=>!m.blockedReasonCode&&m.mediaType&&m.existingMediaId&&m.url).map(m=>({id:m.existingMediaId!,kind:m.mediaType!,variant:m.slotKey}));
 for(const m of q.medien){const kind=getQuestionMediaTypeFromName(m.medientyp.medientyp);if(!kind||!m.datei||media.some(v=>v.id===m.medien_id))continue;
  const slot=m.slot_key&&isMediaSlotKey(m.slot_key)?getMediaSlotDefinition(m.slot_key):null;
  if(m.slot_key&&(!slot||slot.scope!=='QUESTION'||slot.mediaType!==kind))continue;
  // An explicitly chosen actual legacy file is not an invented generated variant.
  media.push({id:m.medien_id,kind,variant:slot?.key??(kind==='AUDIO'?'question_audio':kind==='VIDEO'?'question_video':'question_image')});
 }
 for(const m of [...q.antwortfelder.flatMap(f=>f.medien),...q.antworten.flatMap(a=>a.medien)])if(m.datei&&m.slot_key==='answer_image'&&getQuestionMediaTypeFromName(m.medientyp.medientyp)==='IMAGE')media.push({id:m.medien_id,kind:'IMAGE',variant:'answer_image'});
 return {id:q.fragen_id,title:q.frage,template:q.source_vorlage?.name??q.vorlage?.name??'Allgemeine Frage',revision,media,answers:matchingAnswers(q.antwortfelder.map(f=>({id:f.antwortfeld_id,label:f.label,solutions:f.loesungen.map(s=>s.loesung_text)})),q.antworten.map(a=>({id:a.antwort_id,text:a.antwort}))),browserSpeechOnly:media.length===0};
}
export async function authorizedSource(tx:Prisma.TransactionClient,userId:number,seriesId:number,questionId:number){
 if(!Number.isSafeInteger(questionId)||questionId<1)throw new MatchingError('Quizquelle nicht gefunden oder nicht berechtigt.');
 const [q,actor]=await Promise.all([tx.fragen.findUnique({where:{fragen_id:questionId},select:sourceSelect}),getActorPermissions(userId,tx)]);
 if(!q||!canViewScopedQuestion(actor,mapQuestionAccessContext(q))||!isQuestionEligibleForQuiz({scope:q.geltungsbereich,eventSeriesIds:q.eventreihen.map(e=>e.eventreihe_id),quizEventSeriesId:seriesId,isApproved:q.freigegeben,isArchived:q.ist_archiviert,validUntil:q.gueltig_bis,now:new Date()}))throw new MatchingError('Quizquelle nicht gefunden, nicht freigegeben oder nicht für diese Eventreihe berechtigt.');
 return {row:q,view:projectMatchingSource(q)};
}
export async function searchMatchingSources(userId:number,gameId:string,input:{search:string;template:string;kind:string;page:number}){
 if(typeof input.search!=='string'||input.search.length>120||typeof input.template!=='string'||input.template.length>100||!['','AUDIO','IMAGE','VIDEO'].includes(input.kind)||!Number.isInteger(input.page)||input.page<1||input.page>10000)throw new MatchingError('Ungültige Quellensuche.');
 return prisma.$transaction(async tx=>{
  const {game}=await preparationContext(tx,userId,gameId),actor=await getActorPermissions(userId,tx);
  const rows=await tx.fragen.findMany({where:{freigegeben:true,ist_archiviert:false,
   OR:[{geltungsbereich:'GLOBAL'},{geltungsbereich:'EVENT_SERIES',eventreihen:{some:{eventreihe_id:game.eventreihe_id}}}],
   AND:[{OR:[{gueltig_bis:null},{gueltig_bis:{gte:new Date()}}]},...(input.template?[{OR:[{vorlage:{name:{contains:input.template,mode:'insensitive' as const}}},{source_vorlage:{name:{contains:input.template,mode:'insensitive' as const}}}]}]:[])],
   frage:{contains:input.search,mode:'insensitive'}},select:sourceSelect,orderBy:{fragen_id:'asc'},skip:(input.page-1)*20,take:21});
  const visible=rows.slice(0,20).filter(q=>canViewScopedQuestion(actor,mapQuestionAccessContext(q))).map(projectMatchingSource).filter(q=>!input.kind||q.media.some(m=>m.kind===input.kind));
  return {items:visible,more:rows.length>20,seriesId:game.eventreihe_id};
 },{isolationLevel:'RepeatableRead'});
}
export type MatchingSourceView=ReturnType<typeof projectMatchingSource>;
