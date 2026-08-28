"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  isAppNavigationItemActive,
  type AppNavigationItem,
} from "@/app/components/appNavigation";

type Props = {
  items: AppNavigationItem[];
};

const activeClassName = "relative flex min-h-11 min-w-0 items-center justify-center rounded-lg px-1 text-center text-xs font-bold text-slate-950 outline-none after:absolute after:bottom-1 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:text-sm md:px-0 md:after:bottom-0 md:after:left-0 md:after:right-0";
const inactiveClassName = "relative flex min-h-11 min-w-0 items-center justify-center rounded-lg px-1 text-center text-xs font-medium text-slate-600 outline-none transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:text-sm md:px-0 md:hover:bg-transparent";

function AppNavSubmenu({ item, active }: {
  item: AppNavigationItem;
  active: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!detailsRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && detailsRef.current?.open) {
        setOpen(false);
        detailsRef.current?.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <details
      ref={detailsRef}
      open={open}
      className="relative col-span-2 min-w-0 md:col-span-1"
    >
      <summary
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
        className={`${active ? activeClassName : inactiveClassName} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        {item.label}
        <span className="ml-1 text-[0.65rem]" aria-hidden>▾</span>
      </summary>
      <div className="mt-1 grid gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg md:absolute md:left-0 md:top-full md:z-50 md:mt-2 md:w-52">
        {item.children?.map((child) => (
          <Link
            key={child.href}
            href={child.href}
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-slate-700 outline-none transition hover:bg-slate-100 hover:text-slate-950 focus-visible:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600"
          >
            {child.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

export default function AppNav({ items }: Props) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hauptnavigation"
      className="grid min-w-0 grid-cols-2 gap-1 md:flex md:items-center md:gap-7"
    >
      {items.map((item) => {
        const active = isAppNavigationItemActive(pathname, item.href);

        if (item.children?.length) {
          return (
            <AppNavSubmenu
              key={item.href}
              item={item}
              active={active}
            />
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={active ? activeClassName : inactiveClassName}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
