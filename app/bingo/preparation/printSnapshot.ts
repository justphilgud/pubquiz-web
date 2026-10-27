import { createHash } from "node:crypto";
import { parseSharedDesign, type SharedDesign } from "@/app/rendering/sharedDesign/sharedDesign";
import { BingoPreparationError } from "./policy";

export type EmbeddedAsset = { name: string; bytes: string; sha256: string };
export type PrintSnapshot = { version: 1; title: string; roundLabel: string; design: SharedDesign; designHash: string; display: EmbeddedAsset; body: EmbeddedAsset; logo: EmbeddedAsset | null };
export const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("PRINT_VALUE_INVALID");
  return encoded;
}
export const designHash = (design: SharedDesign) => sha256(canonical(design));
export function asset(name: string, bytes: Uint8Array): EmbeddedAsset {
  return { name, bytes: Buffer.from(bytes).toString("base64"), sha256: sha256(bytes) };
}
function keys(value: unknown, expected: string): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === expected.split(",").sort().join(",");
}
function decodeAsset(value: unknown, kind: "font" | "logo"): EmbeddedAsset {
  if (!keys(value, "name,bytes,sha256") || typeof value.name !== "string" || !value.name || value.name.length > 150 || typeof value.bytes !== "string" || value.bytes.length > 4_000_000 || value.bytes.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.bytes) || typeof value.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.sha256)) throw new Error("PRINT_ASSET_INVALID");
  const bytes = Buffer.from(value.bytes, "base64");
  if (!bytes.length || bytes.toString("base64") !== value.bytes || sha256(bytes) !== value.sha256) throw new Error("PRINT_ASSET_CHECKSUM");
  if (kind === "logo" ? !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : !["00010000", "4f54544f", "774f4646", "774f4632"].includes(bytes.subarray(0, 4).toString("hex"))) throw new Error("PRINT_ASSET_FORMAT");
  return { name: value.name, bytes: value.bytes, sha256: value.sha256 };
}
export function parsePrintSnapshot(value: unknown): PrintSnapshot {
  try {
    if (!keys(value, "version,title,roundLabel,design,designHash,display,body,logo") || value.version !== 1 || typeof value.title !== "string" || !value.title || value.title.length > 150 || typeof value.roundLabel !== "string" || !value.roundLabel || value.roundLabel.length > 80) throw new Error("PRINT_STRUCTURE");
    const design = parseSharedDesign(value.design);
    if (!design || value.designHash !== designHash(design)) throw new Error("PRINT_DESIGN");
    if ((design.config.tokens.assets.logo === null) !== (value.logo === null)) throw new Error("PRINT_LOGO_REQUIRED");
    return { version: 1, title: value.title, roundLabel: value.roundLabel, design, designHash: designHash(design), display: decodeAsset(value.display, "font"), body: decodeAsset(value.body, "font"), logo: value.logo === null ? null : decodeAsset(value.logo, "logo") };
  } catch { throw new BingoPreparationError("Das gespeicherte Druckdesign ist ungültig. Bitte die Administration informieren."); }
}
