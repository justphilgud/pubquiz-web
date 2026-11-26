/** Format-neutral reveal order. Array index is placement minus one; blank slots keep their rank. */
export function prizeRevealOrder(prizes:readonly string[]){
  return prizes.map((text,index)=>({text:text.trim(),place:index+1})).filter(p=>p.text).reverse();
}
export function visiblePrizes(prizes:readonly string[],count:number){
  return prizeRevealOrder(prizes).slice(0,Math.max(0,Math.floor(count)));
}
export function isPrizeSlide(slide:unknown):boolean{
  if(!slide||typeof slide!=='object')return false;
  const s=slide as {typ?:string;slideTyp?:string;abschnitt?:{abschnitt_typ?:string}|null;element?:{type?:string}};
  return s.typ==='fixer-slide'&&s.slideTyp==='preise'||s.typ==='block'&&s.abschnitt?.abschnitt_typ==='intro_preise'||s.typ==='ablauf'&&s.element?.type==='PRIZES';
}
