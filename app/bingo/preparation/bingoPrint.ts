import { isSafeTemplateAssetReference } from "@/app/rendering/presentationTemplates/presentationTemplateAssets";

export const PHIL_LOGO = "/branding/phil-gud/website-logo.jpg";
export const LOVD_LOGO = "/branding/lovd/lovd-stelp.png";
export const printFonts = [
  { id: "PHIL_GUD", name: "Phil Gud Display Regular", family: '"Phil Gud Display", sans-serif' },
  { id: "MONTSERRAT", name: "Montserrat Regular", family: "var(--font-montserrat), sans-serif" },
  { id: "ARIMO", name: "Arimo Regular (Arial-kompatibel)", family: "Arial, Helvetica, sans-serif" },
] as const;
export type PrintFont = typeof printFonts[number]["id"];
export type BingoPrint = {
  version: 1;
  frontLogo: string;
  backLogos: string[];
  headerFont: PrintFont;
  numberFont: Exclude<PrintFont,"PHIL_GUD">;
  colors: { background: string; header: string; grid: string; heading: string; numbers: string; back: string };
};
const object = (v:unknown):v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string)=>Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
export function parseBingoPrint(value:unknown):BingoPrint|null {
  if(!object(value)||!exact(value,'version,frontLogo,backLogos,headerFont,numberFont,colors')||value.version!==1||typeof value.frontLogo!=='string'||!isSafeTemplateAssetReference(value.frontLogo)||!Array.isArray(value.backLogos)||value.backLogos.length<1||value.backLogos.length>2||!value.backLogos.every(x=>typeof x==='string'&&isSafeTemplateAssetReference(x))||new Set(value.backLogos).size!==value.backLogos.length||!printFonts.some(f=>f.id===value.headerFont)||!['ARIMO','MONTSERRAT'].includes(String(value.numberFont))||!object(value.colors)||!exact(value.colors,'background,header,grid,heading,numbers,back')||!Object.values(value.colors).every(c=>typeof c==='string'&&/^#[0-9a-fA-F]{6}$/.test(c)))return null;
  return structuredClone(value) as BingoPrint;
}
export function defaultBingoPrint(design:{templateId:string;config:{tokens:{assets:{logo:string|null};colors:{primary:string};typography:{family:string;displayFamily?:string}};bingoPrint?:BingoPrint}}):BingoPrint {
  if(design.config.bingoPrint)return structuredClone(design.config.bingoPrint);
  const lovd=design.templateId==='lovd-ungegoogelt'||design.config.tokens.assets.logo===LOVD_LOGO;
  return {version:1,frontLogo:design.config.tokens.assets.logo??(lovd?LOVD_LOGO:PHIL_LOGO),backLogos:lovd?[LOVD_LOGO,PHIL_LOGO]:[PHIL_LOGO],headerFont:design.templateId==='phil-gud'?'PHIL_GUD':'MONTSERRAT',numberFont:'ARIMO',colors:{background:'#FFFFFF',header:design.config.tokens.colors.primary,grid:'#414141',heading:'#14181C',numbers:'#14181C',back:'#14181C'}};
}
function luminance(hex:string){const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
export function printContrastIssues(config:BingoPrint):string[]{
  const checks=[['Zahlen',config.colors.numbers,config.colors.background,4.5],['BINGO-Schriftzug',config.colors.heading,config.colors.header,3],['Rasterlinien',config.colors.grid,config.colors.background,3]] as const;
  return checks.flatMap(([name,a,b,min])=>{const l=luminance(a),r=luminance(b),ratio=(Math.max(l,r)+.05)/(Math.min(l,r)+.05);return ratio<min?[`${name}: Kontrast ${ratio.toFixed(1)}:1 ist zu niedrig (mindestens ${min}:1). Bitte Farben prüfen.`]:[];});
}
/** Scoped to one game; prefix allocation is serialized and persisted, never truncated. */
export function shortCardCode(prefix:number,ordinal:number){
  if(!Number.isSafeInteger(prefix)||prefix<1||!Number.isSafeInteger(ordinal)||ordinal<1||ordinal>500)throw Error('SHORT_CODE_INVALID');
  let letters='';for(let n=prefix;n>0;n=Math.floor((n-1)/26))letters=String.fromCharCode(65+(n-1)%26)+letters;
  return `${letters}-${String(ordinal).padStart(3,'0')}`;
}
