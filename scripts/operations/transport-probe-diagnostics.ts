import { limitedResponse } from "./bridge-client";
import { OperationsError } from "./guards";

const codes = new Set(["CONFIG_REJECTED", "IDENTITY_REJECTED", "REQUEST_REJECTED",
  "OBJECT_EXISTS", "OBJECT_MISSING", "OBJECT_TOO_LARGE", "PROVIDER_REJECTED"]);

// Never include response text, headers, URLs, tokens or exception messages in diagnostics.
export async function expectProbeDenial(response: Response, caseNumber: number,
  expected: "REQUEST_REJECTED" | "OBJECT_TOO_LARGE" | "OBJECT_EXISTS" = "REQUEST_REJECTED") {
  if (!Number.isInteger(caseNumber) || caseNumber < 1 || caseNumber > 10) {
    throw new OperationsError("SYNTHETIC_CASE_INVALID");
  }
  let code = "UNRECOGNIZED";
  try {
    const body: unknown = JSON.parse((await limitedResponse(response, 1024)).toString("utf8"));
    if (body && typeof body === "object" && !Array.isArray(body) &&
      Object.keys(body).join() === "error" && "error" in body &&
      typeof body.error === "string" && codes.has(body.error)) code = body.error;
  } catch { /* Provider HTML, oversized bodies and stream errors remain redacted. */ }
  if (response.status !== 403 || code !== expected) {
    throw new OperationsError(`SYNTHETIC_CASE_${caseNumber}_HTTP_${response.status}_BODY_${code}`);
  }
}
