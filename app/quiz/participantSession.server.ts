import { prisma } from "@/app/lib/prisma";
import { getTeamSessionSigningSecret } from "./teamSessionSecret.server";
import { verifyTeamSessionToken } from "./teamSessionToken";

export async function resolveParticipantSession(
  quizId: number,
  token: string | null | undefined,
) {
  if (!token) return null;

  const payload = verifyTeamSessionToken(
    token,
    getTeamSessionSigningSecret(),
  );
  if (!payload || payload.quizId !== quizId) return null;

  return prisma.quiz_team_sessions.findFirst({
    where: {
      quiz_team_session_id: payload.sessionId,
      quiz_id: quizId,
    },
    select: {
      quiz_team_session_id: true,
      quiz_id: true,
      teamname: true,
    },
  });
}
