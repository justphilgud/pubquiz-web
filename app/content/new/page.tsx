import Link from "next/link";
import ContentEditorHeader from "@/app/components/content/ContentEditorHeader";
import { requireQuestionEditor } from "@/app/lib/permissions";

export default async function NewContentPage() {
  await requireQuestionEditor();
  return <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8"><div className="mx-auto max-w-4xl space-y-6"><ContentEditorHeader title="Neuen Inhalt erstellen" description="Wähle, ob der Inhalt bewertet wird oder die Quizgeschichte ergänzt." />
    <div className="grid gap-4 md:grid-cols-2"><Link href="/fragen/editor" className="rounded-2xl border border-cyan-200 bg-cyan-50 p-6 text-cyan-950 transition hover:border-cyan-500"><strong className="text-xl">Frage</strong><p className="mt-2 text-sm">Bewertbarer Inhalt mit Antwort, Punkten und Lösung.</p></Link><Link href="/story-elemente/new" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 transition hover:border-emerald-500"><strong className="text-xl">Story-Element</strong><p className="mt-2 text-sm">Nicht bewerteter Inhalt wie Bild, Anekdote, Zitat, Audio oder Video.</p></Link></div>
  </div></main>;
}
