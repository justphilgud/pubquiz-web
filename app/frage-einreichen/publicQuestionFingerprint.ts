import { createHash } from "node:crypto";

export function createPublicSubmissionFingerprint(input: {
  clientAddress: string;
  secret: string;
}) {
  return createHash("sha256")
    .update(`${input.secret}\u0000${input.clientAddress}`)
    .digest("hex");
}
