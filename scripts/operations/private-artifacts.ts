import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Environment } from "./acceptance-policy";
import { BridgeClient, type UploadPosition } from "./bridge-client";
import { requireCondition } from "./guards";
import { sha256 } from "./snapshot";

export type Artifact = { name: string; bytes: number; sha256: string };
export function artifactName(name: string) {
  requireCondition(/^[a-z0-9][a-z0-9.-]{0,100}$/.test(name) && !name.includes(".."), "ARTIFACT_NAME_INVALID"); return name;
}
export function backupKey(key: string) {
  requireCondition(/^(production|synthetic)\/acceptance\/run-[1-9][0-9]{0,19}-[1-9][0-9]{0,5}$/.test(key), "BACKUP_KEY_INVALID"); return key;
}
export async function boundedBytes(stream: ReadableStream<Uint8Array>, limit = 128 * 1024 * 1024) {
  const reader = stream.getReader(); const parts: Buffer[] = []; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength; requireCondition(bytes <= limit, "ARTIFACT_SIZE_LIMIT"); parts.push(Buffer.from(chunk.value));
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  return Buffer.concat(parts);
}
export class PrivateArtifacts {
  private client: BridgeClient;
  constructor(env: Environment, readonly key: string, role: "backup" | "restore") {
    backupKey(key); this.client = new BridgeClient(env, role, key);
  }
  async clientPreflight() { await this.client.grant("database.dump", 1); }
  async read(name: string) {
    return this.client.read(artifactName(name));
  }
  async upload(name: string, bytes: Buffer, position?: UploadPosition): Promise<Artifact> {
    await this.client.upload(artifactName(name), bytes, position);
    const evidence = { name, bytes: bytes.length, sha256: sha256(bytes) };
    verifyArtifact(await this.read(name), evidence);
    return evidence;
  }
  async download(artifact: Artifact, directory: string) {
    const bytes = await this.read(artifact.name); verifyArtifact(bytes, artifact);
    await writeFile(join(directory, artifactName(artifact.name)), bytes, { mode: 0o600, flag: "wx" });
  }
}
export function verifyArtifact(bytes: Buffer, expected: Artifact) {
  artifactName(expected.name);
  requireCondition(Number.isSafeInteger(expected.bytes) && expected.bytes >= 0 && /^[a-f0-9]{64}$/.test(expected.sha256) &&
    bytes.length === expected.bytes && sha256(bytes) === expected.sha256, "ARTIFACT_CHECKSUM_MISMATCH");
}
export async function captureMedia(urls: string[], directory: string) {
  const records: { url: string; name: string; bytes: number; sha256: string; contentType: string }[] = [];
  for (const url of urls) {
    const parsed = new URL(url);
    requireCondition(parsed.protocol === "https:" && parsed.hostname === "bix6h2j23vjzi240.public.blob.vercel-storage.com" && !parsed.port && !parsed.username && !parsed.password && !parsed.search && !parsed.hash, "MEDIA_URL_REJECTED");
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(120000), cache: "no-store" });
    requireCondition(response.status === 200 && response.body, "MEDIA_READ_FAILED");
    const bytes = await boundedBytes(response.body); requireCondition(bytes.length > 0, "MEDIA_EMPTY");
    const name = `media-${sha256(url)}.bin`;
    await writeFile(join(directory, name), bytes, { mode: 0o600, flag: "wx" });
    records.push({ url, name, bytes: bytes.length, sha256: sha256(bytes), contentType: response.headers.get("content-type") ?? "application/octet-stream" });
  }
  return records;
}
export async function verifyMediaFiles(records: Awaited<ReturnType<typeof captureMedia>>, directory: string) {
  for (const item of records) verifyArtifact(await readFile(join(directory, artifactName(item.name))), item);
  return { restoredOriginals: records.length, referenceMappingVerified: true };
}
