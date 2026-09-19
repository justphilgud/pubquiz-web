import Image from "next/image";
import Link from "next/link";
import { APP_BRAND } from "@/app/branding/appBrand";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <Image
          src={APP_BRAND.assets.mark}
          alt={APP_BRAND.name}
          width={660}
          height={720}
          priority
          className="mx-auto mb-6 h-28 w-auto object-contain"
        />

        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Fehler 404
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">
          Seite nicht gefunden
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Die angeforderte Seite existiert nicht oder ist nicht mehr verfügbar.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          Zur Startseite
        </Link>
      </section>
    </main>
  );
}
