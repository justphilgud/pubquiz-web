import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function sealPng(png: Uint8Array) {
  const key = randomBytes(32);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(png), cipher.final()]);
  return { key, bytes: Buffer.concat([nonce, cipher.getAuthTag(), encrypted]), sha256: createHash("sha256").update(png).digest("hex") };
}
export function openPng(bytes: Uint8Array, key: Uint8Array, sha256: string) {
  const buffer = Buffer.from(bytes);
  const decipher = createDecipheriv("aes-256-gcm", key, buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(12, 28));
  const png = Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]);
  if (createHash("sha256").update(png).digest("hex") !== sha256) throw new Error("Archivdatei beschädigt.");
  return png;
}
export function memeFilename(entry: { quizId: number; revision: number; sourceId: number; teamName: string; id: string }) {
  const team = entry.teamName.normalize("NFKD").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 45) || "Team";
  return `Quiz-${entry.quizId}_Durchlauf-${entry.revision + 1}_Frage-${entry.sourceId}_${team}_${entry.id}.png`;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Stored ZIP: PNGs are already compressed. One bounded PNG in memory at a time. */
export async function* zipPngs(files: { name: string; load: () => Promise<Uint8Array> }[]) {
  if (!files.length || files.length > 500) throw new Error("ZIP benötigt 1 bis 500 Memes.");
  const directory: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    if (!/^[a-zA-Z0-9_.-]+\.png$/.test(file.name)) throw new Error("Ungültiger Dateiname.");
    const bytes = await file.load();
    if (bytes.length > 12_000_000 || offset + bytes.length > 128_000_000) throw new Error("ZIP ist zu groß. Bitte kleinere Durchläufe exportieren.");
    const crc = crc32(bytes);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt32LE(crc, 14); header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    directory.push(Buffer.concat([central, name]));
    yield header; yield name; yield bytes;
    offset += header.length + name.length + bytes.length;
  }
  const length = directory.reduce((sum, value) => sum + value.length, 0);
  yield* directory;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(length, 12); end.writeUInt32LE(offset, 16); yield end;
}
