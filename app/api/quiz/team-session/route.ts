import { startQuizTeamSession } from "@/app/quiz/actions";

export async function POST(request: Request) {
  let data: Parameters<typeof startQuizTeamSession>[0];
  try { data = await request.json(); } catch { return Response.json({ error: "Ungültige Anfrage." }, { status: 400 }); }
  if (!data || !Number.isSafeInteger(data.quizId) || data.quizId <= 0 || typeof data.teamname !== "string" ||
      data.teamname.length > 120 || (data.passwort !== undefined && typeof data.passwort !== "string") ||
      (data.joinRequestId !== undefined && typeof data.joinRequestId !== "string") ||
      !Number.isSafeInteger(data.spielerAnzahl) || data.spielerAnzahl! < 1 || data.spielerAnzahl! > 1000) {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  try { return Response.json(await startQuizTeamSession(data), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Teambeitritt nicht bestätigt. Bitte erneut versuchen." }, { status: 503 }); }
}
