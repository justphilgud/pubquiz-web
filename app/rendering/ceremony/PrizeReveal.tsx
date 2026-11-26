import {prizeRevealOrder} from './prizeSequence';
export function PrizeReveal({prizes,revealCount}:{prizes:readonly string[];revealCount:number}){
  const order=prizeRevealOrder(prizes);
  return <div className="ceremony-prizes" aria-live="polite">{order.length?order.map((prize,index)=><div className="ceremony-prize" key={prize.place} data-revealed={index<revealCount}><strong>Platz {prize.place}</strong><span>{index<revealCount?prize.text:'Wird gleich aufgedeckt …'}</span></div>):<p>Die Preise werden live vorgestellt.</p>}</div>;
}
