import Link from "next/link";
import FragenImportClient from "./FragenImportClient";

export default function FragenImportPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Fragen
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Fragen importieren und verwalten.
            </p>
          </div>

          <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <Link
              href="/fragen"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Neue Frage
            </Link>

            <Link
              href="/fragen?tab=suche"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Suche
            </Link>

            <Link
              href="/fragen/import"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Massenupload
            </Link>
          </div>
        </div>

        <FragenImportClient />
      </div>
    </main>
  );
}