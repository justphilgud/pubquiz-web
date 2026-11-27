export const CEREMONY_SLIDES = [
  {id:'waiting',label:'Wartebildschirm',phase:'INTRO'},
  {id:'countdown',label:'Countdown',phase:'INTRO'},
  {id:'welcome',label:'Begrüßung',phase:'INTRO'},
  {id:'prizes',label:'Preise',phase:'INTRO'},
  {id:'rules',label:'Regeln',phase:'INTRO'},
  {id:'raffle',label:'Abschlussverlosung',phase:'OUTRO'},
  {id:'announcements',label:'Bekanntmachungen',phase:'OUTRO'},
  {id:'questionSubmission',label:'Frage einreichen',phase:'OUTRO'},
  {id:'calendar',label:'Kalender',phase:'OUTRO'},
  {id:'booking',label:'Buchung und Kontakt',phase:'OUTRO'},
] as const;
export type CeremonySlideId=typeof CEREMONY_SLIDES[number]['id'];
export type CeremonyConfig={outro?:CeremonyConfig;insertions?:Record<string,CeremonyConfig>;version:1;enabled:CeremonySlideId[];waiting:string;startsAt:string;welcome:string;rules:string;prizes:string[];announcements:string;mainPrize:string;introVideoUrl?:string;introMusicUrl?:string;outroMusicUrl?:string};
export type CeremonyState={placement?:string;revision:number;config:CeremonyConfig;slide:CeremonySlideId|null;revealCount:number;raffleNumber:number|null;runId:string|null;raffleRevealCount?:number;media?:{action:'play'|'pause'|'stop';commandId:number}};
export function defaultCeremony():CeremonyState{return {revision:0,config:{version:1,enabled:CEREMONY_SLIDES.map(s=>s.id),waiting:'Schön, dass ihr da seid!',startsAt:'',welcome:'Willkommen zum Bingoabend',rules:'Zahlen markieren. Bei einer vollständigen Reihe, Spalte oder Diagonale laut Bingo rufen. Gewinne werden von der Moderation geprüft.',prizes:[],announcements:'Danke fürs Mitspielen!',mainPrize:'Gutschein für das LOVD'},slide:'waiting',revealCount:0,raffleNumber:null,runId:null};}
export function parseCeremonyConfig(value:unknown):CeremonyConfig{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_CEREMONY');
  const c=value as CeremonyConfig;
  const mediaKeys=['introVideoUrl','introMusicUrl','outroMusicUrl'] as const;
  const expected=('announcements,enabled,mainPrize,prizes,rules,startsAt,version,waiting,welcome'+(Object.hasOwn(c,'outro')?',outro':'')+(Object.hasOwn(c,'insertions')?',insertions':'')+mediaKeys.filter(k=>Object.hasOwn(c,k)).map(k=>','+k).join('')).split(',').sort().join();
  if(Object.keys(c).sort().join()!==expected||c.version!==1||!Array.isArray(c.enabled)||new Set(c.enabled).size!==c.enabled.length||c.enabled.some(id=>!CEREMONY_SLIDES.some(s=>s.id===id))||!Array.isArray(c.prizes)||c.prizes.length>20||c.prizes.some(p=>typeof p!=='string'||p.length>300))throw Error('INVALID_CEREMONY');
  for(const key of mediaKeys){const ref=c[key];if(ref!==undefined&&(typeof ref!=='string'||ref.length>2000||ref!==''&&!/^\/(?!\/)[^\s\\]*$|^https:\/\/[^\s]+$/i.test(ref)))throw Error('INVALID_CEREMONY');}
  for(const key of ['waiting','welcome','rules','announcements','mainPrize'] as const)if(typeof c[key]!=='string'||c[key].length>4000)throw Error('INVALID_CEREMONY');
  if(typeof c.startsAt!=='string'||c.startsAt!==''&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(c.startsAt)||!Number.isFinite(Date.parse(c.startsAt))))throw Error('INVALID_CEREMONY');
  if(c.insertions!==undefined){
    if(!c.insertions||typeof c.insertions!=='object'||Array.isArray(c.insertions)||Object.keys(c.insertions).length>100)throw Error('INVALID_CEREMONY');
    for(const [key,config] of Object.entries(c.insertions)){if(!/^[a-f0-9-]{36}$/i.test(key)||!config||(Object.hasOwn(config,'insertions')||Object.hasOwn(config,'outro')))throw Error('INVALID_CEREMONY');parseCeremonyConfig(config);}
  }
  if(c.outro!==undefined){if(!c.outro||Object.hasOwn(c.outro,'insertions')||Object.hasOwn(c.outro,'outro'))throw Error('INVALID_CEREMONY');parseCeremonyConfig(c.outro);}
  return structuredClone(c);
}
export function parseCeremony(value:unknown):CeremonyState{
  if(value===null||value===undefined)return defaultCeremony();
  if(typeof value!=='object'||Array.isArray(value))throw Error('INVALID_CEREMONY');
  const s=value as CeremonyState;
  if(Object.keys(s).sort().join()!==('config,raffleNumber,revealCount,revision,runId,slide'+(s.media?',media':'')+(Object.hasOwn(s,'placement')?',placement':'')+(Object.hasOwn(s,'raffleRevealCount')?',raffleRevealCount':'')).split(',').sort().join()||!Number.isSafeInteger(s.revision)||s.revision<0||!Number.isInteger(s.revealCount)||s.revealCount<0||s.revealCount>20||s.slide!==null&&!CEREMONY_SLIDES.some(slide=>slide.id===s.slide)||s.raffleNumber!==null&&(!Number.isSafeInteger(s.raffleNumber)||s.raffleNumber<1)||s.runId!==null&&(typeof s.runId!=='string'||!/^[a-f0-9-]{36}$/i.test(s.runId)))throw Error('INVALID_CEREMONY');
  if(Object.hasOwn(s,'raffleRevealCount')&&(!Number.isInteger(s.raffleRevealCount)||Number(s.raffleRevealCount)<0||Number(s.raffleRevealCount)>3))throw Error('INVALID_CEREMONY');
  if(s.media&&(typeof s.media!=='object'||Object.keys(s.media).sort().join()!=='action,commandId'||!['play','pause','stop'].includes(s.media.action)||!Number.isSafeInteger(s.media.commandId)||s.media.commandId<0))throw Error('INVALID_CEREMONY');
  if(s.placement!==undefined&&s.placement!=='outro'&&(!/^[a-f0-9-]{36}$/i.test(s.placement)||!s.config.insertions?.[s.placement]))throw Error('INVALID_CEREMONY');
  return {...s,config:parseCeremonyConfig(s.config)};
}

/** Each insertion owns its entire configuration; no inherited mutable defaults. */
export function outroConfig(config:CeremonyConfig):CeremonyConfig {
  if(config.outro)return structuredClone(config.outro);
  const copy=structuredClone(config);delete copy.outro;delete copy.insertions;
  return {...copy,enabled:copy.enabled.filter(id=>CEREMONY_SLIDES.some(s=>s.id===id&&s.phase==='OUTRO'))};
}
export function ceremonyAt(state:CeremonyState):CeremonyState {
  if(state.placement==='outro'||!state.placement&&CEREMONY_SLIDES.some(s=>s.id===state.slide&&s.phase==='OUTRO'))return {...state,config:outroConfig(state.config)};
  return state.placement?{...state,config:state.config.insertions![state.placement]}:state;
}
