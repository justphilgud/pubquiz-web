import type {ReactNode} from 'react';
import {PHIL_GUD} from '@/app/branding/philGud';
/** Editable trace of the supplied 660×720 silhouette; no added limbs. Original PNGs remain untouched. */
export function Gudi({small=false}:{small?:boolean}){
 return <g transform={`translate(-106 -230) scale(${small?.25:.32})`} data-gudi-rig="original-contour-v1">
  <path fill={PHIL_GUD.colors.pink} d="M221 1Q211-3 201 10L4 265Q-5 281 13 288L223 377 26 478Q9 486 17 505L77 677Q81 695 100 690L319 653 620 716Q636 722 645 706Q653 695 640 684L569 600 658 458Q667 441 651 434L482 358 631 149Q642 131 625 123Z"/>
  <path fill="#fff" opacity=".10" d="M221 1 4 265Q-5 281 13 288L223 377 482 358 631 149Q642 131 625 123Z"/>
  <g fill={PHIL_GUD.colors.black} data-gudi-face="true"><ellipse data-gudi-eye="true" cx="224" cy="214" rx="42" ry="41"/><path d="M339 242Q408 177 479 242Q484 249 476 257L456 274Q450 278 446 270Q409 236 365 270Q359 279 353 271L338 255Q331 249 339 242Z"/></g>
 </g>;
}
const paper=PHIL_GUD.colors.paper,ink=PHIL_GUD.colors.ink;
const many=(n:number,fn:(i:number)=>ReactNode)=>Array.from({length:n},(_,i)=><g key={i}>{fn(i)}</g>);
export const PROP_NAMES=['wrench','bolt','plate','podium','tandem','hoop','four','hand','cup','boot','coaster','pins9','pins10','pins8','pin','goal','table','umbrella','bird','flower','chairs','hourglass','chess','cards','car','cone','skate','hat','swans','pillow','cap','calendar','door','cake','slice','mixer','cube','paper','spring','sign','brush','foam','record','smallballs','bowl','projector','film','roulette','thermometer','shoe','candles','toolbox','lid','loader','answerbox','mirror','terminal','receipt','sofa','bench','bottle','family','parcel','bow','train','flag','drum','ticket','glass','ufo','beam','suitcase','modem','cable','ketchup','drop','laundry','sock','toaster','clock','curtain','snail','deckchair','king','egg','tail','route','glasses','snowman','disco','can','plant','coffee','plane','broom','cannon','confetti','ribbon'] as const;
export function Prop({name,number}:{name:string;number:number}){
 const common={stroke:ink,strokeWidth:5,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
 const pink=PHIL_GUD.colors.pink,accent='var(--gudi-accent)',second='var(--gudi-secondary)';
 let shape:ReactNode;
 switch(name){
 case 'wrench':shape=<path d="M-12 0V-90q-45-15-23-55l23 25 25-20-25-25q55-12 57 40L15-90V0Z" fill={paper}/>;break;
 case 'bolt':shape=<><path d="m-15-9 15-9 15 9v18l-15 9-15-9Z" fill={paper}/><path d="M-9 0H9"/></>;break;
 case 'plate':shape=<><ellipse cy="-6" rx="95" ry="15" fill={paper}/><ellipse cy="-8" rx="65" ry="7" fill="none" stroke={ink} strokeWidth="2"/><path d="M-118-45v55m-10-55v20h20v-20M120-45v55" stroke={paper} fill="none"/></>;break;
 case 'podium':shape=<><path fill={accent} d="M-130 0V-75H-45V-135H45V-75H130V0Z"/><path d="M-45-75V0M45-75V0"/><path d="m-20-109 20-9v70" fill="none"/></>;break;
 case 'tandem':shape=<><circle cx="-140" cy="-45" r="48" fill={paper}/><circle cx="140" cy="-45" r="48" fill={paper}/><path d="m-140-45 50-80 70 80h90l-65-80H-90l-50 80H-20l25-80 65 80 70-80v-30" fill="none" strokeWidth="9" stroke={second}/><path data-tandem-seat="true" d="M-105-132h40"/><path d="M-8-132h40M140-155h-26"/></>;break;
 case 'hoop':shape=<><path d="M0 0v-300H-85" fill="none" strokeWidth="12"/><rect x="-120" y="-330" width="110" height="90" rx="10" fill={paper}/><path d="M-145-230h100l-25 75h-50Z" fill="none"/><ellipse cx="-95" cy="-235" rx="53" ry="12" fill={second}/><path d="m-136-222 56 65m-29-65 28 65m-45-65 17 65m13-65-20 65" fill="none" strokeWidth="2"/></>;break;
 case 'four':shape=<><rect x="-130" y="-240" width="260" height="230" rx="15" fill={accent}/>{many(4,i=><g>{many(3,j=><circle cx={-90+i*60} cy={-195+j*65} r="23" fill={j===2&&i<3?second:paper}/>)}</g>)}<path d="M-145 0H145" strokeWidth="14"/></>;break;
 case 'hand':shape=<path fill={pink} d="M-38 0v-65c-60-35-68-55-50-61l35 22v-88q12-16 23 0v67-106q12-17 24 0v101-112q13-14 25 0v113-87q14-18 26 0v114l23-40q24-10 27 13l-27 75-34 31v28Z"/>;break;
 case 'cup':shape=<><path fill={second} d="m-95-165 28 165H67L95-165Z"/><ellipse cy="-165" rx="95" ry="25" fill={paper}/><path d="M-50-120 5-65M50-120-5-65" opacity=".2"/></>;break;
 case 'boot':shape=<path fill={accent} d="M-90-180H15L30-60q120-10 135 35V0H-95Z"/>;break;
 case 'coaster':shape=<><path d="M-300 0Q-170-250-35-110T300-80" fill="none" strokeWidth="10"/><path d="M-210-105V0M-120-155V0M0-90V0M110-80V0M230-80V0" strokeWidth="4"/></>;break;
 case 'pins9':case 'pins10':case 'pins8':case 'pin':shape=<>{many(name==='pin'?1:name==='pins8'?8:name==='pins9'?9:10,i=>{const row=Math.floor(Math.sqrt(i));const x=(i-row*row)*24-row*24;return <g transform={`translate(${x} ${-row*22})`}><path d="M-12 0q-16-20 0-44v-18q-10-23 8-27 18 4 8 27v18Q28-20 12 0Z" fill={paper}/><path d="M-9-53H9" stroke={second} strokeWidth="8"/></g>;})}</>;break;
 case 'goal':shape=<><path d="M-110 0V-240H110V0" fill="none" strokeWidth="14" stroke={paper}/>{many(7,i=><path d={`M${-100+i*33}-230V0M-100 ${-230+i*33}H100`} stroke={paper} strokeWidth="2" opacity=".6"/>)}</>;break;
 case 'table':case 'bench':shape=<><rect x="-140" y={name==='table'?-135:-65} width="280" height="24" rx="8" fill={second}/><path d={name==='table'?'M-110-111V0M110-111V0':'M-110-41V0M110-41V0'} stroke={paper} strokeWidth="12"/></>;break;
 case 'umbrella':shape=<><path d="M0 0v-170q-90 0-120-20Q-70-320 0-310q70-10 120 120-40 20-120 20" fill={accent}/><path d="M0-310q-55 60-60 130M0-310q55 60 60 130" fill="none"/><path d="M0-170V-10q0 30 30 10" fill="none" stroke={paper}/></>;break;
 case 'bird':shape=<><path d="M-60-35q35-80 80-10l35 10-35 12Q-10 30-60-35Z" fill={paper}/><circle cx="12" cy="-40" r="4"/><path d="M-40-40-5-5M-65-30-90-60"/></>;break;
 case 'flower':shape=<><path d="M0 0v-160" stroke={paper} strokeWidth="8"/>{many(6,i=><ellipse cx="0" cy="-200" rx="35" ry="65" transform={`rotate(${i*60} 0 -160)`} fill={pink}/>)}<circle cy="-160" r="30" fill={accent}/></>;break;
 case 'chairs':case 'sofa':shape=<><rect x="-165" y="-115" width="330" height="95" rx="24" fill={second}/><rect x="-175" y="-70" width="350" height="55" rx="20" fill={pink}/>{many(4,i=><path d={`M${-150+i*80}-90v65`} opacity=".4"/>)}<path d="M-150-10V0M150-10V0" stroke={paper} strokeWidth="12"/></>;break;
 case 'hourglass':shape=<><path d="M-70-200q0 80 60 100-60 30-60 100H70q0-70-60-100 60-20 60-100Z" fill={paper}/><path d="m-48-160 48 60 48-60ZM-50-10 0-70 50-10Z" fill={accent}/><path d="M0-100v30" stroke={accent}/></>;break;
 case 'chess':shape=<>{many(8,i=><g>{many(8,j=><path d={`M${-160+i*40} ${-10-j*25}h40l15-25h-40Z`} fill={(i+j)%2?ink:paper}/>)}</g>)}{many(16,i=><g transform={`translate(${-140+(i%8)*40} ${-90-Math.floor(i/8)*50})`}><circle cy="-37" r="14" fill={second}/><path d="M-10-25-20 0H20L10-25Z" fill={second}/></g>)}</>;break;
 case 'cards':shape=<>{many(5,i=><g transform={`rotate(${i*16-32} 0 0)`}><rect x="-42" y="-155" width="84" height="150" rx="10" fill={paper}/><path d="M0-115-22-82 0-50 22-82Z" fill={i%2?pink:ink}/></g>)}</>;break;
 case 'car':shape=<><path fill={accent} d="M-155-80h55l30-60H55l65 60h40V-20h-315Z"/><path fill={paper} d="m-50-130-23 50H77l-35-50Z"/><circle cx="-95" cy="-20" r="30" fill={ink} stroke={paper}/><circle cx="95" cy="-20" r="30" fill={ink} stroke={paper}/></>;break;
 case 'cone':shape=<><path d="m-40 0 25-100h30L40 0Z" fill={accent}/><path d="M-25-40H25M-20-60H20" stroke={paper} strokeWidth="12"/></>;break;
 case 'skate':shape=<><path d="M-100-35q-25 5-40-20m40 20H100q30-5 40-20" fill="none" stroke={second} strokeWidth="12"/><circle cx="-80" cy="-12" r="14" fill={paper}/><circle cx="80" cy="-12" r="14" fill={paper}/></>;break;
 case 'hat':shape=<><path d="M-65-10v-100H65V-10" fill={ink} stroke={paper}/><ellipse cy="-10" rx="100" ry="14" fill={ink} stroke={paper}/><path d="M-62-35H62" stroke={pink} strokeWidth="16"/></>;break;
 case 'swans':shape=<>{[-1,1].map(side=><g key={side} transform={`translate(${side*70} 0) scale(${side} 1)`}><path d="M-60-20Q-100 30-5 0q65-25 20-55-60-30-10-65 40-10 20 20" fill={paper}/><path d="M23-108 45-100 25-95" fill={accent}/></g>)}</>;break;
 case 'pillow':shape=<path fill={paper} d="M-120-80q120-30 240 0-20 35 0 70-120 30-240 0 20-35 0-70Z"/>;break;
 case 'cap':shape=<><path d="M-70 0Q-50-120 80-90L20-25Z" fill={second}/><circle cx="80" cy="-90" r="20" fill={paper}/><path d="M-75 0H25" stroke={paper} strokeWidth="15"/></>;break;
 case 'calendar':shape=<><rect x="-130" y="-230" width="260" height="230" rx="12" fill={paper}/><path d="M-125-170H125" stroke={second} strokeWidth="60"/>{many(4,i=><g>{many(number===24?6:7,j=><rect x={-108+j*(number===24?36:32)} y={-125+i*30} width="25" height="17" rx="3" fill={(i+j)%4===0?second:ink} opacity=".65"/>)}</g>)}</>;break;
 case 'door':shape=<><rect x="-130" y="-260" width="260" height="260" rx="8" fill={second}/><rect x="-90" y="-230" width="180" height="230" rx="5" fill={paper}/><circle cx="60" cy="-110" r="8" fill={ink}/></>;break;
 case 'cake':case 'slice':shape=<><path d={name==='cake'?'M-130-85Q0-145 130-85V-20Q0 40-130-20Z':'M-90-80 100-120 70-15-90 0Z'} fill={pink}/><path d={name==='cake'?'M-130-85Q0-145 130-85Q0-25-130-85Z':'M-90-80 100-120 70-45Z'} fill={paper}/><path d="M-115-45Q0 0 110-45" fill="none" stroke={second} strokeWidth="12"/></>;break;
 case 'mixer':shape=<><path d="M-65-200H65L45-65H-45Z" fill={paper}/><rect x="-75" y="-65" width="150" height="65" rx="14" fill={second}/><path d="M-80-205H80" strokeWidth="15"/><circle cy="-35" r="14" fill={accent}/><path d="m-30-130 15-30 15 30m-15-12h15M30-170v45h20" fill="none"/></>;break;
 case 'cube':shape=<><path d="M-90-150 30-210 130-145 10-85Z" fill={accent}/><path d="M-90-150V-30L10 30V-85Z" fill={pink}/><path d="M10-85 130-145V-25L10 30Z" fill={paper}/>{many(2,i=><path d={`M${-55+i*35} ${-170-i*18}l100 65v120M-90 ${-110+i*40}l100 65 120-60M${-50+i*35} ${-128+i*22}v120`} fill="none" strokeWidth="3"/>)}</>;break;
 case 'paper':case 'receipt':case 'ticket':shape=<><path d={name==='ticket'?'M-70-55H70v55H-70Z':'M-70-180H70v170l-14 10-14-10-14 10-14-10-14 10-14-10-14 10-14-10-14 10-14-10Z'} fill={paper}/>{many(name==='ticket'?1:5,i=><path d={`M-45 ${-35-i*28}H45`} opacity=".35"/>)}</>;break;
 case 'spring':shape=<path d="M-55 0 55-20-55-40 55-60-55-80 55-100-55-120" fill="none" stroke={paper} strokeWidth="9"/>;break;
 case 'sign':case 'route':shape=<><path d="M0 0v-240" stroke={paper} strokeWidth="12"/>{name==='route'?<path d="M-65-220v-95l65 15 65-15v95q-65 70-130 0Z" fill={paper}/>:<circle cy="-270" r="70" fill={paper} stroke={second} strokeWidth="13"/>}<text y="-270" textAnchor="middle" dominantBaseline="central" fontFamily="Arial, sans-serif" fontSize="54" fontWeight="800" fill={ink} stroke="none">{number}</text></>;break;
 case 'brush':shape=<><path d="M-150-22H85" stroke={paper} strokeWidth="24"/><rect x="70" y="-60" width="100" height="55" rx="10" fill={pink}/>{many(6,i=><path d={`M${80+i*16}-60v-25`} stroke={paper}/>)}</>;break;
 case 'foam':shape=<>{many(5,i=><circle cx={(i-2)*20} cy={-10-(i%2)*15} r="24" fill={paper} stroke="none"/>)}</>;break;
 case 'record':case 'roulette':shape=<><ellipse cy="-25" rx="145" ry="90" fill={name==='record'?ink:second} stroke={paper}/>{many(name==='record'?5:16,i=>name==='record'?<ellipse cy="-25" rx={135-i*18} ry={80-i*12} fill="none" strokeWidth="1"/>:<path d={`M0-25l${Math.cos(i*Math.PI/8)*140} ${Math.sin(i*Math.PI/8)*85}`} stroke={paper}/>)}<ellipse cy="-25" rx="30" ry="20" fill={accent}/></>;break;
 case 'smallballs':shape=<>{many(3,i=><circle cx={(i-1)*65} cy={i===1?-140:-70} r="26" fill={i%2?pink:accent}/>)}</>;break;
 case 'bowl':shape=<path d="M-100-80Q-100 30 0 0 100 30 100-80Z" fill={second}/>;break;
 case 'projector':shape=<><rect x="-80" y="-160" width="160" height="130" rx="15" fill={second}/><circle cx="-70" cy="-205" r="60" fill={paper}/><circle cx="55" cy="-205" r="60" fill={paper}/><path d="M80-125 130-145v80L80-90M-35-30-70 0M35-30 70 0" fill={ink}/>{many(5,i=><circle cx={-70+Math.cos(i*1.26)*32} cy={-205+Math.sin(i*1.26)*32} r="10" fill={ink}/>)}</>;break;
 case 'film':shape=<><path d="M-140-20q-30-90 80-120T140-20" fill="none" stroke={paper} strokeWidth="30"/><path d="M-140-20q-30-90 80-120T140-20" fill="none" stroke={ink} strokeWidth="10" strokeDasharray="15 12"/></>;break;
 case 'thermometer':shape=<><path d="M-15-170v130a30 30 0 1 0 30 0v-130a15 15 0 0 0-30 0Z" fill={paper}/><circle cy="-15" r="17" fill={second}/><path d="M0-25v-100" stroke={second} strokeWidth="12"/>{many(4,i=><path d={`M20 ${-50-i*25}h15`}/>)}</>;break;
 case 'shoe':shape=<path d="M-100-80q60 45 100-20l55 45q100 0 110 40V0H-120Z" fill={accent}/>;break;
 case 'candles':shape=<>{many(7,i=><g transform={`translate(${(i-3)*30} 0)`}><rect x="-7" y={-100-i%2*20} width="14" height={100+i%2*20} fill={paper}/><path d={`M-5 ${-112-i%2*20}q-10-18 5-30 15 18 5 30Z`} fill={accent} stroke="none"/></g>)}</>;break;
 case 'toolbox':case 'answerbox':case 'parcel':shape=<><rect x="-110" y="-150" width="220" height="150" rx={name==='toolbox'?15:3} fill={second}/>{name==='parcel'?<path d="M0-150V0M-110-75H110" stroke={paper} strokeWidth="20"/>:<rect x="-30" y="-170" width="60" height="30" rx="7" fill={paper}/>}<path d="M-105-100H105" opacity=".4"/></>;break;
 case 'lid':shape=<rect x="-115" y="-24" width="230" height="25" rx="6" fill={paper}/>;break;
 case 'loader':shape=<>{many(6,i=><circle data-loading-dot={i} cx={-100+i*40} cy="-20" r="12" fill={i<3?accent:paper} opacity={i<3?1:.3}/>)}</>;break;
 case 'mirror':shape=<><ellipse cy="-110" rx="85" ry="110" fill={paper} stroke={accent} strokeWidth="12"/><path d="m-45-80 65-80M-20-50l65-80" opacity=".4"/><path d="M0 0v30m-55 0H55" stroke={paper}/></>;break;
 case 'terminal':case 'modem':shape=<><rect x="-115" y={name==='terminal'?-160:-70} width="230" height={name==='terminal'?145:65} rx="12" fill={paper}/>{name==='terminal'?<><rect x="-100" y="-145" width="200" height="95" rx="6" fill={ink}/><path d="m-70-120 20 15-20 15m40 0h40" stroke={accent} fill="none"/><path d="m-125-15-20 15h290l-20-15" fill={second}/></>:many(5,i=><circle data-modem-light={i} cx={-75+i*35} cy="-40" r="6" fill={i<2?accent:ink}/>)}</>;break;
 case 'bottle':case 'ketchup':shape=<><path d="M-22-160h44v35l25 25V0H-47v-100l25-25Z" fill={name==='ketchup'?second:paper}/><rect x="-25" y="-180" width="50" height="25" rx="5" fill={accent}/><rect x="-35" y="-85" width="70" height="45" rx="10" fill={paper}/>{name==='ketchup'&&<><circle cy="-63" r="15" fill="#C73538" stroke="none"/><path d="M-10-75 0-82 10-75" fill="none" stroke={ink} strokeWidth="3"/></>}</>;break;
 case 'family':shape=<>{[-80,80].map(x=><g key={x} transform={`translate(${x} 0) scale(.5)`}><Gudi/></g>)}</>;break;
 case 'bow':shape=<path d="M0-20q-110-100-90-10 10 65 90 10 80 75 90-10 20-90-90 10L-35 70 0 45 35 70Z" fill={pink}/>;break;
 case 'train':shape=<><path d="M-170-130H-30V-50H140V-10H-180Z" fill={accent}/><rect x="-135" y="-110" width="65" height="60" fill={paper}/><path d="M75-50v-70H100v70" fill={second}/>{many(4,i=><circle cx={-140+i*80} cy="-5" r="24" fill={ink} stroke={paper}/>)}</>;break;
 case 'flag':shape=<><path d="M0 0v-170" stroke={paper}/><path d="M0-170h100l-35 45 35 45H0Z" fill={pink}/></>;break;
 case 'drum':shape=<><ellipse cy="-105" rx="125" ry="85" fill={paper}/><path d="M-110-135 90-155M-100-90 100-110M-70-35 90-65M-80-160-70-40M-20-185-15-23M45-180 50-38" fill="none" stroke={second} strokeWidth="8"/><path d="M-75-35-95 0M75-35 95 0" stroke={paper}/></>;break;
 case 'glass':shape=<><path d="M-90-220-65 0H65L90-220Z" fill={paper} fillOpacity=".2" stroke={paper}/><path data-water="true" d="m-75-100 10 100H65l10-100Z" fill={accent} opacity=".6"/><path d="M-58-190-45-50" stroke={paper}/></>;break;
 case 'ufo':shape=<><path d="M-70-25q0-110 70-110T70-25" fill={pink}/><ellipse cy="-25" rx="150" ry="35" fill={paper}/>{many(5,i=><circle cx={-100+i*50} cy="-20" r="9" fill={accent}/>)}</>;break;
 case 'beam':shape=<path d="M-35-240 140 0H-140L35-240Z" fill={accent} fillOpacity=".22" stroke="none"/>;break;
 case 'suitcase':shape=<><rect x="-80" y="-155" width="160" height="140" rx="18" fill={second}/><path d="M-30-155v-45h60v45M-50-125v85M0-125v85M50-125v85" fill="none" stroke={paper}/><circle cx="-55" cy="-8" r="10" fill={paper}/><circle cx="55" cy="-8" r="10" fill={paper}/></>;break;
 case 'cable':shape=<path d="M-170 0q30-90 90-30T80-60q60-80 90-10" fill="none" stroke={paper} strokeWidth="9"/>;break;
 case 'drop':shape=<path d="M0-45Q-45 10 0 0 45 10 0-45Z" fill={second}/>;break;
 case 'laundry':shape=<><path d="M-130-125-100 0H100l30-125Z" fill={paper}/>{many(6,i=><path d={`M${-90+i*35}-100v80`} stroke={second} strokeWidth="10"/>)}</>;break;
 case 'sock':shape=<path d="M-30-145H25v80l65 25q35 60-35 45L-40-30q-25-20-10-55Z" fill={pink}/>;break;
 case 'toaster':shape=<><rect x="-120" y="-130" width="240" height="130" rx="30" fill={paper}/><ellipse cy="-130" rx="80" ry="14" fill={ink}/><path d="M120-95h35v45" fill="none" stroke={second} strokeWidth="12"/><circle cx="80" cy="-40" r="15" fill={accent}/></>;break;
 case 'clock':shape=<><circle cy="-155" r="145" fill={paper}/>{many(12,i=><path d={`M${Math.sin(i*Math.PI/6)*110} ${-155-Math.cos(i*Math.PI/6)*110}l${Math.sin(i*Math.PI/6)*15} ${-Math.cos(i*Math.PI/6)*15}`}/>)}<path data-clock-hand="true" d="M0-245v90l70 20" stroke={ink} strokeWidth="10" fill="none"/></>;break;
 case 'curtain':shape=<><path d="M-175 0v-300h350V0l-40-20-40 20-40-20-40 20-40-20-40 20-40-20Z" fill={second}/>{many(7,i=><path d={`M${-140+i*45}-285V-25`} opacity=".25"/>)}</>;break;
 case 'snail':shape=<><path d="M-80-20Q0-80 100-30l40 30H-90Z" fill={pink}/><circle cx="-25" cy="-60" r="55" fill={accent}/><path d="M-35-70q40-30 45 10-15 40-45 10" fill="none"/><path d="M90-30v-55m10 0 20 45"/><circle cx="90" cy="-90" r="6" fill={paper}/></>;break;
 case 'deckchair':shape=<><path d="m-110-180 190 180m20-100L-100 0" stroke={paper} strokeWidth="12"/><path d="m-100-170 55 110 120 20 40-30-120-35-35-65Z" fill={pink}/></>;break;
 case 'king':shape=<><path d="M-40 0-15-50-25-130H25L15-50 40 0ZM-30-150l-10-40 30 20 10-40 10 40 30-20-10 40Z" fill={accent}/></>;break;
 case 'egg':shape=<path d="M0-240C-140-230-140 10 0 0 140 10 140-230 0-240Z" fill={paper}/>;break;
 case 'tail':shape=<path d="M-85 0Q-15-20 0-140q55 150 110 140Z" fill={second}/>;break;
 case 'glasses':shape=<><path d="M-90-35h70l15 35h-70ZM20-35h70L75 0H35Z" fill={ink} stroke={paper}/><path d="M-10-25H25" stroke={ink} strokeWidth="10"/></>;break;
 case 'snowman':shape=<><circle cy="-70" r="70" fill={paper}/><circle cy="-175" r="48" fill={paper}/><circle cx="-14" cy="-180" r="5"/><circle cx="14" cy="-180" r="5"/><path d="m0-170 50 10-50 4" fill={accent}/><path d="M-30-130H35" stroke={pink} strokeWidth="16"/></>;break;
 case 'disco':shape=<><path d="M0-210V-110" stroke={paper}/><circle cy="-60" r="75" fill={paper}/>{many(5,i=><path d={`M${-60+i*30}-105v90M-60 ${-110+i*25}H60`} stroke={second} strokeWidth="3"/>)}</>;break;
 case 'can':shape=<><path d="M-65-110H55V0H-65Z" fill={accent}/><path d="M55-80 130-140l20 30L55-25M-65-90q-110-50-65 50l65 20" fill="none" stroke={paper} strokeWidth="15"/></>;break;
 case 'plant':shape=<><path d="M-45-70H45L30 0H-30Z" fill={paper}/><path d="M0-70v-220q-100 0-65 50 50 20 65-50 100-45 90 15-50 45-90-15" fill={second} stroke={second}/></>;break;
 case 'coffee':shape=<><path d="M-65-110H65v80q-65 70-130 0Z" fill={paper}/><path d="M65-90q100-20 40 70H65" fill="none" stroke={paper} strokeWidth="12"/><ellipse cy="-110" rx="65" ry="15" fill={ink}/><path d="M-20-140q-20-25 0-45M20-140q-20-25 0-45" fill="none" stroke={paper} opacity=".6"/></>;break;
 case 'plane':shape=<><path d="m-150-90 310-70L-25 0l-20-60Z" fill={paper}/><path d="M-45-60 160-160-5-45-25 0" fill={accent}/></>;break;
 case 'broom':shape=<><path d="M0-250V-65" stroke={paper} strokeWidth="13"/><path d="M-35-65H35L65 0H-65Z" fill={accent}/><path d="M-25-50-35 0M0-50V0M25-50 35 0"/></>;break;
 case 'cannon':shape=<><path d="m-90 0 45-160 80 25L-5 30Z" fill={pink}/><ellipse cx="-5" cy="-150" rx="42" ry="15" transform="rotate(17 -5 -150)" fill={ink}/></>;break;
 case 'confetti':shape=<>{many(18,i=><rect x={Math.sin(i*2.4)*220} y={-20-(i%6)*65} width="12" height="24" rx="2" fill={i%2?pink:accent} transform={`rotate(${i*35} ${Math.sin(i*2.4)*220} ${-20-(i%6)*65})`} stroke="none"/>)}</>;break;
 case 'ribbon':shape=<path d="M-90-40q140-90 80 0-35 70 35 35 85-65 65-5" fill="none" stroke={pink} strokeWidth="12"/>;break;
 default:throw Error(`UNKNOWN_SCENE_PROP:${name}`);
 }
 return <g {...common} data-gudi-prop={name}>{shape}</g>;
}
