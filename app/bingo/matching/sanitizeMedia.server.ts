import 'server-only';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {runFfmpeg} from '@/app/fragen/editor/generators/processors/ffmpeg';
/** Reuse existing processors. Remove answer-bearing metadata, never synthesize or reverse content. */
export async function sanitizeMatchingMedia(bytes:Buffer,contentType:string){
 if(contentType.startsWith('image/'))return sharp(bytes,{limitInputPixels:40_000_000}).toBuffer();
 const directory=await mkdtemp(join(tmpdir(),'pubquiz-bingo-matching-'));
 const suffix:Record<string,string>={'audio/mpeg':'mp3','audio/wav':'wav','audio/ogg':'ogg','audio/mp4':'m4a','video/mp4':'mp4','video/webm':'webm'};
 const input=join(directory,'source'),output=join(directory,`medium.${suffix[contentType]}`);
 try{
  await writeFile(input,bytes);
  await runFfmpeg(['-nostdin','-hide_banner','-loglevel','error','-y','-protocol_whitelist','file,pipe','-i',input,...(contentType.startsWith('audio/')?['-map','0:a:0','-vn']:['-map','0:v:0','-map','0:a?']),'-c','copy','-map_metadata','-1','-map_chapters','-1',...(contentType==='audio/mpeg'?['-id3v2_version','0','-write_id3v1','0']:[]),...(contentType.endsWith('/mp4')?['-movflags','+faststart']:[]),output]);
  return await readFile(output);
 }finally{await rm(directory,{recursive:true,force:true});}
}
