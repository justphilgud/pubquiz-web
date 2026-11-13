import { inflateRawSync } from "node:zlib";
import { maxFileBytes } from "./format";

const maxExpandedBytes = 8 * 1024 * 1024;
const maxEntries = 256;

// Read ZIP central-directory sizes and enforce the same limit during inflation.
export function readWorkbookArchive(bytes: Buffer) {
  if (bytes.length < 22 || bytes.length > maxFileBytes) throw new Error("Ungültige Dateigröße.");
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) &&
    !(bytes.readUInt32LE(end) === 0x06054b50 && end + 22 + bytes.readUInt16LE(end + 20) === bytes.length)) {
    end--;
  }
  if (end < Math.max(0, bytes.length - 65557)) throw new Error("Ungültiges ZIP-Archiv.");
  const count = bytes.readUInt16LE(end + 10);
  const size = bytes.readUInt32LE(end + 12);
  const start = bytes.readUInt32LE(end + 16);
  if (count < 1 || count > maxEntries || start + size !== end ||
    bytes.readUInt32LE(end + 4) !== 0 || count !== bytes.readUInt16LE(end + 8)) {
    throw new Error("Ungültiges oder zu großes ZIP-Archiv.");
  }
  let expanded = 0;
  let offset = start;
  const entries = new Map<string, { method: number; packed: Buffer; length: number }>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("Ungültiger ZIP-Eintrag.");
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const length = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const next = offset + 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    if (next > end || local + 30 > start || bytes.readUInt32LE(local) !== 0x04034b50 ||
      (flags & 1) || (method !== 0 && method !== 8) || bytes.readUInt16LE(local + 8) !== method) {
      throw new Error("Ungültiger ZIP-Eintrag.");
    }
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
    const data = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    expanded += length;
    if (!name || entries.has(name) || expanded > maxExpandedBytes || data + compressed > start) {
      throw new Error("Das entpackte Workbook ist zu groß oder ungültig.");
    }
    entries.set(name, { method, packed: bytes.subarray(data, data + compressed), length });
    offset = next;
  }
  if (offset !== end) throw new Error("Ungültiger ZIP-Verzeichnisabschluss.");

  return (name: string) => {
    const entry = entries.get(name);
    if (!entry) return undefined;
    const unpacked = entry.method === 0
      ? entry.packed
      : inflateRawSync(entry.packed, { maxOutputLength: Math.max(entry.length, 1) });
    if (unpacked.length !== entry.length) throw new Error("Ungültige entpackte Dateigröße.");
    return new TextDecoder("utf-8", { fatal: true }).decode(unpacked);
  };
}
