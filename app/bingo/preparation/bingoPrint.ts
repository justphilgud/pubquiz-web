import { isSafeTemplateAssetReference } from "@/app/rendering/presentationTemplates/presentationTemplateAssets";

export const PHIL_LOGO = "/branding/phil-gud/website-logo.jpg";
export const PHIL_PRINT_LOGO = "/branding/bingo-print/phil-gud.png";
export const LOVD_PRINT_LOGO = "/branding/bingo-print/lovd.png";
export const LOVD_SMALL_LOGO = "/branding/bingo-print/lovd-small-creme.png";
export const LOVD_LIGHT_LOGO = "/branding/lovd/lovd-stelp-creme-rgb.png";
// Most frequent RGB pixel in the original LOVD tile embedded on the back.
export const LOVD_RED = "#74291D";
export const LOVD_CREAM = "#FFF9E9";
export const LOVD_LOGO = "/branding/lovd/lovd-stelp.png";
export const printFonts = [
  { id: "PHIL_GUD", name: "Phil Gud Display Regular", family: '"Phil Gud Display", sans-serif' },
  { id: "MONTSERRAT", name: "Montserrat Regular", family: "var(--font-montserrat), sans-serif" },
  { id: "ARIMO", name: "Arimo Regular (Arial-kompatibel)", family: "Arial, Helvetica, sans-serif" },
] as const;
export type PrintFont = typeof printFonts[number]["id"];
import { parsePrintLayout, type PrintLayout } from "./printFormats";
export type BingoPrint = {
  version: 1;
  partnerBack?: 1;
  frontLogo: string;
  backLogos: string[];
  headerFont: PrintFont;
  numberFont: PrintFont;
  layout?: PrintLayout & { version: 3 | 4; textFont: PrintFont };
  colors: { background: string; header: string; grid: string; heading: string; numbers: string; back: string };
};
const object = (v:unknown):v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string)=>Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
export function parseBingoPrint(value:unknown):BingoPrint|null {
  if(!object(value)||!exact(value, (Object.hasOwn(value,'layout')?'version,frontLogo,backLogos,headerFont,numberFont,colors,layout':'version,frontLogo,backLogos,headerFont,numberFont,colors')+(Object.hasOwn(value,'partnerBack')?',partnerBack':''))||value.version!==1||typeof value.frontLogo!=='string'||!isSafeTemplateAssetReference(value.frontLogo)||!Array.isArray(value.backLogos)||value.backLogos.length<1||value.backLogos.length>2||!value.backLogos.every(x=>typeof x==='string'&&isSafeTemplateAssetReference(x))||new Set(value.backLogos).size!==value.backLogos.length||!printFonts.some(f=>f.id===value.headerFont)||!(value.layout?printFonts.map(f=>f.id):['ARIMO','MONTSERRAT']).includes(String(value.numberFont))||!object(value.colors)||!exact(value.colors,'background,header,grid,heading,numbers,back')||!Object.values(value.colors).every(c=>typeof c==='string'&&/^#[0-9a-fA-F]{6}$/.test(c)))return null;
  if (Object.hasOwn(value,'partnerBack')&&(value.partnerBack!==1||!value.layout))return null;
  if (value.layout !== undefined) {
    const layout=value.layout;
    if (!object(layout) || !exact(layout,layout.format==='SRA3_TWELVE'?'version,format,cardProfile,textFont':'version,format,textFont') || ![3,4].includes(Number(layout.version)) || !printFonts.some(f=>f.id===layout.textFont)) return null;
    try { parsePrintLayout({format:layout.format,...(layout.cardProfile!==undefined?{cardProfile:layout.cardProfile}:{})}); } catch { return null; }
  }
  return structuredClone(value) as BingoPrint;
}
export function defaultBingoPrint(design:{templateId:string;config:{tokens:{assets:{logo:string|null};colors:{primary:string};typography:{family:string;displayFamily?:string}};bingoPrint?:BingoPrint}}):BingoPrint {
  if(design.config.bingoPrint)return structuredClone(design.config.bingoPrint);
  const lovd=design.templateId==='lovd-ungegoogelt'||[LOVD_LOGO,LOVD_LIGHT_LOGO,LOVD_PRINT_LOGO,LOVD_SMALL_LOGO].includes(design.config.tokens.assets.logo??'');
  return {version:1,frontLogo:design.config.tokens.assets.logo??(lovd?LOVD_LOGO:PHIL_LOGO),backLogos:lovd?[LOVD_LOGO,PHIL_LOGO]:[PHIL_LOGO],headerFont:design.templateId==='phil-gud'?'PHIL_GUD':'MONTSERRAT',numberFont:'ARIMO',colors:{background:'#FFFFFF',header:design.config.tokens.colors.primary,grid:'#414141',heading:'#14181C',numbers:'#14181C',back:'#14181C'}};
}
function luminance(hex:string){const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
export function printContrastIssues(config:BingoPrint):string[]{
  const checks=[['Zahlen',config.colors.numbers,config.colors.background,4.5],['BINGO-Schriftzug',config.colors.heading,config.colors.header,3],['Rasterlinien',config.colors.grid,config.colors.background,3]] as const;
  return checks.flatMap(([name,a,b,min])=>{const l=luminance(a),r=luminance(b),ratio=(Math.max(l,r)+.05)/(Math.min(l,r)+.05);return ratio<min?[`${name}: Kontrast ${ratio.toFixed(1)}:1 ist zu niedrig (mindestens ${min}:1). Bitte Farben prüfen.`]:[];});
}
/** Scoped to one game; prefix allocation is serialized and persisted, never truncated. */
export const isWildcardCode=(code:string)=>/^WC-[A-Z]+-\d{3}$/.test(code);
export function shortCardCode(prefix:number,ordinal:number,wildcard=false){
  if(!Number.isSafeInteger(prefix)||prefix<1||!Number.isSafeInteger(ordinal)||ordinal<1||ordinal>500)throw Error('SHORT_CODE_INVALID');
  let letters='';for(let n=prefix;n>0;n=Math.floor((n-1)/26))letters=String.fromCharCode(65+(n-1)%26)+letters;
  return `${wildcard?'WC-':''}${letters}-${String(ordinal).padStart(3,'0')}`;
}

/** Only absent configurations receive the new defaults. Explicit saved font choices stay untouched. */
export function newBingoPrint(design: Parameters<typeof defaultBingoPrint>[0]): BingoPrint {
  const settings=defaultBingoPrint(design);
  if (design.config.bingoPrint) return prepareLovdPrint(settings);
  const modern:BingoPrint={...settings,headerFont:'PHIL_GUD',numberFont:'PHIL_GUD',layout:{version:3,format:'A4_FOUR',textFont:'ARIMO'}};
  const lovd=design.templateId==='lovd-ungegoogelt'||[LOVD_LOGO,LOVD_LIGHT_LOGO,LOVD_PRINT_LOGO,LOVD_SMALL_LOGO].includes(settings.frontLogo);
  if(lovd)modern.colors={...modern.colors,header:LOVD_RED,heading:LOVD_CREAM};
  return prepareLovdPrint(modern);
}

/** Only current settings/new captures use this adapter; historical exports never do. */
export function prepareLovdPrint(input:BingoPrint):BingoPrint {
 const settings=structuredClone(input),lovd=[LOVD_LOGO,LOVD_LIGHT_LOGO,LOVD_PRINT_LOGO,LOVD_SMALL_LOGO];
 if(!lovd.includes(settings.frontLogo)&&!settings.backLogos.some(ref=>lovd.includes(ref)))return settings;
 if(!settings.layout)settings.layout={version:3,format:'A4_FOUR',textFont:'ARIMO'};
 settings.partnerBack=1;
 if(lovd.includes(settings.frontLogo))settings.frontLogo=LOVD_SMALL_LOGO;
 settings.backLogos=settings.backLogos.map(ref=>lovd.includes(ref)?LOVD_LOGO:ref===PHIL_LOGO?PHIL_PRINT_LOGO:ref);
 if(settings.backLogos.length===2&&settings.backLogos.includes(LOVD_LOGO)&&settings.backLogos.includes(PHIL_PRINT_LOGO))settings.backLogos=[LOVD_LOGO,PHIL_PRINT_LOGO];
 return settings;
}
