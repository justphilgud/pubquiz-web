import { auth } from "@/auth";
import { getQuizLiveSnapshotData } from "@/app/quiz/interaction/interaction.server";

type LiveSnapshotRequest = {
  quizId?: unknown;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json() as LiveSnapshotRequest;
  const quizId = Number(body.quizId);
  if (!Number.isSafeInteger(quizId) || quizId <= 0) {
    return Response.json({ error: "INVALID_QUIZ" }, { status: 400 });
  }
  const snapshot = await getQuizLiveSnapshotData(quizId, null);
  return Response.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
