import 'server-only';
import {randomBytes} from 'node:crypto';
import {PDFDocument,rgb,type PDFFont} from 'pdf-lib';
import {parsePrintSnapshot,type EmbeddedAsset,type PrintSnapshot} from './printSnapshot';
import {regularFace,glyphGeometry,type PrintMode} from './pdfSquare.server';
import {draw,logo} from './pdfModern.server';
import {geometry,position} from './printFormats';
import {BingoPreparationError,decodeCard,MAX_EXPORT,type StoredCard} from './policy';
import {termFor,usesCardText} from './termSet';
type Face=ReturnType<typeof regularFace>;
const ink=(hex:string)=>rgb(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255) as [number,number,number]);
/** V4 only: full words, up to three lines, actual glyph metrics, never below 10 pt. */
export function fitReferenceTerm(value:string,face:Face,width:number,height:number){
 if([...value].some(c=>!face.hasGlyphForCodePoint(c.codePointAt(0)!)))throw new BingoPreparationError(`Die Textschrift unterstützt nicht alle Zeichen in „${value}“.`);
 for(let size=11;size>=10;size-=.25){
  const lines:string[]=[];let line='';let fits=true;
  for(const paragraph of value.split('\n')){
   for(const word of paragraph.trim().split(/\s+/)){
    if(!word)continue;if(glyphGeometry(face,word,size).width>width){fits=false;break;}
    const next=line?`${line} ${word}`:word;
    if(glyphGeometry(face,next,size).width<=width)line=next;else{lines.push(line);line=word;}
   }
   if(line)lines.push(line);line='';if(!fits)break;
  }
  const ascent=Math.max(0,...lines.flatMap(l=>face.layout(l).glyphs.map(g=>g.bbox.maxY)))*size/face.unitsPerEm;
  const descent=Math.min(0,...lines.flatMap(l=>face.layout(l).glyphs.map(g=>g.bbox.minY)))*size/face.unitsPerEm;
  const lineHeight=size*1.12,inkHeight=ascent-descent;
  if(fits&&lines.length>0&&lines.length<=3&&inkHeight+(lines.length-1)*lineHeight<=height)return {lines,size,lineHeight,inkHeight,ascent,descent};
 }
 throw new BingoPreparationError(`„${value}“ passt bei mindestens 10 pt und höchstens drei Wortzeilen nicht in das gewählte Kartenformat. Bitte Begriff, Schrift oder Format ändern. Es wurde nichts gekürzt.`);
}
export function validateReferenceTerms(input:PrintSnapshot){
 const snap=parsePrintSnapshot(input);if(snap.version!==4||!snap.terms)return;
 const g=geometry(snap.settings.layout!.format),face=regularFace(Buffer.from(snap.text.bytes,'base64'));
 for(const entry of snap.terms.entries.filter(e=>e.number<=75))try{if(usesCardText(snap.terms,entry.number))fitReferenceTerm(termFor(snap.terms,entry.number),face,(g.side-28)/5-4,(g.side-70)/5-4);}catch(e){throw new BingoPreparationError(`Kugel ${entry.number}: ${e instanceof Error?e.message:'Begriff passt nicht.'}`);}
}
/** Separate versioned renderer. V1/V2/V3 exports never enter this implementation. */
export async function createReferenceCardsPdf(input:PrintSnapshot,cards:readonly StoredCard[],mode:PrintMode='front',singleCard=false){
 const snap=parsePrintSnapshot(input);if(snap.version!==4||!snap.settings.layout)throw new BingoPreparationError('Ungültiger V4-Druckstand.');
 if(!cards.length||cards.length>MAX_EXPORT||new Set(cards.map(c=>c.id)).size!==cards.length)throw new BingoPreparationError('Ungültige Kartenmenge für den PDF-Export.');
 for(const card of cards){decodeCard(card.cells);if(!card.shortCode)throw new BingoPreparationError('Die dauerhafte Kartenkennung fehlt.');}
 validateReferenceTerms(snap);
 const g=geometry(snap.settings.layout.format),capacity=singleCard?1:g.capacity,pdf=await PDFDocument.create();
 pdf.setTitle('Bingo-Druckkarten');pdf.setSubject(`${snap.settings.layout.format} · V4 · tatsächliche Größe 100 % · Duplex an langer Kante`);
 async function font(asset:EmbeddedAsset):Promise<{face:Face;font:PDFFont}>{const bytes=Buffer.from(asset.bytes,'base64'),face=regularFace(bytes);pdf.registerFontkit({create:()=>face});return {face,font:await pdf.embedFont(bytes,{subset:true,customName:`${randomBytes(6).toString('hex')}Bingo`})};}
 const heading=await font(snap.display),numbers=await font(snap.body),words=await font(snap.text),code=await font(snap.codeFont),front=await pdf.embedPng(Buffer.from(snap.logo.bytes,'base64')),backs=await Promise.all(snap.backLogos.map(a=>pdf.embedPng(Buffer.from(a.bytes,'base64')))),c=snap.settings.colors;
 // A contrasting neutral, drawn over an explicitly logo-free bottom margin, no label bar.
 const l=[1,3,5].map(i=>parseInt(c.back.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const soft=.406,lightRatio=(soft+.05)/(l+.05),darkRatio=(l+.05)/(.0176+.05);
 const codeInk=lightRatio>=4.5?rgb(.67,.67,.67):darkRatio>=4.5?rgb(.14,.14,.14):l<.179?rgb(1,1,1):rgb(0,0,0);
 for(let offset=0;offset<cards.length;offset+=capacity)for(const back of mode==='duplex'?[false,true]:[mode==='back']){
  const page=pdf.addPage(singleCard?[g.side,g.side]:[g.width,g.height]);
  for(let slot=0;slot<capacity&&offset+slot<cards.length;slot++){
   const card=cards[offset+slot],{x,y,side}=singleCard?{x:0,y:0,side:g.side}:position(snap.settings.layout.format,slot,back);
   page.drawRectangle({x,y,width:side,height:side,color:ink(back?c.back:c.background)});
   if(back){
    page.drawRectangle({x:x+9,y:y+9,width:side-18,height:side-18,borderColor:codeInk,borderWidth:.25,opacity:.25,borderOpacity:.4});
    if(backs.length===1)logo(page,backs[0],x+side/2,y+side/2+3,side*.68,side*.72);
    else{
     logo(page,backs[0],x+side/2,y+side*.75,side*.62,side*.25);
     logo(page,backs[1],x+side/2,y+side*.31,side*.36,side*.37);
     const cx=x+side/2,cy=y+side*.565,r=6;
     for(const direction of [-1,1])page.drawLine({start:{x:cx-r,y:cy-direction*r},end:{x:cx+r,y:cy+direction*r},thickness:.35,color:codeInk});
    }
    draw(page,card.shortCode!,code,6.5,x+14,y+14,side-28,codeInk,true);
   }else{
    const gx=x+14,gy=y+14,w=(side-28)/5,h=(side-70)/5,hy=gy+5*h+8,hh=34;
    page.drawRectangle({x:gx,y:hy,width:5*w,height:hh,color:ink(c.header)});
    page.drawLine({start:{x:gx,y:hy-2},end:{x:gx+5*w,y:hy-2},thickness:1,color:ink('#F6C4DC')});
    for(let col=0;col<5;col++)draw(page,'BINGO'[col],heading,26,gx+col*w+2,hy+8,w-4,ink(c.heading));
    for(let row=0;row<5;row++)for(let col=0;col<5;col++){
     const cx=gx+col*w,cy=gy+(4-row)*h,free=row===2&&col===2;
     page.drawRectangle({x:cx,y:cy,width:w,height:h,color:ink(free?c.header:c.background),borderColor:ink(c.grid),borderWidth:.4});
     if(free)logo(page,front,cx+w/2,cy+h/2,w-5,h-4);
     else if(snap.terms&&usesCardText(snap.terms,card.cells[row][col]!)){const fit=fitReferenceTerm(termFor(snap.terms,card.cells[row][col]!),words.face,w-4,h-4),baseline=cy+(h+fit.inkHeight+(fit.lines.length-1)*fit.lineHeight)/2-fit.ascent;fit.lines.forEach((line,i)=>draw(page,line,words,fit.size,cx+2,baseline-i*fit.lineHeight,w-4,ink(c.numbers)));}
     else{let size=snap.settings.layout.format==='A4_SIX'?24:26;while(glyphGeometry(numbers.face,String(card.cells[row][col]),size).width>w-4&&size>10)size-=.25;const run=numbers.face.layout(String(card.cells[row][col])),ascent=Math.max(...run.glyphs.map(g=>g.bbox.maxY))*size/numbers.face.unitsPerEm,descent=Math.min(...run.glyphs.map(g=>g.bbox.minY))*size/numbers.face.unitsPerEm;draw(page,String(card.cells[row][col]),numbers,size,cx+2,cy+(h-ascent-descent)/2,w-4,ink(c.numbers));}
    }
   }
   if(!singleCard)for(const dx of [0,side])for(const dy of [0,side]){const sx=dx?1:-1,sy=dy?1:-1;page.drawLine({start:{x:x+dx+sx*2,y:y+dy},end:{x:x+dx+sx*5,y:y+dy},thickness:.3,color:rgb(.5,.5,.5)});page.drawLine({start:{x:x+dx,y:y+dy+sy*2},end:{x:x+dx,y:y+dy+sy*5},thickness:.3,color:rgb(.5,.5,.5)});}
  }
 }
 const bytes=await pdf.save();if(bytes.length>20*1024*1024)throw new BingoPreparationError('Das PDF überschreitet 20 MB. Bitte einen kleineren Bereich wählen.');return bytes;
}
