import { BlobNotFoundError, head, issueSignedToken, presignUrl } from "@vercel/blob";
import { STORE_HOST, STORE_ID } from "./contract";
import type { BlobProvider } from "./service";

// No static token, no wildcard delegation, no signed-token material leaves this service.
export function createBlobProvider(api = { head, issueSignedToken, presignUrl }): BlobProvider { return {
  async size(pathname) {
    try { return (await api.head(`https://${STORE_HOST}/${pathname}`, { storeId: STORE_ID, abortSignal: AbortSignal.timeout(10000) })).size; }
    catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
  },
  async sign(scope) {
    const operation = scope.method === "PUT" ? "put" : "get";
    const signed = await api.issueSignedToken({ storeId: STORE_ID, pathname: scope.pathname, operations: [operation],
      validUntil: scope.expiresAt, ...(operation === "put" ? { allowedContentTypes: ["application/octet-stream"], maximumSizeInBytes: scope.maximumSize } : {}),
      abortSignal: AbortSignal.timeout(10000) });
    return (await api.presignUrl(signed, { operation, pathname: scope.pathname, access: "private", validUntil: scope.expiresAt,
      ...(operation === "put" ? { allowedContentTypes: ["application/octet-stream"], maximumSizeInBytes: scope.maximumSize,
        allowOverwrite: false, addRandomSuffix: false, cacheControlMaxAge: 60 } : {}) })).presignedUrl;
  },
}; }
export const blobProvider = createBlobProvider();
