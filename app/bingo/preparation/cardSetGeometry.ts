/** New collective print only. Existing saved layouts retain their own geometry. */
export const CARD_SET_SHEET={width:320,height:450,side:92.5,bleed:3,gap:12,columns:3,rows:4,markOffset:4,markLength:1.5} as const;
export const mmToPt=(mm:number)=>mm*72/25.4;
export function cardSetSlot(slot:number,back=false){
 if(!Number.isInteger(slot)||slot<0||slot>=12)throw Error('INVALID_CARD_SET_SLOT');
 const g=CARD_SET_SHEET,col=back?2-slot%3:slot%3,row=Math.floor(slot/3);
 const x=(g.width-(3*g.side+2*g.gap))/2+col*(g.side+g.gap);
 const y=(g.height-(4*g.side+3*g.gap))/2+(3-row)*(g.side+g.gap);
 return {trim:[x,y,g.side,g.side] as const,bleed:[x-g.bleed,y-g.bleed,g.side+2*g.bleed,g.side+2*g.bleed] as const};
}
