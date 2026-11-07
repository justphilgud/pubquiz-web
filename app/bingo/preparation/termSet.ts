import { parseMatchingSet, printedMatchingText, type MatchingSet } from './matching';
/** A frozen semantic mapping is separate from immutable numeric card geometry. */
export type TermEntry = { number: number; text: string };
export type TermSet = { version: 1; name: string; entries: TermEntry[]; publication: 'DIRECT' | 'APPROVAL' | 'HIDDEN' } | MatchingSet;
export class TermSetError extends Error {}
export function parseTermSet(input: unknown): TermSet {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TermSetError('Bitte ein vollständiges Begriffsset angeben.');
  const value = input as Record<string, unknown>;
  if(value.version===2)return parseMatchingSet(input);
  if (Object.keys(value).sort().join() !== 'entries,name,publication,version' || value.version !== 1 || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 80 || !['DIRECT','APPROVAL','HIDDEN'].includes(String(value.publication)) || !Array.isArray(value.entries) || value.entries.length !== 75) throw new TermSetError('Ein Begriffsset benötigt einen Namen und genau 75 eindeutige Zuordnungen.');
  const numbers = new Set<number>(), labels = new Set<string>();
  const entries = value.entries.map((input): TermEntry => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TermSetError('Ungültige Zuordnung.');
    const entry = input as Record<string, unknown>;
    if (Object.keys(entry).sort().join() !== 'number,text' || typeof entry.number !== 'number' || !Number.isInteger(entry.number) || entry.number < 1 || entry.number > 75 || typeof entry.text !== 'string') throw new TermSetError('Jede Zuordnung benötigt eine Kugelnummer von 1 bis 75 und einen Begriff.');
    const text = entry.text.normalize('NFC').trim().replace(/[\t\r ]+/g, ' ');
    if (!text || [...text].length > 120 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(text)) throw new TermSetError(`Kugel ${entry.number}: Bitte einen Begriff mit höchstens 120 Zeichen eingeben. Die zusätzliche Druckprüfung hängt von Schrift und Format ab.`);
    const key = text.toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
    if (numbers.has(entry.number)) throw new TermSetError(`Kugel ${entry.number} ist mehrfach zugeordnet.`);
    if (labels.has(key)) throw new TermSetError(`„${text}“ ist mehrdeutig mehreren Kugeln zugeordnet.`);
    numbers.add(entry.number); labels.add(key);
    return { number: entry.number, text };
  }).sort((a,b) => a.number-b.number);
  return { version: 1, name: value.name.trim(), entries, publication: value.publication as TermSet['publication'] };
}
export function termFor(set: TermSet, number: number): string {
  if(set.version===2){const matching=set.entries.find(e=>e.number===number);if(!matching)throw new TermSetError('Für diese Kugel fehlt die eingefrorene Zuordnung.');return printedMatchingText(matching);}
  const entry = set.entries.find(entry => entry.number === number);
  if (!entry) throw new TermSetError('Für diese Kugel fehlt die eingefrorene Zuordnung.');
  return entry.text;
}
export function usesCardText(set: TermSet | null, number: number): boolean {
  return !!set && (set.version === 1 || !set.entries.find(e => e.number === number)?.keepNumber);
}
/** Audience projection never returns concealed answers, including before moderator approval. */
export function publishedTerm(set: TermSet, number: number, approved: boolean, revealed: boolean): string | null {
  if (set.publication === 'HIDDEN' && !revealed || set.publication === 'APPROVAL' && !approved) return null;
  if(set.version===2){const entry=set.entries.find(e=>e.number===number);if(!entry)throw new TermSetError('Zuordnung fehlt.');return entry.keepNumber?String(number):entry.presentation.kind==='TEXT'?entry.presentation.text:null;}
  return termFor(set, number);
}
