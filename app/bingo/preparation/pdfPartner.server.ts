import 'server-only';
import {rgb,type PDFImage,type PDFPage} from 'pdf-lib';
import {draw,logo,type Font} from './pdfDrawing.server';
import {isWildcardCode} from './bingoPrint';
/** Frozen partner-back contract, shared by new LOVD V3 variants and existing V4. */
export function drawPartnerBack(page:PDFPage,{x,y,side}:{x:number;y:number;side:number},backs:PDFImage[],code:Font,shortCode:string,background:string,lovd=false){
 if(isWildcardCode(shortCode)){
  draw(page,'WILDCARD',code,19,x+14,y+side*.59,side-28,rgb(1,1,1));
  draw(page,'Nur in der letzten Runde',code,9,x+14,y+side*.43,side-28,rgb(1,1,1));
  draw(page,shortCode,code,10,x+14,y+22,side-28,rgb(1,1,1));
  return;
 }
 const l=[1,3,5].map(i=>parseInt(background.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const soft=.406,lightRatio=(soft+.05)/(l+.05),darkRatio=(l+.05)/(.0176+.05);
 const codeInk=lightRatio>=4.5?rgb(.67,.67,.67):darkRatio>=4.5?rgb(.14,.14,.14):l<.179?rgb(1,1,1):rgb(0,0,0);
 if(!lovd)page.drawRectangle({x:x+9,y:y+9,width:side-18,height:side-18,borderColor:codeInk,borderWidth:.25,opacity:.25,borderOpacity:.4});
 if(backs.length===1)logo(page,backs[0],x+side/2,y+side/2+3,side*.68,side*.72);
 else{
  // Restore the smaller LOVD lockup, retaining the current artwork and colours.
  logo(page,backs[0],x+side/2,y+side*(lovd?.79:.75),lovd?side*.40:side*.62,side*.25);
  logo(page,backs[1],x+side/2,y+side*.31,side*.36,side*.37);
  const cx=x+side/2,cy=y+side*.565,r=6;
  for(const direction of [-1,1])page.drawLine({start:{x:cx-r,y:cy-direction*r},end:{x:cx+r,y:cy+direction*r},thickness:.35,color:codeInk});
 }
 draw(page,shortCode,code,6.5,x+14,y+14,side-28,codeInk,true);
}
