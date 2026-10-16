import Link from "next/link";
import { readQuizDifficultyAudit } from "@/app/quiz/evaluation/difficultyAudit.server";

export default async function QuizDiagnosisPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const audit = await readQuizDifficultyAudit(Number(quizId));
  return <main className="mx-auto max-w-7xl space-y-4 p-4 text-slate-950 sm:p-8">
    <Link href={`/quiz/${quizId}`} className="underline">Zurück zum Quiz</Link>
    <h1 className="text-2xl font-bold">Schwierigkeitsprüfung · {audit.title}</h1>
    <p>Lesender Vergleich · {audit.observedAt}. Es werden keine Antworten neu bewertet oder gespeicherte Werte korrigiert.</p>
    <p>Bestehende Formel: Anteil nicht vollständig richtiger Antworten. PARTIAL zählt zu falsch; UNANSWERED und REVIEW_REQUIRED zählen nicht mit. Proben und archivierte Verwendungen sind weiterhin enthalten.</p>
    <p>„Mit Snapshot“ prüft bei Run-Antworten das Vorhandensein einer finalen Einreichung. Deren Inhalt und fachliche Bewertung werden nicht erneut geprüft. Historische Antworten ohne Run zählen wie bisher.</p>
    <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr>{["Frage / Zuweisung", "Template", "Gespeichert richtig / falsch", "Status richtig / falsch", "Mit Snapshot richtig / falsch", "Teil / unbeantwortet / Prüfung", "Global gespeichert / aus Zählern", "Fallzahl / Verwendungen", "Befund"].map(label => <th key={label} className="border p-2">{label}</th>)}</tr></thead>
      <tbody>{audit.rows.map(row => <tr key={row.assignment_id}>
        <td className="border p-2">#{row.question_id} / #{row.assignment_id}</td><td className="border p-2">{row.template}</td>
        <td className="border p-2">{row.stored_correct ?? "–"} / {row.stored_wrong ?? "–"}</td><td className="border p-2">{row.raw_correct} / {row.raw_wrong}</td><td className="border p-2">{row.submitted_correct} / {row.submitted_wrong}</td>
        <td className="border p-2">{row.partial} / {row.unanswered} / {row.review_required}</td><td className="border p-2">{row.stored_difficulty ?? "–"} / {row.global.difficulty ?? "–"}</td>
        <td className="border p-2">{row.global.sampleSize} / {row.usages}{row.global.sampleSize < 10 ? " · wenige Daten" : ""}</td>
        <td className="border p-2">{[row.counterMismatch && "Zählerabweichung", row.submissionMismatch && "Einreichungsabweichung", row.difficultyMismatch && "Globaler Wert abweichend", row.creativeOrPoll && "Kreativ-/Umfragewert gesondert prüfen"].filter(Boolean).join(" · ") || "Verglichene Zähler konsistent"}</td>
      </tr>)}</tbody></table></div>
  </main>;
}
