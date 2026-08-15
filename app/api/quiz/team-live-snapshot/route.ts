import { getQuizAntwortStatus } from "@/app/quiz/actions";
import { getQuizLiveSnapshotData } from "@/app/quiz/interaction/interaction.server";
import { resolveParticipantSession } from "@/app/quiz/participantSession.server";
import {
  logLivePerformance,
  withPrismaQueryDiagnostics,
} from "@/app/lib/prismaQueryDiagnostics.server";

type TeamLiveSnapshotRequest = {
  quizId?: unknown;
  quizTeamSessionToken?: unknown;
  includeAnswerStatus?: unknown;
};

export async function POST(request: Request) {
  const requestStartedAt = performance.now();
  const phases: Record<string, number> = {};
  let payloadBytes = 0;
  let operation = "participant-light-snapshot";
  const { result, diagnostics } = await withPrismaQueryDiagnostics(async () => {
    let phaseStartedAt = performance.now();
    const body = await request.json() as TeamLiveSnapshotRequest;
    phases.parse = performance.now() - phaseStartedAt;
    const quizId = Number(body.quizId);
    if (!Number.isSafeInteger(quizId) || quizId <= 0) {
      return Response.json({ error: "INVALID_QUIZ" }, { status: 400 });
    }

    const token = typeof body.quizTeamSessionToken === "string"
      ? body.quizTeamSessionToken
      : null;
    let payload: unknown;
    if (body.includeAnswerStatus === true) {
      operation = "participant-full-snapshot";
      phaseStartedAt = performance.now();
      const answerStatus = await getQuizAntwortStatus(quizId, token ?? undefined);
      phases.fullSnapshot = performance.now() - phaseStartedAt;
      if (!answerStatus || answerStatus.liveRevision === "participant:join") {
        return Response.json({ error: "INVALID_SESSION" }, { status: 401 });
      }
      payload = answerStatus;
    } else {
      phaseStartedAt = performance.now();
      const participantSession = await resolveParticipantSession(quizId, token);
      phases.teamSession = performance.now() - phaseStartedAt;
      if (!participantSession) {
        return Response.json({ error: "INVALID_SESSION" }, { status: 401 });
      }
      phaseStartedAt = performance.now();
      payload = await getQuizLiveSnapshotData(
        quizId,
        participantSession.quiz_team_session_id,
      );
      phases.snapshot = performance.now() - phaseStartedAt;
    }

    phaseStartedAt = performance.now();
    const serialized = JSON.stringify(payload);
    phases.serialization = performance.now() - phaseStartedAt;
    payloadBytes = Buffer.byteLength(serialized);
    return new Response(serialized, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    });
  });
  logLivePerformance(operation, {
    ...phases,
    payloadBytes,
    queryCount: diagnostics?.queryCount ?? null,
    queryDurationMs: diagnostics?.queryDurationMs ?? null,
    total: performance.now() - requestStartedAt,
  });
  return result;
}
