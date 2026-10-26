import { resolveAnswerFormTemplate } from "../templateResolver";
import { toRuntimeAnswerFormTemplate } from "../presentationTemplates/presentationTemplate";
import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { getActorPermissions } from "@/app/roles/roleAssignments.server";
import { canManageEventSeries, canViewEventSeries, hasEventTypeAccess } from "@/app/roles/roleAssignmentPolicy";
import { isGameId } from "@/app/games/gameDraft";
import { getPresentationTemplate, getAnswerFormTemplate, templateRegistry, type PresentationTemplate } from "../templateRegistry";
import { listManagedPresentationTemplates, loadStoredPresentationTemplateConfigs } from "../presentationTemplates/presentationTemplateRepository.server";
import { parsePresentationTemplateConfig, type PresentationTemplateConfig } from "../presentationTemplates/presentationTemplate";
import { isSafeTemplateAssetReference } from "../presentationTemplates/presentationTemplateAssets";
import { parseDesignSelection, supportsSharedDesign, parseQuizDesignSnapshot, type SharedDesign } from "./sharedDesign";
export type DesignTarget = { kind: "SERIES" | "QUIZ" | "BINGO" | "POWERPOINT_KARAOKE"; id: string };
export class DesignError extends Error {}
function deny(): never { throw new DesignError("Design nicht gefunden oder kein Zugriff."); }
export function validateTarget(value: unknown): DesignTarget {
  if(!value || typeof value!=="object" || Array.isArray(value)) return deny();
  const t=value as Record<string,unknown>;
  if(Object.keys(t).sort().join(',')!=='id,kind' || !['SERIES','QUIZ','BINGO','POWERPOINT_KARAOKE'].includes(String(t.kind)) || typeof t.id!=='string')return deny();
  if(t.kind==='SERIES'||t.kind==='QUIZ'){if(!/^[1-9]\d*$/.test(t.id)||!Number.isSafeInteger(Number(t.id)))return deny();} else if(!isGameId(t.id))return deny();
  return t as DesignTarget;
}
async function templateConfig(tx: Prisma.TransactionClient,id:string) {
  const system:PresentationTemplate|undefined=getPresentationTemplate(id);
  if(system?.selectable)return {id,name:system.displayName ?? (id==='phil-gud'?'Phil Gud':id==='lovd-ungegoogelt'?'LOVD × Phil Gud':id),config:{version:1 as const,tokens:system.tokens,design:structuredClone(system.design),surfaces:{presentation:system.variant,moderation:system.moderationVariant??'BRANDED' as const,answerForm:getAnswerFormTemplate(id)?.variant??'BRANDED' as const}}};
  await tx.$queryRaw`SELECT presentation_template_id FROM pubquiz.presentation_templates WHERE presentation_template_id=${id} FOR SHARE`;
  const row=await tx.presentation_templates.findUnique({where:{presentation_template_id:id},select:{name:true,status:true,theme_config_json:true}});
  if(!row || row.status!=='ACTIVE')throw new DesignError('Die Designvorlage ist nicht verfügbar. Bitte eine unterstützte aktive Vorlage wählen.');
  const config=parsePresentationTemplateConfig(row.theme_config_json);
  if(!config)throw new DesignError('Die Designkonfiguration ist ungültig.');
  return {id,name:row.name,config};
}
export async function resolveSharedDesign(tx:Prisma.TransactionClient,selection:string|null,series:{shared_design_template_id:string|null;logo_url:string|null}) {
  const id=selection && selection!=='INHERIT'?selection:series.shared_design_template_id??'phil-gud';
  const template=await templateConfig(tx,id);
  if(!supportsSharedDesign(template.config))throw new DesignError('Diese Vorlage unterstützt die gemeinsamen Formatvorschauen nicht.');
  const config:PresentationTemplateConfig=structuredClone(template.config);
  if(series.logo_url){if(!isSafeTemplateAssetReference(series.logo_url))throw new DesignError('Das Reihenlogo ist ungültig.');config.tokens.assets.logo=series.logo_url;}
  const design:SharedDesign={version:1,templateId:id,name:template.name,config};
  return {design,source:selection && selection!=='INHERIT'?'Spielauswahl':series.shared_design_template_id?'Reihenstandard':'Systemstandard'};
}
async function context(tx:Prisma.TransactionClient,userId:number,target:DesignTarget) {
  const actor=await getActorPermissions(userId,tx);
  const game=target.kind==='SERIES'?null:target.kind==='QUIZ'?await tx.quiz.findUnique({where:{quiz_id:Number(target.id)},include:{praesentation_status:true}}):await tx.game_drafts.findUnique({where:{id:target.id}});
  if(target.kind!=='SERIES'&&(!game||('eventart'in game&&game.eventart!==target.kind)))return deny();
  const seriesId=target.kind==='SERIES'?Number(target.id):game!.eventreihe_id;
  const series=await tx.eventreihen.findUnique({where:{eventreihe_id:seriesId},include:{eventarten:true}});
  if(!series)return deny();
  const enabled=target.kind==='SERIES'||series.eventarten.some(e=>e.eventart===target.kind&&e.ist_freigeschaltet);
  const read=target.kind==='SERIES'?canViewEventSeries(actor,seriesId):enabled&&hasEventTypeAccess(actor,seriesId,target.kind==='QUIZ'?'QUIZ':target.kind,target.kind==='QUIZ'?'EVENT_MANAGER':'EDITOR');
  if(!read)return deny();
  const archived=series.ist_archiviert||Boolean(game&&'ist_archiviert'in game&&game.ist_archiviert);
  const started=Boolean(game&&'praesentation_status'in game&&(game.praesentation_status?.quiz_started_at||game.praesentation_status?.quiz_stopped_at));
  const canWrite=!archived&&!started&&(target.kind==='SERIES'?canManageEventSeries(actor,seriesId):hasEventTypeAccess(actor,seriesId,target.kind==='QUIZ'?'QUIZ':target.kind,'EVENT_MANAGER'));
  return {series,game,canWrite,selection:game?game.shared_design_template_id:series.shared_design_template_id,seriesId};
}
export async function readDesign(userId:number,input:unknown) {
  const target=validateTarget(input);
  const data=await prisma.$transaction(async tx=>{
    const c=await context(tx,userId,target);
    const snapshot=c.game&&'shared_design_snapshot'in c.game?parseQuizDesignSnapshot(c.game.shared_design_snapshot)?.design:null;
    const resolved=snapshot&&!c.canWrite?{design:snapshot,source:'Eingefroren beim Quizstart'}:await resolveSharedDesign(tx,c.selection,c.series);
    let legacyConfig=null;
    if(target.kind==='QUIZ'&&c.selection===null&&c.game&&'presentation_template_id'in c.game){
      const ids=[c.game.presentation_template_id,c.series.default_presentation_template_id].filter((v):v is string=>!!v);
      const stored=await loadStoredPresentationTemplateConfigs(ids);
      const id=ids.find(id=>getPresentationTemplate(id)||stored.has(id))??'ungegoogelt-default';
      const system:PresentationTemplate|undefined=getPresentationTemplate(id);
      legacyConfig=system?{version:1 as const,tokens:system.tokens,design:system.design,surfaces:{presentation:system.variant,moderation:system.moderationVariant??'BRANDED' as const,answerForm:'BRANDED' as const}}:stored.get(id)!;
    }
    return {answerSelection:c.game&&'answer_form_template_id'in c.game?c.game.answer_form_template_id:null,selection:c.selection,seriesId:c.seriesId,canWrite:c.canWrite,seriesName:c.series.name,...resolved,source:target.kind==='SERIES'?(c.selection?'Reihenstandard':'Systemstandard'):resolved.source,...(snapshot&&!c.canWrite?{design:snapshot,source:'Eingefroren beim Quizstart'}:{}),legacyConfig};
  },{isolationLevel:'RepeatableRead'});
  const managed=(await listManagedPresentationTemplates()).templates;
  const templates=managed.filter(t=>(t.status==='SYSTEM'||t.status==='ACTIVE')&&supportsSharedDesign(t.config)).map(t=>({id:t.id,name:t.name}));
  return {...data,templates,answerTemplates:[...templateRegistry.answerForm.filter(t=>t.selectable).map(t=>({id:t.id,name:managed.find(m=>m.id===t.id)?.name??('displayName'in t?t.displayName:t.id)})),...managed.filter(t=>t.source==='USER'&&t.status==='ACTIVE').map(t=>({id:t.id,name:t.name}))]};
}
export async function writeDesign(userId:number,input:unknown) {
  if(!input||typeof input!=='object'||Array.isArray(input))return deny();
  const r=input as Record<string,unknown>;
  if(Object.keys(r).some(k=>!['target','selection','expectedSelection','expectedSeriesId','answerSelection','expectedAnswerSelection'].includes(k))||!['target','selection','expectedSelection','expectedSeriesId'].every(k=>Object.hasOwn(r,k)))return deny();
  const target=validateTarget(r.target),selection=parseDesignSelection(r.selection,target.kind==='QUIZ');
  const expected=parseDesignSelection(r.expectedSelection,target.kind==='QUIZ');
  const changesAnswer=Object.hasOwn(r,'answerSelection');if(changesAnswer&&target.kind!=='QUIZ')return deny();
  const answerSelection=changesAnswer?parseDesignSelection(r.answerSelection):undefined;
  return prisma.$transaction(async tx=>{
    if(target.kind==='QUIZ'){
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(860012,eventreihe_id)::text FROM pubquiz.quiz WHERE quiz_id=${Number(target.id)}`;
      await tx.$queryRaw`SELECT quiz_id FROM pubquiz.quiz WHERE quiz_id=${Number(target.id)} FOR UPDATE`;
    }else if(target.kind==='SERIES')await tx.$queryRaw`SELECT eventreihe_id FROM pubquiz.eventreihen WHERE eventreihe_id=${Number(target.id)} FOR UPDATE`;
    else {
      await tx.$queryRaw`SELECT id FROM pubquiz.game_drafts WHERE id=${target.id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(860012,eventreihe_id)::text FROM pubquiz.game_drafts WHERE id=${target.id}::uuid`;
      await tx.$queryRaw`SELECT eventreihe_id FROM pubquiz.eventreihen WHERE eventreihe_id=(SELECT eventreihe_id FROM pubquiz.game_drafts WHERE id=${target.id}::uuid) FOR SHARE`;
    }
    await tx.$queryRaw`SELECT id FROM pubquiz.users WHERE id=${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT benutzer_id FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id=${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT rollenzuweisung_id FROM pubquiz.benutzer_rollenzuweisungen WHERE benutzer_id=${userId} FOR SHARE`;
    const c=await context(tx,userId,target);
    if(!c.canWrite)return deny();
    if(c.seriesId!==r.expectedSeriesId||c.selection!==expected)throw new DesignError('Die Auswahl oder Eventreihe wurde inzwischen geändert. Bitte neu laden.');
    if(changesAnswer && c.game && 'answer_form_template_id'in c.game){
      if(c.game.answer_form_template_id!==r.expectedAnswerSelection)throw new DesignError('Die Antwortformularauswahl wurde inzwischen geändert. Bitte neu laden.');
      if(selection===null && answerSelection!==c.game.answer_form_template_id)throw new DesignError('Getrennte Auswahl benötigt ein ausdrücklich aktiviertes gemeinsames Design.');
      if(answerSelection && !getAnswerFormTemplate(answerSelection)?.selectable)await templateConfig(tx,answerSelection);
    }
    if(selection!==null)await resolveSharedDesign(tx,selection,c.series);
    if(target.kind==='SERIES')await tx.eventreihen.update({where:{eventreihe_id:Number(target.id)},data:{shared_design_template_id:selection}});
    else if(target.kind==='QUIZ')await tx.quiz.update({where:{quiz_id:Number(target.id)},data:{shared_design_template_id:selection,...(changesAnswer?{answer_form_template_id:answerSelection}:{})}});
    else await tx.game_drafts.update({where:{id:target.id},data:{shared_design_template_id:selection}});
    return {success:true as const};
  },{timeout:15000});
}
export async function freezeQuizDesign(tx:Prisma.TransactionClient,quizId:number){
  const quiz=await tx.quiz.findUnique({where:{quiz_id:quizId},include:{eventreihe:true}});
  if(!quiz?.shared_design_template_id)return;
  const {design}=await resolveSharedDesign(tx,quiz.shared_design_template_id,quiz.eventreihe);
  const ids=[quiz.answer_form_template_id,quiz.eventreihe.default_answer_form_template_id].filter((v):v is string=>!!v);
  const stored=await tx.presentation_templates.findMany({where:{presentation_template_id:{in:ids}},select:{presentation_template_id:true,name:true,theme_config_json:true}});
  const additionalAnswerFormTemplates=stored.flatMap(t=>{const config=parsePresentationTemplateConfig(t.theme_config_json);return config?[toRuntimeAnswerFormTemplate({id:t.presentation_template_id,name:t.name,config})]:[];});
  const answer=resolveAnswerFormTemplate({quizTemplateId:quiz.answer_form_template_id,eventSeriesTemplateId:quiz.eventreihe.default_answer_form_template_id,additionalAnswerFormTemplates}).template;
  const snapshot={version:1,design,answerForm:{id:answer.id,name:answer.displayName??answer.id,config:{version:1,tokens:answer.tokens,design:answer.design,surfaces:{presentation:'DARK',moderation:'BRANDED',answerForm:answer.variant}}}};
  await tx.quiz.update({where:{quiz_id:quizId},data:{shared_design_snapshot:JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue}});
}
