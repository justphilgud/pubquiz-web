import { saveTeamAntwortDraft } from "@/app/quiz/actions";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Parameters<typeof saveTeamAntwortDraft>[0];
    if (!body || !Number.isSafeInteger(body.quizId) || !Number.isSafeInteger(body.quizFragenId) ||
      !Number.isSafeInteger(body.interactionRunId) || !Number.isSafeInteger(body.expectedDraftRevision) ||
      body.expectedDraftRevision < 0 || typeof body.quizTeamSessionToken !== "string") {
      return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const result = await saveTeamAntwortDraft(body);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "SAVE_NOT_CONFIRMED" }, { status: 503 });
  }
}
