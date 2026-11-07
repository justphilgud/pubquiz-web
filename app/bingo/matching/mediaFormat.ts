export function matchingContentType(bytes:Uint8Array,kind:string):string|null{
 const b=Buffer.from(bytes),ascii=b.subarray(0,12).toString('ascii');
 if(kind==='IMAGE')return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b[0]===255&&b[1]===216?'image/jpeg':ascii.startsWith('RIFF')&&ascii.endsWith('WEBP')?'image/webp':null;
 if(kind==='AUDIO')return ascii.startsWith('RIFF')&&ascii.endsWith('WAVE')?'audio/wav':ascii.startsWith('OggS')?'audio/ogg':ascii.startsWith('ID3')||b[0]===255&&(b[1]&224)===224?'audio/mpeg':ascii.slice(4,8)==='ftyp'?'audio/mp4':null;
 if(kind==='VIDEO')return ascii.slice(4,8)==='ftyp'?'video/mp4':b.subarray(0,4).toString('hex')==='1a45dfa3'?'video/webm':null;
 return null;
}
