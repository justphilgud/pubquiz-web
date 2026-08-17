import { auth } from "@/auth";
import { getQuizLiveSnapshotData } from "@/app/quiz/interaction/interaction.server";
import {
  logLivePerformance,
  withPrismaQueryDiagnostics,
} from "@/app/lib/prismaQueryDiagnostics.server";

type LiveSnapshotRequest = {
  quizId?: unknown;
  includeTeamJoinState?: unknown;
  presentationQuestionAssignmentId?: unknown;
};

export async function POST(request: Request) {
  const requestStartedAt = performance.now();
  const phases: Record<string, number> = {};
  let payloadBytes = 0;
  const { result, diagnostics } = await withPrismaQueryDiagnostics(async () => {
    let phaseStartedAt = performance.now();
    const session = await auth();
    phases.auth = performance.now() - phaseStartedAt;
    if (!session?.user) {
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    phaseStartedAt = performance.now();
    const body = await request.json() as LiveSnapshotRequest;
    phases.parse = performance.now() - phaseStartedAt;
    const quizId = Number(body.quizId);
    if (!Number.isSafeInteger(quizId) || quizId <= 0) {
      return Response.json({ error: "INVALID_QUIZ" }, { status: 400 });
    }
    const presentationQuestionAssignmentId =
      body.presentationQuestionAssignmentId === undefined
        ? undefined
        : Number(body.presentationQuestionAssignmentId);
    if (
      presentationQuestionAssignmentId !== undefined &&
      (!Number.isSafeInteger(presentationQuestionAssignmentId) ||
        presentationQuestionAssignmentId <= 0)
    ) {
      return Response.json({ error: "INVALID_QUESTION" }, { status: 400 });
    }
    phaseStartedAt = performance.now();
    const snapshot = await getQuizLiveSnapshotData(quizId, null, {
      includePresentationState: true,
      includeTeamJoinState: body.includeTeamJoinState === true,
      presentationQuestionAssignmentId,
    });
    phases.snapshot = performance.now() - phaseStartedAt;
    phaseStartedAt = performance.now();
    const payload = JSON.stringify(snapshot);
    phases.serialization = performance.now() - phaseStartedAt;
    payloadBytes = Buffer.byteLength(payload);
    return new Response(payload, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    });
  });
  logLivePerformance("moderator-live-snapshot", {
    ...phases,
    payloadBytes,
    queryCount: diagnostics?.queryCount ?? null,
    queryDurationMs: diagnostics?.queryDurationMs ?? null,
    total: performance.now() - requestStartedAt,
  });
  return result;
}
