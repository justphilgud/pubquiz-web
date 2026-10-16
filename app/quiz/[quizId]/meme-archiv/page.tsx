import Link from "next/link";
import { requireQuizViewer } from "../../quizAccess.server";
import { MemeArchivePanel } from "../../memeArchive/MemeArchivePanel";

export default async function MemeArchivePage({ params }: { params: Promise<{ quizId: string }> }) {
  const quizId = Number((await params).quizId);
  await requireQuizViewer(quizId);
  return <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-8">
    <Link href={`/quiz/${quizId}`} className="underline">Zurück zum Quiz</Link>
    <h1 className="text-3xl font-bold">Meme-Archiv</h1>
    <p>Bestätigte Memes bleiben nach einem Neustart erhalten. Löschen entfernt die gewählte Team-Abgabe einschließlich ihrer älteren Versionen.</p>
    <MemeArchivePanel quizId={quizId} />
  </main>;
}
