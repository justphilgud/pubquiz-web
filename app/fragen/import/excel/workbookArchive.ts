import { inflateRawSync } from "node:zlib";
import { maxFileBytes } from "./format";
import { WorkbookError } from "./workbookError";

const maxExpandedBytes = 8 * 1024 * 1024;
const maxEntries = 256;

function invalidArchive(): never {
  throw new WorkbookError("Das ZIP-Archiv der XLSX-Datei ist beschädigt oder verwendet ein nicht unterstütztes ZIP-Format. Bitte die Datei erneut als XLSX speichern.");
}

// Read ZIP central-directory sizes and enforce the same limit during inflation.
export function readWorkbookArchive(bytes: Buffer) {
  if (bytes.length > maxFileBytes) throw new WorkbookError("Die XLSX-Datei überschreitet 768 KiB.");
  if (bytes.length < 22) invalidArchive();
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) &&
    !(bytes.readUInt32LE(end) === 0x06054b50 && end + 22 + bytes.readUInt16LE(end + 20) === bytes.length)) {
    end--;
  }
  if (end < Math.max(0, bytes.length - 65557)) invalidArchive();
  const count = bytes.readUInt16LE(end + 10);
  const size = bytes.readUInt32LE(end + 12);
  const start = bytes.readUInt32LE(end + 16);
  if (count < 1 || start + size !== end ||
    bytes.readUInt32LE(end + 4) !== 0 || count !== bytes.readUInt16LE(end + 8)) {
    invalidArchive();
  }
  if (count > maxEntries) throw new WorkbookError("Die XLSX-Datei enthält mehr als 256 ZIP-Einträge.");
  let expanded = 0;
  let offset = start;
  const entries = new Map<string, { method: number; packed: Buffer; length: number }>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) invalidArchive();
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const length = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const next = offset + 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    if (next > end || local + 30 > start || bytes.readUInt32LE(local) !== 0x04034b50 ||
      (flags & 1) || (method !== 0 && method !== 8) || bytes.readUInt16LE(local + 8) !== method) {
      invalidArchive();
    }
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
    const data = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    expanded += length;
    if (!name || entries.has(name) || data + compressed > start) invalidArchive();
    if (expanded > maxExpandedBytes) throw new WorkbookError("Die XLSX-Datei überschreitet entpackt 8 MiB.");
    entries.set(name, { method, packed: bytes.subarray(data, data + compressed), length });
    offset = next;
  }
  if (offset !== end) invalidArchive();

  return (name: string) => {
    const entry = entries.get(name);
    if (!entry) return undefined;
    let unpacked: Buffer;
    try {
      unpacked = entry.method === 0
        ? entry.packed
        : inflateRawSync(entry.packed, { maxOutputLength: Math.max(entry.length, 1) });
    } catch {
      invalidArchive();
    }
    if (unpacked.length !== entry.length) invalidArchive();
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(unpacked);
    } catch {
      throw new WorkbookError("Ein XML-Bestandteil der XLSX-Datei enthält ungültiges UTF-8. Bitte die Datei erneut als XLSX speichern.");
    }
  };
}
