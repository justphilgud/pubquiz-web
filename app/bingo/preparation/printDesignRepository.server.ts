import "server-only";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { sharedDesignContext, resolveSharedDesign, validateTarget } from "@/app/rendering/sharedDesign/sharedDesignRepository.server";
import { parseBingoPrint, printContrastIssues, shortCardCode, PHIL_LOGO, LOVD_LOGO, type BingoPrint } from "@/app/bingo/preparation/bingoPrint";
import { preparationContext } from "./access.server";
import { resolveBingoPrint } from "./printDesign";
import { capturePrintSnapshot } from "./printAssets.server";
import { canonical, sha256 } from "./printSnapshot";
import { storedCard } from "./readExport.server";
import { BingoPreparationError, denied } from "./policy";

async function designContext(tx:Prisma.TransactionClient,userId:number,input:unknown,write=false){
  const target=validateTarget(input);if(target.kind!=='BINGO'&&target.kind!=='SERIES')throw denied();
  if(write){
    if(target.kind==='BINGO')await tx.$queryRaw`SELECT id FROM pubquiz.game_drafts WHERE id=${target.id}::uuid FOR UPDATE`;
    const id=target.kind==='SERIES'?Number(target.id):(await tx.game_drafts.findUnique({where:{id:target.id}}))?.eventreihe_id;
    if(!id)throw denied();await tx.$queryRaw`SELECT pg_advisory_xact_lock(860012,${id})::text`;
    if(target.kind==='SERIES')await tx.$queryRaw`SELECT eventreihe_id FROM pubquiz.eventreihen WHERE eventreihe_id=${id} FOR UPDATE`;
    else await tx.$queryRaw`SELECT eventreihe_id FROM pubquiz.eventreihen WHERE eventreihe_id=${id} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM pubquiz.users WHERE id=${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT benutzer_id FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id=${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT rollenzuweisung_id FROM pubquiz.benutzer_rollenzuweisungen WHERE benutzer_id=${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT benutzer_id FROM pubquiz.eventreihe_verwaltung WHERE benutzer_id=${userId} FOR SHARE`;
  }
  const c=await sharedDesignContext(tx,userId,target);
  if(!c.series.eventarten.some(e=>e.eventart==='BINGO'&&e.ist_freigeschaltet)||(write&&!c.canWrite))throw denied();
  const {design}=await resolveSharedDesign(tx,c.selection,c.series);
  const own=target.kind==='SERIES'?c.series.bingo_print_config:c.game&&'bingo_print_config'in c.game?c.game.bingo_print_config:null;
  const inherited=resolveBingoPrint(design,target.kind==='SERIES'?null:c.series.bingo_print_config);
  const settings=resolveBingoPrint(design,c.series.bingo_print_config,target.kind==='SERIES'?c.series.bingo_print_config:own);
  const stateHash=sha256(canonical({seriesId:c.seriesId,selection:c.selection,own,design,settings,inherited}));
  return {...c,target,design,own,inherited,settings,stateHash};
}
export async function readPrintDesign(userId:number,target:unknown){return prisma.$transaction(async tx=>{const c=await designContext(tx,userId,target);return {target:c.target,canWrite:c.canWrite,settings:c.settings,inherited:c.inherited,own:c.own!==null,stateHash:c.stateHash,seriesId:c.seriesId,designName:c.design.name,source:c.own!==null?'Ausdrückliche Druckabweichung':c.target.kind==='BINGO'&&c.series.bingo_print_config!==null?'Druckstandard der Eventreihe':'Druckstandard der Vorlage',logo:c.design.config.tokens.assets.logo};},{isolationLevel:'RepeatableRead'});}
function existingLogosOnly(config:BingoPrint,c:Awaited<ReturnType<typeof designContext>>){
  const allowed=new Set([PHIL_LOGO,LOVD_LOGO,c.design.config.tokens.assets.logo,c.settings.frontLogo,...c.settings.backLogos,c.inherited.frontLogo,...c.inherited.backLogos]);
  if([config.frontLogo,...config.backLogos].some(ref=>!allowed.has(ref)))throw new BingoPreparationError('Bitte ein vorhandenes Druck-, Reihen- oder Vorlagenlogo auswählen.');
}
export async function savePrintDesign(userId:number,input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw denied();const r=input as Record<string,unknown>;
  if(Object.keys(r).sort().join(',')!=='config,expectedStateHash,target'||typeof r.expectedStateHash!=='string')throw denied();
  const config=r.config===null?null:parseBingoPrint(r.config);if(r.config!==null&&!config)throw new BingoPreparationError('Ungültige Druckeinstellungen.');
  if(config){const issues=printContrastIssues(config);if(issues.length)throw new BingoPreparationError(issues.join(' '));}
  return prisma.$transaction(async tx=>{const c=await designContext(tx,userId,r.target,true);if(c.stateHash!==r.expectedStateHash)throw new BingoPreparationError('Die Designauswahl, Vererbung oder Eventreihe wurde inzwischen geändert. Bitte neu laden.');
    if(config)existingLogosOnly(config,c);
    // Capture validates actual original fonts and logo bytes before accepting configuration.
    await capturePrintSnapshot(c.design,'Druckvorschau','Vorschau',config??c.inherited);
    const data={bingo_print_config:config?config as unknown as Prisma.InputJsonValue:Prisma.DbNull};
    if(c.target.kind==='SERIES')await tx.eventreihen.update({where:{eventreihe_id:Number(c.target.id)},data});else await tx.game_drafts.update({where:{id:c.target.id},data});
    return {success:true as const};
  },{timeout:30000});
}
export async function previewPrintDesign(userId:number,input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw denied();const r=input as Record<string,unknown>;
  if(Object.keys(r).some(k=>!['target','config','seriesId'].includes(k)))throw denied();
  return prisma.$transaction(async tx=>{const c=await designContext(tx,userId,r.target);if(!c.canWrite)throw denied();
    const settings=r.config===undefined?c.settings:r.config===null?c.inherited:parseBingoPrint(r.config);if(!settings)throw new BingoPreparationError('Ungültige Druckeinstellungen.');
    existingLogosOnly(settings,c);
    const snapshot=await capturePrintSnapshot(c.design,'Druckvorschau','Vorschau',settings);
    let card;
    if(r.seriesId!==undefined){if(c.target.kind!=='BINGO'||typeof r.seriesId!=='string')throw denied();const series=await tx.bingo_card_series.findFirst({where:{id:r.seriesId,game_id:c.target.id},include:{short_label:true}});if(!series?.short_label)throw denied();const row=await tx.bingo_cards.findFirstOrThrow({where:{series_id:series.id},orderBy:{ordinal:'asc'}});card={...storedCard(row),shortCode:shortCardCode(series.short_label.prefix,row.ordinal)};}
    return {snapshot,card,hash:sha256(canonical(snapshot)),stateHash:c.stateHash};
  },{timeout:30000,isolationLevel:'RepeatableRead'});
}
export async function redesignSeries(userId:number,input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw denied();const r=input as Record<string,unknown>;
  if(Object.keys(r).sort().join(',')!=='confirmed,expectedRevision,gameId,previewHash,seriesId'||r.confirmed!==true||typeof r.gameId!=='string'||typeof r.seriesId!=='string'||typeof r.previewHash!=='string'||!Number.isSafeInteger(r.expectedRevision))throw denied();
  return prisma.$transaction(async tx=>{const {game,series}=await preparationContext(tx,userId,r.gameId as string,true);const prep=await tx.bingo_preparations.findUniqueOrThrow({where:{game_id:game.id}});if(prep.revision!==r.expectedRevision)throw new BingoPreparationError('Die Vorbereitung wurde inzwischen geändert. Bitte neu laden.');const selected=await tx.bingo_card_series.findFirst({where:{id:r.seriesId as string,game_id:game.id}});if(!selected)throw denied();
    const design=(await resolveSharedDesign(tx,game.shared_design_template_id,series)).design;
    const snapshot=await capturePrintSnapshot(design,'Druckvorschau','Vorschau',resolveBingoPrint(design,series.bingo_print_config,game.bingo_print_config));
    if(sha256(canonical(snapshot))!==r.previewHash)throw new BingoPreparationError('Die Druckgestaltung wurde seit der Vorschau geändert. Bitte Vorschau erneut öffnen.');
    const version=((await tx.bingo_print_versions.aggregate({where:{series_id:selected.id},_max:{version:true}}))._max.version??1)+1;
    await tx.bingo_print_versions.create({data:{series_id:selected.id,version,snapshot:snapshot as unknown as Prisma.InputJsonValue,created_by:userId}});
    await tx.bingo_preparations.update({where:{game_id:game.id},data:{revision:{increment:1}}});return {success:true as const,version};
  },{timeout:30000});
}
