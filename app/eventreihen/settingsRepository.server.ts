import "server-only";
import {prisma} from "@/app/lib/prisma";
import {getActorPermissions} from "@/app/roles/roleAssignments.server";
import {canManageEventSeries,isAdministrator} from "@/app/roles/roleAssignmentPolicy";
import {isEventType,type EventType} from "@/app/roles/eventTypes";
import {logRoleAudit} from "@/app/roles/roleAudit.server";
import {isSelectablePresentationTemplateId} from "@/app/rendering/templateRegistry";
import {syncLegacyQuizRoles} from "@/app/roles/eventTypeWrites.server";
import {buildEventSeriesPersistenceData,type NormalizedEventSeriesInput} from "./eventSeriesPolicy";
import {eventSeriesSettingsRevision} from "./settingsRevision";
import {assertBingoMayDeactivate} from "./productSafety.server";
export type SeriesSaveOptions={expectedRevision:string;enabledEventTypes?:EventType[];logoUrl?:string|null};
export async function persistSeriesSettings(userId:number,id:number,value:NormalizedEventSeriesInput,options:SeriesSaveOptions) {
 if(!options||typeof options.expectedRevision!=="string"||Object.keys(options).some(k=>!["expectedRevision","enabledEventTypes","logoUrl"].includes(k)))throw Error("Bitte die Reiheneinstellungen neu laden.");
 if(options.enabledEventTypes!==undefined&&(!Array.isArray(options.enabledEventTypes)||options.enabledEventTypes.length>3||!options.enabledEventTypes.every(isEventType)))throw Error("Ungültige Eventartauswahl.");
 const changed:EventType[]=[];
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(860012,${id})::text`;
  await tx.$queryRaw`SELECT eventreihe_id FROM pubquiz.eventreihen WHERE eventreihe_id=${id} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM pubquiz.users WHERE id=${userId} FOR SHARE`;
  await tx.$queryRaw`SELECT benutzer_id FROM pubquiz.eventreihe_verwaltung WHERE benutzer_id=${userId} FOR SHARE`;
  await tx.$queryRaw`SELECT rollenzuweisung_id FROM pubquiz.benutzer_rollenzuweisungen WHERE benutzer_id=${userId} FOR SHARE`;
  const actor=await getActorPermissions(userId,tx),old=await tx.eventreihen.findUnique({where:{eventreihe_id:id},include:{eventarten:true}});
  if(!old||old.ist_archiviert||!canManageEventSeries(actor,id))throw Error("Eventreihe nicht gefunden oder nicht bearbeitbar.");
  if(!isAdministrator(actor)&&value.defaultPresentationTemplateId!==old.default_presentation_template_id&&!isSelectablePresentationTemplateId(value.defaultPresentationTemplateId))throw Error("Keine Berechtigung für diese Präsentationsvorlage.");
  if(options.enabledEventTypes!==undefined&&!isAdministrator(actor))throw Error("Produktfreischaltungen dürfen nur Administratoren ändern.");
  if(eventSeriesSettingsRevision(old.updated_at,old.eventarten,old.logo_url)!==options.expectedRevision)throw Error("Die Eventreihe wurde inzwischen geändert. Bitte neu laden; deine Eingaben bleiben erhalten.");
  if(await tx.eventreihen.findFirst({where:{name:{equals:value.name,mode:"insensitive"},NOT:{eventreihe_id:id}},select:{eventreihe_id:true}}))throw Error("Eine Eventreihe mit diesem Namen existiert bereits.");
  if(options.enabledEventTypes){
   const enabled=new Set(options.enabledEventTypes);
   if(old.eventarten.some(p=>p.eventart==="BINGO"&&p.ist_freigeschaltet)&&!enabled.has("BINGO"))await assertBingoMayDeactivate(tx,id);
   if(old.eventarten.some(p=>p.eventart==="QUIZ"&&p.ist_freigeschaltet)&&!enabled.has("QUIZ")){
    await tx.$queryRaw`SELECT quiz_id FROM pubquiz.quiz WHERE eventreihe_id=${id} ORDER BY quiz_id FOR UPDATE`;
    if(await tx.quiz_praesentation_status.count({where:{quiz:{eventreihe_id:id},quiz_started_at:{not:null},quiz_stopped_at:null}}))throw Error("Quiz kann während eines laufenden Quiz nicht deaktiviert werden.");
   }
   for(const eventart of ["QUIZ","BINGO","POWERPOINT_KARAOKE"] as const){if((old.eventarten.find(p=>p.eventart===eventart)?.ist_freigeschaltet??false)!==enabled.has(eventart))changed.push(eventart);await tx.eventreihe_eventarten.upsert({where:{eventreihe_id_eventart:{eventreihe_id:id,eventart}},create:{eventreihe_id:id,eventart,ist_freigeschaltet:enabled.has(eventart)},update:{ist_freigeschaltet:enabled.has(eventart)}});}
   if(changed.includes("QUIZ"))for(const role of await tx.benutzer_reihenrollen.findMany({where:{eventreihe_id:id},select:{benutzer_id:true}}))await syncLegacyQuizRoles(tx,role.benutzer_id,userId);
  }
  const saved=await tx.eventreihen.update({where:{eventreihe_id:id},data:{...buildEventSeriesPersistenceData(value),...(options.logoUrl!==undefined?{logo_url:options.logoUrl}:{})},include:{eventarten:true}});
  return {...saved,settingsRevision:eventSeriesSettingsRevision(saved.updated_at,saved.eventarten,saved.logo_url)};
 },{isolationLevel:"ReadCommitted",timeout:30000}).then(saved=>{for(const eventType of changed)logRoleAudit("event_type_changed",{eventSeriesId:id,eventType,enabled:options.enabledEventTypes!.includes(eventType),assignedById:userId});return saved;});
}
