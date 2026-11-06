import {getPresentationTemplate} from '@/app/rendering/templateRegistry';
import type {ManagedPresentationTemplate} from '@/app/rendering/presentationTemplates/presentationTemplate';
import {PHIL_PRINT_LOGO,LOVD_PRINT_LOGO,type BingoPrint} from './bingoPrint';
export const printTemplateIds=['bingo-print-phil-gud','bingo-print-lovd-phil-gud'] as const;
export function systemPrintTemplates():ManagedPresentationTemplate[]{return printTemplateIds.map((id,i)=>{
 const base=getPresentationTemplate('phil-gud')!,lovd=i===1;
 const bingoPrint:BingoPrint={version:1,frontLogo:lovd?LOVD_PRINT_LOGO:PHIL_PRINT_LOGO,backLogos:lovd?[LOVD_PRINT_LOGO,PHIL_PRINT_LOGO]:[PHIL_PRINT_LOGO],headerFont:'PHIL_GUD',numberFont:'PHIL_GUD',layout:{version:4,format:'A4_FOUR',textFont:'PHIL_GUD'},colors:{background:lovd?'#FFF8E9':'#FFFFFF',header:lovd?'#733B40':'#000000',grid:'#888888',heading:lovd?'#FFF8E9':'#F0FC16',numbers:'#171717',back:'#000000'}};
 return {id,name:lovd?'LOVD × Phil Gud':'Phil Gud',description:'Bingo-Druckvorlage für Zahlen- und Textkarten mit Originalschrift und transparenter Markenwelt.',status:'SYSTEM',source:'SYSTEM',isSystem:true,contractVersion:1,config:{version:1,purpose:'BINGO_PRINT',tokens:structuredClone(base.tokens),surfaces:{presentation:base.variant,moderation:'BRANDED',answerForm:'BRANDED'},design:structuredClone(base.design),bingoPrint},tags:['System','Bingo','Druck'],sourceTemplateId:null,creatorName:null,updatedAt:null,usageCount:0};
});}
export type PrintSelection={version:2;templateId:string;format:import('./printFormats').PrintFormat};
export function parsePrintSelection(value:unknown):PrintSelection|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const r=value as Record<string,unknown>;
 return Object.keys(r).sort().join(',')==='format,templateId,version'&&r.version===2&&typeof r.templateId==='string'&&/^[a-z0-9-]{1,64}$/.test(r.templateId)&&['A4_FOUR','A4_SIX','A6_ONE'].includes(String(r.format))?structuredClone(r) as PrintSelection:null;
}
