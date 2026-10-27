import "server-only";
import fontkit from "@pdf-lib/fontkit";
import { randomBytes } from "node:crypto";
import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix, type PDFPage, type PDFFont, type PDFImage } from "pdf-lib";
import { parsePrintSnapshot, type PrintSnapshot, type EmbeddedAsset } from "./printSnapshot";
import { BingoPreparationError, decodeCard, MAX_EXPORT, type StoredCard } from "./policy";
export type PrintMode = "front"|"duplex"|"back";
export const printGeometry={pageWidth:595.276,pageHeight:841.89,margin:28.35,gap:14.17,side:(595.276-2*28.35-14.17)/2};
export function cardPosition(slot:number,back=false){const g=printGeometry,col=back?1-slot%2:slot%2,row=Math.floor(slot/2);return {x:g.margin+col*(g.side+g.gap),y:g.pageHeight-g.margin-g.side-row*(g.side+g.gap),side:g.side};}
const color=(hex:string)=>rgb(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255) as [number,number,number]);
type Face=ReturnType<typeof fontkit.create>;
export function regularFace(bytes:Uint8Array):Face{
  const face=fontkit.create(bytes) as Face&{variationAxes?:Record<string,{min:number;max:number}>;getVariation?:(axes:Record<string,number>)=>Face};
  const axis=face.variationAxes?.wght;if(axis){if(axis.min>400||axis.max<400||!face.getVariation)throw new BingoPreparationError('Der Originalschrift fehlt der reguläre Druckschnitt.');return face.getVariation({wght:400});}return face;
}
/** Visible original contours supply the metrics; PDF viewer text metrics do not. */
export function glyphGeometry(face:Face,text:string,size:number){const run=face.layout(text),scale=size/face.unitsPerEm;let advance=0,min=Infinity,max=-Infinity;const glyphs=run.glyphs.map((glyph,i)=>{const p=run.positions[i],x=advance+p.xOffset;advance+=p.xAdvance;const box=glyph.bbox;min=Math.min(min,(x+box.minX)*scale);max=Math.max(max,(x+box.maxX)*scale);return {glyph,x:x*scale,y:p.yOffset*scale};});return {glyphs,scale,min,max,width:max-min,advance:advance*scale};}
function text(page:PDFPage,value:string,font:PDFFont,face:Face,requested:number,x:number,y:number,width:number,ink:ReturnType<typeof rgb>){
  if([...value].some(c=>!face.hasGlyphForCodePoint(c.codePointAt(0)!)))throw new BingoPreparationError('Die Druckschrift unterstützt nicht alle Zeichen.');
  let size=requested,g=glyphGeometry(face,value,size);if(g.width>width-6){size*=(width-6)/g.width;g=glyphGeometry(face,value,size);}if(size<7)throw new BingoPreparationError('Die Kartenkennung passt nicht in das Druckfeld.');const left=x+(width-g.width)/2-g.min;
  page.drawText(value,{font,size,x:left,y,opacity:0});
  // Independent run and glyph transforms; no card/column state can accumulate.
  page.pushOperators(pushGraphicsState(),concatTransformationMatrix(1,0,0,-1,0,0));
  for(const p of g.glyphs){const path=p.glyph.path.toSVG();if(path.trim())page.drawSvgPath(path,{x:left+p.x,y:-y-p.y,scale:g.scale,color:ink});}page.pushOperators(popGraphicsState());
}
function cut(page:PDFPage,x:number,y:number,s:number){for(const dx of [0,s])for(const dy of [0,s]){const px=x+dx,py=y+dy,sx=dx===0?-1:1,sy=dy===0?-1:1;page.drawLine({start:{x:px+sx*2,y:py},end:{x:px+sx*5,y:py},thickness:.3,color:rgb(.5,.5,.5)});page.drawLine({start:{x:px,y:py+sy*2},end:{x:px,y:py+sy*5},thickness:.3,color:rgb(.5,.5,.5)});}}
function logo(page:PDFPage,image:PDFImage,cx:number,cy:number,w:number,h:number){const factor=Math.min(w/image.width,h/image.height);page.drawImage(image,{x:cx-image.width*factor/2,y:cy-image.height*factor/2,width:image.width*factor,height:image.height*factor});}
export async function createSquareCardsPdf(input:PrintSnapshot,cards:readonly StoredCard[],mode:PrintMode='front'){
  const snap=parsePrintSnapshot(input);if(snap.version!==2)throw new BingoPreparationError('Für Rückseiten bitte ausdrücklich eine neue Druckdesign-Version anlegen.');
  if(!cards.length||cards.length>MAX_EXPORT||new Set(cards.map(c=>c.id)).size!==cards.length)throw new BingoPreparationError('Ungültige Kartenmenge für den PDF-Export.');for(const c of cards){decodeCard(c.cells);if(!c.shortCode)throw new BingoPreparationError('Die dauerhafte kurze Kartenkennung fehlt.');}
  const pdf=await PDFDocument.create();pdf.setTitle('Bingo-Druckkarten');pdf.setSubject(mode==='duplex'?'A4 Hochformat · an langer Kante wenden':'Bingo-Druckkarten');
  const embedded=async(a:EmbeddedAsset,role:'Heading'|'Numbers')=>{const face=regularFace(Buffer.from(a.bytes,'base64'));pdf.registerFontkit({create:()=>face});const prefix=[...randomBytes(6)].map(n=>String.fromCharCode(65+n%26)).join('');return {face,font:await pdf.embedFont(Buffer.from(a.bytes,'base64'),{subset:true,customName:`${prefix}+Bingo${role}${a.name.replace(/[^A-Za-z0-9]/g,'')}`})};};
  const heading=await embedded(snap.display,'Heading'),numbers=await embedded(snap.body,'Numbers'),images=new Map<string,PDFImage>();const image=async(a:EmbeddedAsset)=>{let img=images.get(a.sha256);if(!img){img=await pdf.embedPng(Buffer.from(a.bytes,'base64'));images.set(a.sha256,img);}return img;};
  const front=await image(snap.logo),backs=await Promise.all(snap.backLogos.map(image)),colors=snap.settings.colors,g=printGeometry;
  for(let offset=0;offset<cards.length;offset+=4)for(const back of mode==='duplex'?[false,true]:[mode==='back']){const page=pdf.addPage([g.pageWidth,g.pageHeight]);for(let slot=0;slot<4&&offset+slot<cards.length;slot++){
    const c=cards[offset+slot],{x,y,side}=cardPosition(slot,back);page.drawRectangle({x,y,width:side,height:side,color:color(back?colors.back:colors.background)});
    if(back){if(backs.length===1)logo(page,backs[0],x+side/2,y+side/2,side-48,side-48);else backs.forEach((img,i)=>{const factor=Math.min(Math.sqrt(8100/(img.width*img.height)),(side-48)/img.width,90/img.height);logo(page,img,x+side/2,y+side/2+(i===0?58:-58),img.width*factor,img.height*factor);});}
    else{const cell=(side-48)/5,gx=x+24,gy=y+19,header=25;for(let row=0;row<6;row++)for(let col=0;col<5;col++){
      const cx=gx+col*cell,cy=row===0?gy+5*cell:gy+(5-row)*cell,height=row===0?header:cell,free=row===3&&col===2;
      page.drawRectangle({x:cx,y:cy,width:cell,height,color:color(row===0||free?colors.header:colors.background),borderColor:color(colors.grid),borderWidth:.5});
      if(free)logo(page,front,cx+cell/2,cy+cell/2,cell-8,cell-8);else if(row===0)text(page,'BINGO'[col],heading.font,heading.face,21,cx,cy+5,cell,color(colors.heading));else text(page,String(c.cells[row-1][col]),numbers.font,numbers.face,22,cx,cy+(cell-22)/2+4,cell,color(colors.numbers));
    }text(page,c.shortCode!,numbers.font,numbers.face,8,x,y+6,side,color(colors.numbers));}cut(page,x,y,side);
  }}const bytes=await pdf.save();if(bytes.length>20*1024*1024)throw new BingoPreparationError('Das PDF überschreitet 20 MB. Bitte einen kleineren Kartenbereich wählen. Es wurde keine unvollständige Datei ausgegeben.');return bytes;
}
