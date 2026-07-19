"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isAppNavigationItemActive,
  type AppNavigationItem,
} from "@/app/components/appNavigation";

type Props = {
  items: AppNavigationItem[];
};

export default function AppNav({ items }: Props) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hauptnavigation"
      className="grid min-w-0 grid-cols-2 gap-1 md:flex md:items-center md:gap-7"
    >
      {items.map((item) => {
        const active = isAppNavigationItemActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "relative flex min-h-11 min-w-0 items-center justify-center rounded-lg px-1 text-center text-xs font-bold text-slate-950 outline-none after:absolute after:bottom-1 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:text-sm md:px-0 md:after:bottom-0 md:after:left-0 md:after:right-0"
                : "relative flex min-h-11 min-w-0 items-center justify-center rounded-lg px-1 text-center text-xs font-medium text-slate-600 outline-none transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:text-sm md:px-0 md:hover:bg-transparent"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
