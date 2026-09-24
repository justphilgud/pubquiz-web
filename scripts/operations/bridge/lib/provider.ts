import { BlobNotFoundError, del, head, issueSignedToken, list, presignUrl } from "@vercel/blob";
import { INVENTORY_PAGE_LIMIT, STORE_HOST, STORE_ID } from "./contract.js";
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
  async inventory(prefix, cursor) {
    const page = await api.list({ storeId: STORE_ID, prefix, limit: INVENTORY_PAGE_LIMIT,
      ...(cursor ? { cursor } : {}), abortSignal: AbortSignal.timeout(10000) });
    if (page.hasMore && !page.cursor) throw new Error("inventory cursor");
    return {
      objects: page.blobs.map(blob => ({ pathname: blob.pathname, size: blob.size,
        uploadedAt: blob.uploadedAt.toISOString(), etag: blob.etag })),
      cursor: page.hasMore ? page.cursor! : null,
      complete: !page.hasMore,
    };
  },
  async remove(pathname, etag) {
    await api.del(pathname, { storeId: STORE_ID, ifMatch: etag, abortSignal: AbortSignal.timeout(10000) });
  },
}; }
export const blobProvider = createBlobProvider();
