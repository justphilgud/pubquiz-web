"use server";
import {requireAdmin} from '@/app/lib/permissions';
import {getManagedPresentationTemplate} from '@/app/rendering/presentationTemplates/presentationTemplateRepository.server';
import {requirePrintTemplateReader} from './printTemplateAccess.server';
import {getPresentationTemplate} from '@/app/rendering/templateRegistry';
import {capturePrintSnapshot} from './printAssets.server';
import {parseBingoPrint} from './bingoPrint';
import {printFormat} from './printFormats';
import {parsePrintSnapshot} from './printSnapshot';
import {parseTermSet} from './termSet';
import {createReferenceCardsPdf} from './pdfReference.server';
import type {SharedDesign} from '@/app/rendering/sharedDesign/sharedDesign';
export async function previewCentralPrintTemplate(input:unknown){
 await requirePrintTemplateReader();
 try{
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Ungültige Vorschau.');const r=input as Record<string,unknown>;
  if(Object.keys(r).some(k=>!['templateId','settings','format','mode'].includes(k))||typeof r.templateId!=='string'||!['NUMBERS','TERMS'].includes(String(r.mode)))throw Error('Ungültige Vorschau.');
  const {admin}=await requirePrintTemplateReader(),template=await getManagedPresentationTemplate(r.templateId);
  if(!template||template.config.purpose!=='BINGO_PRINT'||(!admin&&!['ACTIVE','SYSTEM'].includes(template.status)))throw Error('Druckvorlage nicht verfügbar.');
  if(r.settings!==undefined)await requireAdmin();
  const settings=parseBingoPrint(r.settings??template.config.bingoPrint);if(!settings||settings.layout?.version!==4)throw Error('Ungültige Druckeinstellungen.');
  settings.layout.format=printFormat(r.format);const base=getPresentationTemplate('phil-gud')!;
  const design:SharedDesign={version:1,templateId:base.id,name:template.name,config:{version:1,tokens:base.tokens,design:base.design,surfaces:{presentation:base.variant,moderation:'BRANDED',answerForm:'BRANDED'}}};
  let snapshot=await capturePrintSnapshot(design,'Synthetische Druckvorschau','Beispielrunde',settings,{id:template.id,name:template.name});
  if(r.mode==='TERMS'){
   const labels=['ABBA','Bob Dylan','Take That','Queen','Adele','Lady Gaga','Pink Floyd','U2','Die Ärzte','Falco','Nena','AC/DC','Oasis','Prince','Lou Reed','Bon Jovi','Elton John','Boney M.','Kiss','Earth Wind & Fire','Dua Lipa','Billy Joel','R.E.M.','The Who'];
   snapshot=parsePrintSnapshot({...snapshot,terms:parseTermSet({version:1,name:'Synthetisches Musikmuster',publication:'DIRECT',entries:Array.from({length:75},(_,i)=>({number:i+1,text:labels[i]??`Band ${i+1}`}))})});
  }
  const cards=Array.from({length:7},(_,i)=>({id:`synthetic-${i}`,code:'SYNTHETIC',shortCode:`A-${String(i+1).padStart(3,'0')}`,ordinal:i+1,cells:[[1,16,31,46,61],[2,17,32,47,62],[3,18,null,48,63],[4,19,34,49,64],[5,20,35,50,65]]}));
  const [front,back,sheet]=await Promise.all([createReferenceCardsPdf(snapshot,[cards[0]],'front',true),createReferenceCardsPdf(snapshot,[cards[0]],'back',true),createReferenceCardsPdf(snapshot,cards,'duplex')]);
  return {success:true as const,front:Buffer.from(front).toString('base64'),back:Buffer.from(back).toString('base64'),sheet:Buffer.from(sheet).toString('base64'),hash:'synthetic'};
 }catch(e){return {success:false as const,message:e instanceof Error?e.message:'Vorschau nicht verfügbar.'};}
}
