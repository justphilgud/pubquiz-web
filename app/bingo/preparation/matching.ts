/** Matching is preparation content; the AP1 draw pool remains 1–75. */
export type MatchingSource = { questionId: number; revision: string; mediaId: number; variant: string; kind: 'AUDIO' | 'IMAGE' | 'VIDEO'; assetId?: string };
export type MatchingEntry = {
  number: number;
  text: string;
  keepNumber: boolean;
  sameText: boolean;
  presentation: { kind: 'TEXT'; text: string } | { kind: 'MEDIA'; source: MatchingSource | null };
  answerKey: string;
};
export type MatchingSet = { version: 2; name: string; publication: 'DIRECT' | 'APPROVAL' | 'HIDDEN'; entries: MatchingEntry[] };
export class MatchingError extends Error {}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string) => Object.keys(v).sort().join() === keys.split(',').sort().join();
export const cleanMatchingText = (s: string) => s.normalize('NFC').trim().replace(/[\t\r ]+/g, ' ');
const invalidMatchingText = (text:string) => {const value=cleanMatchingText(text);return [...value].length>120 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value);};
function checkedText(v: unknown, number: number, required = true): string {
  if (typeof v !== 'string') throw new MatchingError(`Kugel ${number}: Text fehlt.`);
  const text = cleanMatchingText(v);
  if ((required && !text) || invalidMatchingText(text)) throw new MatchingError(`Kugel ${number}: Bitte einen Text mit 1 bis 120 Zeichen angeben. Zusätzlich gelten die Druckgrenzen.`);
  return text;
}
export function parseMatchingSource(value: unknown): MatchingSource {
  if (!object(value) || !exact(value, 'questionId,revision,mediaId,variant,kind' + (Object.hasOwn(value, 'assetId') ? ',assetId' : '')) || !Number.isSafeInteger(value.questionId) || Number(value.questionId) < 1 || !Number.isSafeInteger(value.mediaId) || Number(value.mediaId) < 1 || typeof value.revision !== 'string' || !/^[a-f0-9]{64}$/.test(value.revision) || typeof value.variant !== 'string' || !/^[a-z_]{1,80}$/.test(value.variant) || !['AUDIO','IMAGE','VIDEO'].includes(String(value.kind)) || value.assetId !== undefined && (typeof value.assetId !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.assetId))) throw new MatchingError('Ungültige Medienzuordnung. Bitte die Quizquelle erneut auswählen.');
  return value as MatchingSource;
}
export function printedMatchingText(entry: MatchingEntry): string { return entry.keepNumber ? String(entry.number) : entry.presentation.kind === 'TEXT' && entry.sameText ? entry.presentation.text : entry.text; }
export function matchingErrors(entries: MatchingEntry[]): Map<number, string> {
  const errors = new Map<number,string>(), labels = new Map<string,number>();
  for (const entry of entries) {
    if(invalidMatchingText(entry.text)||entry.presentation.kind==='TEXT'&&invalidMatchingText(entry.presentation.text))errors.set(entry.number,'Bitte höchstens 120 Zeichen ohne unzulässige Steuerzeichen verwenden. Zusätzlich gelten die Druckgrenzen.');
    if(!entry.keepNumber&&entry.presentation.kind==='TEXT'&&!entry.presentation.text.trim())errors.set(entry.number,'Präsentationstext fehlt.');
    if (!entry.keepNumber && entry.presentation.kind === 'MEDIA' && !entry.presentation.source) errors.set(entry.number, 'Bitte ein tatsächlich vorhandenes Medium auswählen. Browser-Sprachausgabe ist keine Aufnahme.');
    const text = printedMatchingText(entry), key = cleanMatchingText(text).toLocaleLowerCase('de-DE').replace(/\s+/g,' ');
    if (!text.trim()) errors.set(entry.number, 'Kartenbeschriftung fehlt.');
    // 76–90 are stored only, never used by this game mode.
    if (entry.number <= 75) {
      const other = labels.get(key);
      if (other !== undefined) { errors.set(entry.number, `Gleiche Kartenbeschriftung wie Kugel ${other}.`); errors.set(other, `Gleiche Kartenbeschriftung wie Kugel ${entry.number}.`); }
      labels.set(key,entry.number);
    }
  }
  return errors;
}
export function parseMatchingSet(value: unknown): MatchingSet {
  if (!object(value) || !exact(value,'version,name,publication,entries') || value.version !== 2 || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 80 || !['DIRECT','APPROVAL','HIDDEN'].includes(String(value.publication)) || !Array.isArray(value.entries) || value.entries.length !== 90) throw new MatchingError('Der Zuordnungssatz benötigt einen Namen und 90 eindeutige Kugelnummern. Gespielt werden weiterhin nur 1–75.');
  const numbers = new Set<number>();
  const entries = value.entries.map((v): MatchingEntry => {
    if (!object(v) || !exact(v,'number,text,keepNumber,sameText,presentation,answerKey') || !Number.isInteger(v.number) || Number(v.number)<1 || Number(v.number)>90 || numbers.has(Number(v.number)) || typeof v.keepNumber !== 'boolean' || typeof v.sameText !== 'boolean' || typeof v.answerKey !== 'string' || v.answerKey.length>120 || !object(v.presentation)) throw new MatchingError('Jede Kugelnummer von 1 bis 90 muss genau einmal vorkommen.');
    const n=Number(v.number); numbers.add(n);
    let presentation: MatchingEntry['presentation'];
    if(v.presentation.kind==='TEXT' && exact(v.presentation,'kind,text')) presentation={kind:'TEXT',text:checkedText(v.presentation.text,n,!v.keepNumber)};
    else if(v.presentation.kind==='MEDIA' && exact(v.presentation,'kind,source')) { if(v.sameText)throw new MatchingError(`Kugel ${n}: Medien und Kartenantwort werden getrennt gewählt.`); presentation={kind:'MEDIA',source:v.presentation.source===null?null:parseMatchingSource(v.presentation.source)}; }
    else throw new MatchingError(`Kugel ${n}: Präsentationsinhalt fehlt.`);
    return {number:n,text:checkedText(v.text,n,!v.keepNumber && !v.sameText),keepNumber:v.keepNumber,sameText:v.sameText,presentation,answerKey:v.answerKey};
  }).sort((a,b)=>a.number-b.number);
  const errors=matchingErrors(entries); if(errors.size) { const [n,message]=errors.entries().next().value!; throw new MatchingError(`Kugel ${n}: ${message}`); }
  return {version:2,name:value.name.trim(),publication:value.publication as MatchingSet['publication'],entries};
}
export function initialMatchingEntries(existing?: {entries:{number:number;text:string}[]} | null): MatchingEntry[] {
  return Array.from({length:90},(_,i)=>{ const number=i+1,old=existing?.entries.find(e=>e.number===number); if(old && 'keepNumber' in old)return structuredClone(old) as MatchingEntry; return {number,text:old?.text??'',keepNumber:!old,sameText:true,presentation:{kind:'TEXT',text:old?.text??''},answerKey:'custom'}; });
}
export type SourceAnswer = { key:string; label:string; text:string };
/** Use actual labels/accepted solutions, never a field's position or media variant. */
export function matchingAnswers(fields: {id:number;label:string;solutions:string[]}[], correct: {id:number;text:string}[]): SourceAnswer[] {
  const result:SourceAnswer[]=fields.flatMap(f=>{const text=f.solutions.find(s=>s.trim());return text?[{key:`field:${f.id}`,label:f.label,text:cleanMatchingText(text)}]:[];});
  const semantic=(label:string)=>label.toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[^a-z]/g,'');
  const artists=result.filter(r=>['interpret','interpretin','kunstler','artist','band'].includes(semantic(r.label))),titles=result.filter(r=>['titel','songtitel','title','songtitle'].includes(semantic(r.label)));
  if(artists.length===1&&titles.length===1){const artist=artists[0],title=titles[0];result.push({key:`combine:${artist.key}:${title.key}`,label:'Interpret + Titel',text:`${artist.text} – ${title.text}`});}
  if(!result.length)result.push(...correct.filter(r=>r.text.trim()).map(r=>({key:`answer:${r.id}`,label:'Antwort',text:cleanMatchingText(r.text)})));
  return result;
}
export function matchingVariantLabel(variant:string):string { return ({music_original_audio:'Originalaufnahme',music_reverse_audio:'Rückwärtsaufnahme',music_bitcrush_audio:'8-Bit-/Bitcrush-Aufnahme',lyrics_tts_audio:'Gespeicherte Vorleseaufnahme',question_image:'Bild',answer_image:'Antwortbild',question_audio:'Audiodatei',question_video:'Video',pixel_original_image:'Originalbild',pixel_result_image:'Bearbeitetes Bild'} as Record<string,string>)[variant]??'Vorhandenes Medium'; }
