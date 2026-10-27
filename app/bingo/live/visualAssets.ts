import { createHash } from "node:crypto";
import type { LiveAssets } from "./visualAssets.server";
export function parseLiveAssets(input: unknown): LiveAssets {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("INVALID_LIVE_ASSETS");
  const r = input as Record<string, unknown>;
  if (Object.keys(r).sort().join() !== "background,body,display,logo,version" || r.version !== 1) throw Error("INVALID_LIVE_ASSETS");
  for (const key of ["display", "body", "logo", "background"]) {
    const a = r[key];
    if (a === null && ["logo", "background"].includes(key)) continue;
    if (!a || typeof a !== "object" || Array.isArray(a)) throw Error("INVALID_LIVE_ASSETS");
    const v = a as Record<string, unknown>;
    if (Object.keys(v).sort().join() !== "bytes,name,sha256" || typeof v.name !== "string" ||
        !v.name || v.name.length > 150 || typeof v.bytes !== "string" || v.bytes.length > 4000000 ||
        typeof v.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(v.sha256)) throw Error("INVALID_LIVE_ASSETS");
    const bytes = Buffer.from(v.bytes, "base64");
    if (!bytes.length || bytes.toString("base64") !== v.bytes || createHash("sha256").update(bytes).digest("hex") !== v.sha256) throw Error("LIVE_ASSET_CHECKSUM");
    if (["logo", "background"].includes(key) ? bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" : !["00010000", "4f54544f", "774f4646", "774f4632"].includes(bytes.subarray(0, 4).toString("hex"))) throw Error("LIVE_ASSET_FORMAT");
  }
  return r as LiveAssets;
}
