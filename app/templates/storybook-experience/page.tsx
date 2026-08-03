import type { Metadata } from "next";
import Link from "next/link";

import AppHeader from "@/app/components/AppHeader";
import { requireAdmin } from "@/app/lib/permissions";
import { StorybookExperiencePlayer } from "./StorybookExperiencePlayer";

export const metadata: Metadata = {
  title: "Storybook Experience Player",
  robots: { index: false, follow: false },
};

export default async function StorybookExperiencePage() {
  await requireAdmin();

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
        <div className="mx-auto max-w-[110rem] space-y-6">
          <header>
            <Link href="/templates" className="text-sm font-semibold text-slate-600">← Zur Templateverwaltung</Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">Storybook Experience Player</h1>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-rose-900">Intern</span>
            </div>
            <p className="mt-2 max-w-4xl text-slate-600">Ein vollständiger Quizabend als dramaturgische Reise. Dieser Player simuliert Einstieg, Kapitel, Fragen, Auflösungen, Pausen und emotionale Höhepunkte – ohne Daten zu speichern.</p>
          </header>
          <StorybookExperiencePlayer />
        </div>
      </main>
    </>
  );
}
