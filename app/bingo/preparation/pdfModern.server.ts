import 'server-only';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix, type PDFPage, type PDFFont, type PDFImage } from 'pdf-lib';
import { randomBytes } from 'node:crypto';
import { parsePrintSnapshot, type EmbeddedAsset, type PrintSnapshot } from './printSnapshot';
import { regularFace, glyphGeometry, type PrintMode } from './pdfSquare.server';
import { geometry, position } from './printFormats';
import { decodeCard, MAX_EXPORT, BingoPreparationError, type StoredCard } from './policy';
import { termFor, usesCardText } from './termSet';
type Face=ReturnType<typeof fontkit.create>;
type Font={face:Face;font:PDFFont};
const ink=(hex:string)=>rgb(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255) as [number,number,number]);
/** Both line breaking and drawing use the actual frozen face, including original outline offsets. */
export function fitTerm(value:string,face:Face,width:number,height:number,initial=14,minimum=10){
  if([...value].length>120)throw new BingoPreparationError('Der Begriff überschreitet 120 Zeichen.');
  if([...value].some(c=>!face.hasGlyphForCodePoint(c.codePointAt(0)!)))throw new BingoPreparationError(`Die Textschrift unterstützt nicht alle Zeichen in „${value}“.`);
  for(const breakLongWords of [false,true]){sizeCandidate:for(let size=initial;size>=minimum;size-=.5){
    const lines:string[]=[];let line='';
    for(const paragraph of value.split('\n')){
      for(const word of paragraph.trim().split(/\s+/)){
        if(!word)continue;
        const next=line?`${line} ${word}`:word;
        if(glyphGeometry(face,next,size).width<=width){line=next;continue;}
        if(line){lines.push(line);line='';}
        if(glyphGeometry(face,word,size).width<=width){line=word;continue;}
        if(!breakLongWords)continue sizeCandidate;
        for(const char of word){if(line&&glyphGeometry(face,line+char,size).width>width){lines.push(line);line='';}line+=char;}
      }
      if(line){lines.push(line);line='';}
    }
    const lineHeight=size*1.2;
    // Full face ascent/descent protects accents and descenders, not just an estimated line count.
    const inkHeight=(face.ascent-face.descent)/face.unitsPerEm*size;
    if(lines.length&&lines.every(line=>glyphGeometry(face,line,size).width<=width)&&inkHeight+(lines.length-1)*lineHeight<=height)return {lines,size,lineHeight,inkHeight};
  }}
  throw new BingoPreparationError(`„${value}“ passt bei mindestens ${minimum} pt nicht in das gewählte Kartenformat. Bitte Begriff kürzen, Schrift oder Format ändern.`);
}
export function draw(page:PDFPage,value:string,f:Font,size:number,x:number,y:number,width:number,color:ReturnType<typeof rgb>,right=false){
  if([...value].some(c=>!f.face.hasGlyphForCodePoint(c.codePointAt(0)!)))throw new BingoPreparationError('Die Druckschrift unterstützt nicht alle Zeichen.');
  const run=glyphGeometry(f.face,value,size);
  if(run.width>width)throw new BingoPreparationError('Der Text passt nicht in das Druckfeld.');
  const left=x+(right?width-run.width:(width-run.width)/2)-run.min;
  page.drawText(value,{font:f.font,size,x:left,y,opacity:0});
  page.pushOperators(pushGraphicsState(),concatTransformationMatrix(1,0,0,-1,0,0));
  for(const g of run.glyphs){const path=g.glyph.path.toSVG();if(path.trim())page.drawSvgPath(path,{x:left+g.x,y:-y-g.y,scale:run.scale,color});}
  page.pushOperators(popGraphicsState());
}
export function logo(page:PDFPage,image:PDFImage,cx:number,cy:number,width:number,height:number){const scale=Math.min(width/image.width,height/image.height);page.drawImage(image,{x:cx-image.width*scale/2,y:cy-image.height*scale/2,width:image.width*scale,height:image.height*scale});}
export function validateModernTerms(input:PrintSnapshot){
 const snap=parsePrintSnapshot(input);if(snap.version!==3||!snap.settings.layout||!snap.terms)return;
 const g=geometry(snap.settings.layout.format),face=regularFace(Buffer.from(snap.text.bytes,'base64')),cell=(g.side-36)/5;
 const limit=snap.settings.layout.format==='A4_SIX'?36:40;
 for(const entry of snap.terms.entries.filter(e=>e.number<=75)){if(!usesCardText(snap.terms,entry.number))continue;const text=termFor(snap.terms,entry.number);if([...text].length>limit)throw new BingoPreparationError(`Kugel ${entry.number}: höchstens ${limit} Zeichen für ${snap.settings.layout.format}. Bitte Begriff kürzen oder Format ändern.`);fitTerm(text,face,cell-6,cell-6);}
}
export async function createModernCardsPdf(input:PrintSnapshot,cards:readonly StoredCard[],mode:PrintMode='front',singleCard=false){
  const snap=parsePrintSnapshot(input);if(snap.version!==3||!snap.settings.layout)throw new BingoPreparationError('Ungültiger V3-Druckstand.');
  if(!cards.length||cards.length>MAX_EXPORT||new Set(cards.map(c=>c.id)).size!==cards.length)throw new BingoPreparationError('Ungültige Kartenmenge für den PDF-Export.');
  for(const card of cards){decodeCard(card.cells);if(!card.shortCode)throw new BingoPreparationError('Die dauerhafte Kartenkennung fehlt.');}
  const g=geometry(snap.settings.layout.format),capacity=singleCard?1:g.capacity,pdf=await PDFDocument.create();
  pdf.setTitle('Bingo-Druckkarten');pdf.setSubject(`${snap.settings.layout.format} · tatsächliche Größe 100 % · Duplex an langer Kante`);
  async function font(asset:EmbeddedAsset):Promise<Font>{const bytes=Buffer.from(asset.bytes,'base64'),face=regularFace(bytes);pdf.registerFontkit({create:()=>face});return {face,font:await pdf.embedFont(bytes,{subset:true,customName:`${randomBytes(6).toString('hex')}Bingo`})};}
  const heading=await font(snap.display),numbers=await font(snap.body),words=await font(snap.text),front=await pdf.embedPng(Buffer.from(snap.logo.bytes,'base64')),backs=await Promise.all(snap.backLogos.map(a=>pdf.embedPng(Buffer.from(a.bytes,'base64')))),colors=snap.settings.colors;
  // Validate every mapped term, not only the random subset present in this PDF.
  const cell=(g.side-36)/5;
  validateModernTerms(snap);
  for(let offset=0;offset<cards.length;offset+=capacity)for(const back of mode==='duplex'?[false,true]:[mode==='back']){
    const page=pdf.addPage(singleCard?[g.side,g.side]:[g.width,g.height]);
    for(let slot=0;slot<capacity&&offset+slot<cards.length;slot++){
      const card=cards[offset+slot],{x,y,side}=singleCard?{x:0,y:0,side:g.side}:position(snap.settings.layout.format,slot,back);
      page.drawRectangle({x,y,width:side,height:side,color:ink(back?colors.back:colors.background)});
      if(back){
        backs.forEach((image,i)=>logo(page,image,x+side/2,y+side/2+(backs.length===2?(i===0?side*.19:-side*.19):0),side-40,backs.length===2?side*.28:side-55));
        // A quiet white label ensures contrast against every permitted back colour/logo.
        page.drawRectangle({x:x+side-75,y:y+6,width:69,height:15,color:rgb(1,1,1)});
        draw(page,card.shortCode!,numbers,8,x+side-72,y+10,63,rgb(.08,.08,.08),true);
      }else{
        const gx=x+18,gy=y+14,header=23;
        for(let row=0;row<6;row++)for(let col=0;col<5;col++){
          const cx=gx+col*cell,cy=row===0?gy+5*cell:gy+(5-row)*cell,h=row===0?header:cell,free=row===3&&col===2;
          page.drawRectangle({x:cx,y:cy,width:cell,height:h,color:ink(row===0||free?colors.header:colors.background),borderColor:ink(colors.grid),borderWidth:.5});
          if(free)logo(page,front,cx+cell/2,cy+cell/2,cell-8,cell-8);
          else if(row===0)draw(page,'BINGO'[col],heading,19,cx+2,cy+4,cell-4,ink(colors.heading));
          else if(snap.terms&&usesCardText(snap.terms,card.cells[row-1][col]!)){const term=termFor(snap.terms,card.cells[row-1][col]!),fit=fitTerm(term,words.face,cell-6,cell-6),top=cy+(cell+fit.inkHeight+(fit.lines.length-1)*fit.lineHeight)/2-words.face.ascent/words.face.unitsPerEm*fit.size;fit.lines.forEach((line,i)=>draw(page,line,words,fit.size,cx+3,top-i*fit.lineHeight,cell-6,ink(colors.numbers)));}
          else draw(page,String(card.cells[row-1][col]),numbers,22,cx+3,cy+(cell-22)/2+4,cell-6,ink(colors.numbers));
        }
      }
      if(!singleCard)for(const dx of [0,side])for(const dy of [0,side]){const sx=dx?1:-1,sy=dy?1:-1;page.drawLine({start:{x:x+dx+sx*2,y:y+dy},end:{x:x+dx+sx*5,y:y+dy},thickness:.3,color:rgb(.5,.5,.5)});page.drawLine({start:{x:x+dx,y:y+dy+sy*2},end:{x:x+dx,y:y+dy+sy*5},thickness:.3,color:rgb(.5,.5,.5)});}
    }
  }
  const bytes=await pdf.save();if(bytes.length>20*1024*1024)throw new BingoPreparationError('Das PDF überschreitet 20 MB. Bitte einen kleineren Bereich wählen.');return bytes;
}
