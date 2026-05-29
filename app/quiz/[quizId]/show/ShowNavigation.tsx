"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  href: string;
};

export function ShowNavigation({ href }: Props) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        router.push(href);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [href, router]);

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="absolute bottom-6 right-6 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white/30 transition hover:border-white/60 hover:bg-white/10 hover:text-white"
      title="Weiter mit Enter oder Leertaste"
    >
      Weiter
    </button>
  );
}