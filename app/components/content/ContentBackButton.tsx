"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { contentReturnHref } from "./contentNavigation";

export default function ContentBackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  const returnTo = useSearchParams().get("returnTo");
  return (
    <button type="button" onClick={() => {
      if (returnTo) { router.push(contentReturnHref(returnTo)); return; }
      if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
        router.back();
      } else {
        router.push(fallbackHref);
      }
    }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
      ← Zurück
    </button>
  );
}
