"use server";

import { headers } from "next/headers";
import {
  submitPublicQuestion,
  type PublicQuestionSubmissionInput,
  type PublicQuestionSubmissionState,
} from "./publicQuestionSubmission";
import { publicQuestionSubmissionRepository } from "./publicQuestionSubmission.server";
import { createPublicSubmissionFingerprint } from "./publicQuestionFingerprint";

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function getClientAddress(requestHeaders: Headers) {
  return (
    requestHeaders.get("x-vercel-forwarded-for") ??
    requestHeaders.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    "unknown"
  );
}

export async function submitPublicQuestionAction(
  _previousState: PublicQuestionSubmissionState,
  formData: FormData,
): Promise<PublicQuestionSubmissionState> {
  const input: PublicQuestionSubmissionInput = {
    question: formValue(formData, "question"),
    answer: formValue(formData, "answer"),
    explanation: formValue(formData, "explanation"),
    sourceUrl: formValue(formData, "sourceUrl"),
    submitterName: formValue(formData, "submitterName"),
    submitterEmail: formValue(formData, "submitterEmail"),
    website: formValue(formData, "website"),
  };
  const requestHeaders = await headers();
  const fingerprint = createPublicSubmissionFingerprint({
    clientAddress: getClientAddress(requestHeaders),
    secret:
      process.env.PUBLIC_QUESTION_RATE_LIMIT_SECRET ??
      process.env.AUTH_SECRET ??
      process.env.NEXTAUTH_SECRET ??
      "local-public-question-rate-limit",
  });

  try {
    return await submitPublicQuestion(
      input,
      { fingerprint, now: new Date() },
      publicQuestionSubmissionRepository,
    );
  } catch {
    return {
      status: "ERROR",
      message: "Die Frage konnte gerade nicht gespeichert werden. Bitte versuche es später erneut.",
      fieldErrors: {},
    };
  }
}
