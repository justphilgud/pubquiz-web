import "server-only";
import {prisma} from "@/app/lib/prisma";
import {getActorPermissions} from "@/app/roles/roleAssignments.server";
import {hasEventTypeAccess} from "@/app/roles/roleAssignmentPolicy";
import type {EventType} from "@/app/roles/eventTypes";
import {readBingoStatuses} from "./statusReader.server";
import type {EventEntry} from "./EventRow";
export async function readEventCollection(userId:number,seriesId?:number) {
 if(seriesId!==undefined&&(!Number.isSafeInteger(seriesId)||seriesId<1))throw Error("INVALID_SERIES");
 return prisma.$transaction(async tx=>{
  const actor=await getActorPermissions(userId,tx);
  const rows=await tx.eventreihen.findMany({where:seriesId===undefined?{}:{eventreihe_id:seriesId},include:{eventarten:true},orderBy:{name:"asc"}});
  const allowed=(type:EventType,write=false)=>rows.filter(r=>r.eventarten.some(p=>p.eventart===type&&p.ist_freigeschaltet)&&hasEventTypeAccess(actor,r.eventreihe_id,type,type==="QUIZ"||write?"EVENT_MANAGER":"EDITOR"));
  const choices=(["QUIZ","BINGO","POWERPOINT_KARAOKE"] as const).flatMap(type=>allowed(type,true).filter(r=>!r.ist_archiviert).map(r=>({seriesId:r.eventreihe_id,seriesName:r.name,type,label:type==="QUIZ"?"Quiz":type==="BINGO"?"Bingo":"PowerPoint-Karaoke",href:type==="QUIZ"?`/quiz?eventreiheId=${r.eventreihe_id}`:`/${type==="BINGO"?"bingo":"karaoke"}/new?series=${r.eventreihe_id}`})));
  const quizzes=await tx.quiz.findMany({where:{eventreihe_id:{in:allowed("QUIZ").map(r=>r.eventreihe_id)}},include:{eventreihe:true,praesentation_status:{select:{quiz_started_at:true,quiz_stopped_at:true}}}});
  const games=await tx.game_drafts.findMany({where:{OR:(["BINGO","POWERPOINT_KARAOKE"] as const).map(type=>({eventart:type,eventreihe_id:{in:allowed(type).map(r=>r.eventreihe_id)}}))},include:{eventreihe:true}});
  const statuses=await readBingoStatuses(games.filter(g=>g.eventart==="BINGO").map(g=>g.id),tx);
  const entries:EventEntry[]=quizzes.map(q=>({id:`quiz:${q.quiz_id}`,title:q.titel?.trim()||`Quiz ${q.quiz_id}`,seriesName:q.eventreihe.name,typeLabel:"Quiz",date:q.quiz_datum?.toISOString().slice(0,10)??null,time:q.veranstaltungszeit,status:q.praesentation_status?.quiz_stopped_at?"Beendet":q.praesentation_status?.quiz_started_at?"Läuft":"Vorbereitung",prepareHref:`/quiz/${q.quiz_id}`,moderationHref:`/quiz/${q.quiz_id}/moderation`,presentationHref:`/quiz/${q.quiz_id}/praesentation`}));
  for(const g of games){const bingo=g.eventart==="BINGO",path=bingo?"bingo":"karaoke",manager=hasEventTypeAccess(actor,g.eventreihe_id,g.eventart as EventType,"EVENT_MANAGER");entries.push({id:g.id,title:g.titel,seriesName:g.eventreihe.name,typeLabel:bingo?"Bingo":"PowerPoint-Karaoke",date:g.datum?.toISOString().slice(0,10)??null,time:g.uhrzeit,status:bingo?statuses[g.id]??"Vorbereitung":"Nicht spielbar",prepareHref:`/${path}/${g.id}`,...(bingo&&manager?{moderationHref:`/bingo/${g.id}/moderation`,presentationHref:`/bingo/${g.id}/praesentation`}:{})});}
  const returnTo=seriesId===undefined?"/events":`/admin/eventreihen/${seriesId}`;
  for(const entry of entries)entry.prepareHref+=`?returnTo=${encodeURIComponent(returnTo)}`;
  entries.sort((a,b)=>(a.date??"9999").localeCompare(b.date??"9999")||a.title.localeCompare(b.title));
  return {entries,choices};
 },{isolationLevel:"RepeatableRead"});
}
