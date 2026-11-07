export type MatchingRange={from:number;to:number;total:number};
export function matchingRange(value:string|null|undefined,total:number):MatchingRange|null|'invalid'{
 if(!value)return null;
 const match=/^bytes=(\d*)-(\d*)$/.exec(value);if(!match||!match[1]&&!match[2])return 'invalid';
 let from:number,to:number;
 if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<1)return 'invalid';from=Math.max(0,total-suffix);to=total-1;}
 else{from=Number(match[1]);to=match[2]?Number(match[2]):total-1;if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||from>=total||to<from)return 'invalid';to=Math.min(total-1,to);}
 return {from,to,total};
}
