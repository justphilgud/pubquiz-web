import { getQuizLiveSnapshotData } from "@/app/quiz/interaction/interaction.server";
import { getQuizAntwortStatus } from "@/app/quiz/actions";
import { getTeamSessionSigningSecret } from "@/app/quiz/teamSessionSecret.server";
import { verifyTeamSessionToken } from "@/app/quiz/teamSessionToken";

type LiveSnapshotRequest = {
  quizId?: unknown;
  quizTeamSessionToken?: unknown;
  includeAnswerStatus?: unknown;
};

export async function POST(request: Request) {
  const body = await request.json() as LiveSnapshotRequest;
  const quizId = Number(body.quizId);
  if (!Number.isSafeInteger(quizId) || quizId <= 0) {
    return Response.json({ error: "INVALID_QUIZ" }, { status: 400 });
  }
  const token = typeof body.quizTeamSessionToken === "string"
    ? body.quizTeamSessionToken
    : null;
  const tokenPayload = token
    ? verifyTeamSessionToken(token, getTeamSessionSigningSecret())
    : null;
  if (token && tokenPayload?.quizId !== quizId) {
    return Response.json({ error: "INVALID_SESSION" }, { status: 401 });
  }
  if (body.includeAnswerStatus === true) {
    const answerStatus = await getQuizAntwortStatus(quizId, token ?? undefined);
    return Response.json(answerStatus, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  const snapshot = await getQuizLiveSnapshotData(
    quizId,
    tokenPayload?.sessionId ?? null,
  );
  return Response.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
