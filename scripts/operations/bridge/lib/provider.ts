import { BlobNotFoundError, del, head, issueSignedToken, list, presignUrl } from "@vercel/blob";
import { STORE_HOST, STORE_ID, type InventoryObject } from "./contract.js";
import type { BlobProvider } from "./service.js";

// No static token, no wildcard delegation, no signed-token material leaves this service.
export function createBlobProvider(api = { del, head, issueSignedToken, list, presignUrl }): BlobProvider { return {
  async size(pathname) {
    try { return (await api.head(`https://${STORE_HOST}/${pathname}`, { storeId: STORE_ID, abortSignal: AbortSignal.timeout(10000) })).size; }
    catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
  },
  async sign(scope) {
    const operation = scope.method === "PUT" ? "put" : "get";
    const signed = await api.issueSignedToken({ storeId: STORE_ID, pathname: scope.pathname, operations: [operation],
      validUntil: scope.expiresAt, ...(operation === "put" ? { allowedContentTypes: [scope.contentType], maximumSizeInBytes: scope.maximumSize } : {}),
      abortSignal: AbortSignal.timeout(10000) });
    return (await api.presignUrl(signed, { operation, pathname: scope.pathname, access: "private", validUntil: scope.expiresAt,
      ...(operation === "put" ? { allowedContentTypes: [scope.contentType], maximumSizeInBytes: scope.maximumSize,
        allowOverwrite: false, addRandomSuffix: false, cacheControlMaxAge: 60 } : {}) })).presignedUrl;
  },
  async inventory(prefix) {
    const objects: InventoryObject[] = []; let cursor: string | undefined;
    do {
      const page = await api.list({ storeId: STORE_ID, prefix, limit: 1000, ...(cursor ? { cursor } : {}), abortSignal: AbortSignal.timeout(10000) });
      objects.push(...page.blobs.map(blob => ({ pathname: blob.pathname, size: blob.size,
        uploadedAt: blob.uploadedAt.toISOString(), etag: blob.etag })));
      if (objects.length > 4096) throw new Error("inventory limit");
      cursor = page.hasMore ? page.cursor : undefined;
      if (page.hasMore && !cursor) throw new Error("inventory cursor");
    } while (cursor);
    return objects;
  },
  async remove(pathname, etag) {
    await api.del(pathname, { storeId: STORE_ID, ifMatch: etag, abortSignal: AbortSignal.timeout(10000) });
  },
}; }
export const blobProvider = createBlobProvider();
