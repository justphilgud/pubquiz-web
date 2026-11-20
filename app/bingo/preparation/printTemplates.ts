import {parsePrintLayout,type PrintLayout} from './printFormats';
import {getPresentationTemplate} from '@/app/rendering/templateRegistry';
import type {ManagedPresentationTemplate} from '@/app/rendering/presentationTemplates/presentationTemplate';
import {PHIL_PRINT_LOGO,LOVD_LOGO,LOVD_SMALL_LOGO,LOVD_RED,LOVD_CREAM,type BingoPrint} from './bingoPrint';
export const printTemplateIds=['bingo-print-phil-gud','bingo-print-lovd-phil-gud'] as const;
export function systemPrintTemplates():ManagedPresentationTemplate[]{return printTemplateIds.map((id,i)=>{
 const base=getPresentationTemplate('phil-gud')!,lovd=i===1;
 const bingoPrint:BingoPrint={version:1,...(lovd?{partnerBack:1 as const}:{}),frontLogo:lovd?LOVD_SMALL_LOGO:PHIL_PRINT_LOGO,backLogos:lovd?[LOVD_LOGO,PHIL_PRINT_LOGO]:[PHIL_PRINT_LOGO],headerFont:'PHIL_GUD',numberFont:'PHIL_GUD',layout:{version:4,format:'A4_FOUR',textFont:'PHIL_GUD'},colors:{background:lovd?'#FFF8E9':'#FFFFFF',header:lovd?LOVD_RED:'#000000',grid:'#888888',heading:lovd?LOVD_CREAM:'#F0FC16',numbers:'#171717',back:'#000000'}};
 return {id,name:lovd?'LOVD × Phil Gud':'Phil Gud',description:'Bingo-Druckvorlage für Zahlen- und Textkarten mit Originalschrift und transparenter Markenwelt.',status:'SYSTEM',source:'SYSTEM',isSystem:true,contractVersion:1,config:{version:1,purpose:'BINGO_PRINT',tokens:structuredClone(base.tokens),surfaces:{presentation:base.variant,moderation:'BRANDED',answerForm:'BRANDED'},design:structuredClone(base.design),bingoPrint},tags:['System','Bingo','Druck'],sourceTemplateId:null,creatorName:null,updatedAt:null,usageCount:0};
});}
export type PrintSelection={version:2;templateId:string} & PrintLayout;
export function parsePrintSelection(value:unknown):PrintSelection|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const r=value as Record<string,unknown>;
 try {const layout=parsePrintLayout({format:r.format,...(r.cardProfile!==undefined?{cardProfile:r.cardProfile}:{})});return Object.keys(r).sort().join(',')===(r.format==='SRA3_TWELVE'?'cardProfile,format,templateId,version':'format,templateId,version')&&r.version===2&&typeof r.templateId==='string'&&/^[a-z0-9-]{1,64}$/.test(r.templateId)?structuredClone({version:2,templateId:r.templateId,...layout}):null;}catch{return null;}
}
