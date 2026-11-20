import 'server-only';
import fontkit from '@pdf-lib/fontkit';
import {rgb,pushGraphicsState,popGraphicsState,concatTransformationMatrix,type PDFPage,type PDFFont,type PDFImage} from 'pdf-lib';
import {glyphGeometry} from './pdfSquare.server';
import {BingoPreparationError} from './policy';
export type Font={face:ReturnType<typeof fontkit.create>;font:PDFFont};
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
