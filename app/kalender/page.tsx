import type { Metadata } from "next";
import {
  PUBLIC_CALENDAR_FEED_PATH,
  PUBLIC_CALENDAR_NAME,
} from "@/app/calendar/publicCalendar";

export const metadata: Metadata = {
  title: "PubQuiz-Termine abonnieren | ungegoogelt",
  description: "Öffentliche ungegoogelt PubQuiz-Termine als Kalender abonnieren.",
};

export default function PublicCalendarPage() {
  return (
    <main className="min-h-dvh bg-slate-950 px-5 py-10 text-white sm:px-8 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
          ungegoogelt
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
          Kein PubQuiz mehr verpassen
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
          Abonniere unsere nächsten öffentlichen PubQuiz-Termine direkt in
          deinem Kalender. Neue veröffentlichte Termine erscheinen automatisch.
        </p>

        <section className="mt-10 rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl sm:p-8">
          <h2 className="text-2xl font-black">{PUBLIC_CALENDAR_NAME}</h2>
          <p className="mt-3 leading-7 text-slate-200">
            Öffne den Kalender-Link mit Apple Kalender, Outlook, Google Kalender
            oder einer anderen Kalender-App, die ICS-Abonnements unterstützt.
          </p>
          <a
            href={PUBLIC_CALENDAR_FEED_PATH}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-300 px-6 py-3 text-base font-black text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
          >
            PubQuiz-Kalender abonnieren
          </a>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Der Kalender enthält ausschließlich öffentliche, aktive und nicht
            archivierte Termine. Private Quizze und interne Veranstaltungen
            werden nicht veröffentlicht.
          </p>
        </section>

        <p className="mt-8 text-sm leading-6 text-slate-400">
          Tipp: Manche Kalenderprogramme laden die ICS-Datei zunächst herunter.
          Öffne sie anschließend mit deiner Kalender-App und wähle „Abonnieren“.
        </p>
      </div>
    </main>
  );
}
