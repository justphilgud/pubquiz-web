import {
  BlobAccessError, BlobClientTokenExpiredError, BlobContentTypeNotAllowedError,
  BlobError, BlobFileTooLargeError, BlobNotFoundError, BlobPathnameMismatchError,
  BlobPreconditionFailedError, BlobRequestAbortedError, BlobServiceNotAvailable,
  BlobServiceRateLimited, BlobStoreNotFoundError, BlobStoreSuspendedError, BlobUnknownError,
} from "@vercel/blob";
import { OperationsError, requireCondition } from "./guards";

export function blobFailureCategory(error: unknown): string {
  const categories = [
    [BlobAccessError, "ACCESS_DENIED"], [BlobClientTokenExpiredError, "TOKEN_EXPIRED"],
    [BlobContentTypeNotAllowedError, "CONTENT_TYPE_REJECTED"], [BlobFileTooLargeError, "FILE_TOO_LARGE"],
    [BlobNotFoundError, "NOT_FOUND"], [BlobPathnameMismatchError, "PATH_REJECTED"],
    [BlobPreconditionFailedError, "PRECONDITION_FAILED"], [BlobRequestAbortedError, "ABORTED"],
    [BlobServiceNotAvailable, "SERVICE_UNAVAILABLE"], [BlobServiceRateLimited, "RATE_LIMITED"],
    [BlobStoreNotFoundError, "STORE_NOT_FOUND"], [BlobStoreSuspendedError, "STORE_SUSPENDED"],
    [BlobUnknownError, "PROVIDER_UNKNOWN"],
  ] as const;
  for (const [type, category] of categories) if (error instanceof type) return category;
  // Only compare known codes; never interpolate provider messages, URLs or causes.
  let candidate = error;
  for (let depth = 0; depth < 3 && candidate && typeof candidate === "object"; depth++) {
    const { code, cause, name } = candidate as { code?: unknown; cause?: unknown; name?: unknown };
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS_FAILED";
    if (["CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(String(code))) return "TLS_FAILED";
    if (["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"].includes(String(code)) || name === "TimeoutError") return "TIMEOUT";
    if (["ECONNRESET", "ECONNREFUSED", "EPIPE", "UND_ERR_SOCKET"].includes(String(code))) return "CONNECTION_FAILED";
    if (name === "AbortError") return "ABORTED";
    candidate = cause;
  }
  if (error instanceof BlobError) return "REQUEST_REJECTED";
  if (error instanceof TypeError) return "CLIENT_TYPE_ERROR";
  return "UNKNOWN";
}

export async function privateBlobOperation<T>(operation: "UPLOAD" | "READBACK", run: () => Promise<T>): Promise<T> {
  requireCondition(operation === "UPLOAD" || operation === "READBACK", "BLOB_DIAGNOSTIC_OPERATION_INVALID");
  try { return await run(); }
  catch (error) {
    if (error instanceof OperationsError) throw error;
    throw new OperationsError(`PRIVATE_BLOB_${operation}_${blobFailureCategory(error)}`);
  }
}
