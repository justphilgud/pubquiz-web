import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
export type ScreenFrame={data:string;metadata:{timestamp:number};sessionId:number};
type Capture={number:number;brand:string;path:string;at:number};
/** Optional local evidence generation, never used by an application or default CI. */
export async function recordGudiScenes({call,evaluate,setSink,directory,ffmpeg}:{
 call:(method:string,params?:Record<string,unknown>)=>Promise<unknown>;
 evaluate:(expression:string)=>Promise<unknown>;
 setSink:(sink:((frame:ScreenFrame)=>void)|undefined)=>void;
 directory:string;ffmpeg:string;
}){
 const root=resolve(directory),source=join(root,'frames');mkdirSync(source,{recursive:true});
 const frames:Capture[]=[],ends=new Map<string,number>();let number=1,brand='phil-gud',serial=0,minimumTime=Infinity;
 setSink(frame=>{if(frame.metadata.timestamp<minimumTime)return;const path=join(source,`${String(++serial).padStart(6,'0')}.jpg`);writeFileSync(path,Buffer.from(frame.data,'base64'));frames.push({number,brand,path,at:frame.metadata.timestamp});});
 await call('Emulation.setDeviceMetricsOverride',{width:1280,height:600,deviceScaleFactor:1,mobile:false});
 await call('Page.startScreencast',{format:'jpeg',quality:75,maxWidth:1280,maxHeight:600,everyNthFrame:2});
 try{
  for(const style of ['phil-gud','lovd-ungegoogelt']){
   minimumTime=Infinity;brand=style;await evaluate(`window.reset('${style}',{rate:1});document.fonts.ready.then(()=>true)`);
   for(const n of style==='phil-gud'?Array.from({length:75},(_,i)=>i+1):[3,9,24,42,66,75]){
    number=n;minimumTime=await evaluate('Date.now()/1000') as number;await evaluate(`window.publish(${n})`);
    const duration=[3,9,24,42,66,75].includes(n)?5000:4600;
    await new Promise(r=>setTimeout(r,duration+450));
    const end=await evaluate('Date.now()/1000') as number;ends.set(`${style}/${n}`,end);
    const measured=await evaluate('window.measure()') as {current:string;active?:string;numberOpacity:string;errors:unknown[]};
    if(measured.current!==String(n)||measured.active||measured.numberOpacity!=='1'||measured.errors.length)throw Error(`RECORDING_STATE_FAILED:${style}:${n}`);
    console.info(`Recorded ${style} ${n}/75`);
   }
  }
 }finally{await call('Page.stopScreencast');setSink(undefined);}
 if(frames.length<1000)throw Error('RECORDING_FRAMES_MISSING');
 writeFileSync(join(root,'capture-manifest.json'),JSON.stringify({version:1,viewport:[1280,600],source:'actual BingoBoard native Chromium screencast',frames:frames.map(({path,...f})=>({...f,path:path.replace(root,'')})),ends:[...ends]},null,2));
 function encode(name:string,selected:Capture[],end:number){
  if(selected.length<20)throw Error('CLIP_FRAMES_MISSING:'+name);
  const file=join(root,name+'.ffconcat');let list='ffconcat version 1.0\n';
  selected.forEach((f,i)=>{const next=selected[i+1]?.at??end;list+=`file '${f.path.replaceAll('\\','/').replaceAll("'","'\\''")}'\nduration ${Math.max(.01,next-f.at).toFixed(6)}\n`;});list+=`file '${selected.at(-1)!.path.replaceAll('\\','/')}'\n`;
  writeFileSync(file,list);execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-safe','0','-i',file,'-an','-vf','fps=24,format=yuv420p','-c:v','libx264','-preset','fast','-crf','22','-movflags','+faststart',join(root,name+'.mp4')],{stdio:'pipe',timeout:120000});
 }
 for(let start=1;start<=75;start+=15){const last=Math.min(start+14,75);encode(`gudi-${String(start).padStart(2,'0')}-${last}`,frames.filter(f=>f.brand==='phil-gud'&&f.number>=start&&f.number<=last),ends.get(`phil-gud/${last}`)!);}
 for(const n of [3,9,24,42,66,75])encode(`referenz-${n}`,frames.filter(f=>f.brand==='phil-gud'&&f.number===n),ends.get(`phil-gud/${n}`)!);
 encode('lovd-referenzen',frames.filter(f=>f.brand==='lovd-ungegoogelt'),ends.get('lovd-ungegoogelt/75')!);
 console.info(JSON.stringify({recordedFrames:frames.length,normalSpeed:true,clips:12,root}));
}
