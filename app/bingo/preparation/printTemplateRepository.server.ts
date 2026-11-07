import 'server-only';
import type {Prisma} from '@/app/generated/prisma/client';
import {parsePresentationTemplateConfig} from '@/app/rendering/presentationTemplates/presentationTemplate';
import type {SharedDesign} from '@/app/rendering/sharedDesign/sharedDesign';
import {systemPrintTemplates,parsePrintSelection} from './printTemplates';
import {resolveBingoPrint} from './printDesign';
import {BingoPreparationError} from './policy';
export async function resolveSelectedPrint(tx:Prisma.TransactionClient,design:SharedDesign,series:unknown,game?:unknown){
 const value=game??series,selection=parsePrintSelection(value);
 if(!selection)return resolveBingoPrint(design,series,game);
 let template=systemPrintTemplates().find(t=>t.id===selection.templateId);
 if(!template){
  await tx.$queryRaw`SELECT presentation_template_id FROM pubquiz.presentation_templates WHERE presentation_template_id=${selection.templateId} FOR SHARE`;
  const row=await tx.presentation_templates.findUnique({where:{presentation_template_id:selection.templateId}});
  const config=row&&parsePresentationTemplateConfig(row.theme_config_json);
  if(!row||row.status!=='ACTIVE'||!config||config.purpose!=='BINGO_PRINT'||config.bingoPrint?.layout?.version!==4)throw new BingoPreparationError('Die gewählte Druckvorlage ist nicht mehr aktiv. Bitte eine verfügbare Druckvorlage wählen. Bestehende Druckstände bleiben unverändert.');
  template={...systemPrintTemplates()[0],id:row.presentation_template_id,name:row.name,config};
 }
 const settings=structuredClone(template.config.bingoPrint!);settings.layout={version:4,format:selection.format,textFont:settings.layout!.textFont};return settings;
}
export async function availablePrintTemplates(tx:Prisma.TransactionClient){
 const rows=await tx.presentation_templates.findMany({where:{status:'ACTIVE'},select:{presentation_template_id:true,name:true,theme_config_json:true}});
 return [...systemPrintTemplates().map(t=>({id:t.id,name:t.name,settings:t.config.bingoPrint!})),...rows.flatMap(row=>{const config=parsePresentationTemplateConfig(row.theme_config_json);return config?.purpose==='BINGO_PRINT'&&config.bingoPrint?.layout?.version===4?[{id:row.presentation_template_id,name:row.name,settings:config.bingoPrint}]:[];})];
}

export async function selectedPrintSource(tx:Prisma.TransactionClient,value:unknown){
 const selection=parsePrintSelection(value);if(!selection)return undefined;
 const found=(await availablePrintTemplates(tx)).find(t=>t.id===selection.templateId);
 if(!found)throw new BingoPreparationError('Die Druckvorlage ist nicht verfügbar.');return {id:found.id,name:found.name};
}
