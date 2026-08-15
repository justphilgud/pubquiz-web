import { getQuizAntwortStatus } from "@/app/quiz/actions";
import { getQuizLiveSnapshotData } from "@/app/quiz/interaction/interaction.server";
import { resolveParticipantSession } from "@/app/quiz/participantSession.server";

type TeamLiveSnapshotRequest = {
  quizId?: unknown;
  quizTeamSessionToken?: unknown;
  includeAnswerStatus?: unknown;
};

export async function POST(request: Request) {
  const body = await request.json() as TeamLiveSnapshotRequest;
  const quizId = Number(body.quizId);
  if (!Number.isSafeInteger(quizId) || quizId <= 0) {
    return Response.json({ error: "INVALID_QUIZ" }, { status: 400 });
  }

  const token = typeof body.quizTeamSessionToken === "string"
    ? body.quizTeamSessionToken
    : null;
  if (body.includeAnswerStatus === true) {
    const answerStatus = await getQuizAntwortStatus(quizId, token ?? undefined);
    if (!answerStatus || answerStatus.liveRevision === "participant:join") {
      return Response.json({ error: "INVALID_SESSION" }, { status: 401 });
    }
    return Response.json(answerStatus, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const participantSession = await resolveParticipantSession(quizId, token);
  if (!participantSession) {
    return Response.json({ error: "INVALID_SESSION" }, { status: 401 });
  }
  const snapshot = await getQuizLiveSnapshotData(
    quizId,
    participantSession.quiz_team_session_id,
  );
  return Response.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
