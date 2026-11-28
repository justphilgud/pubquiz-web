/** New collective print only. Existing saved layouts retain their own geometry. */
export const CARD_SET_SHEET={width:320,height:450,side:92.5,bleed:3,gap:12,markInset:1,markLength:4,columns:3,rows:4} as const;
export const mmToPt=(mm:number)=>mm*72/25.4;
export function cardSetSlot(slot:number,back=false){
 if(!Number.isInteger(slot)||slot<0||slot>=12)throw Error('INVALID_CARD_SET_SLOT');
 const g=CARD_SET_SHEET,col=back?2-slot%3:slot%3,row=Math.floor(slot/3);
 const x=(g.width-(3*g.side+2*g.gap))/2+col*(g.side+g.gap);
 const y=(g.height-(4*g.side+3*g.gap))/2+(3-row)*(g.side+g.gap);
 return {trim:[x,y,g.side,g.side] as const,bleed:[x-g.bleed,y-g.bleed,g.side+2*g.bleed,g.side+2*g.bleed] as const};
}
/** Guillotine alignment marks: perpendicular to the paper edges, never inside a card's bleed. */
export function cardSetCutMarks(){
 const g=CARD_SET_SHEET,xs=new Set<number>(),ys=new Set<number>();
 for(let i=0;i<12;i++){const {trim:[x,y,w,h]}=cardSetSlot(i);xs.add(x);xs.add(x+w);ys.add(y);ys.add(y+h);}
 return [
  ...[...xs].sort((a,b)=>a-b).flatMap(x=>[
   {start:[x,g.markInset],end:[x,g.markInset+g.markLength]},
   {start:[x,g.height-g.markInset-g.markLength],end:[x,g.height-g.markInset]},
  ]),
  ...[...ys].sort((a,b)=>a-b).flatMap(y=>[
   {start:[g.markInset,y],end:[g.markInset+g.markLength,y]},
   {start:[g.width-g.markInset-g.markLength,y],end:[g.width-g.markInset,y]},
  ]),
 ] as {start:[number,number];end:[number,number]}[];
}
