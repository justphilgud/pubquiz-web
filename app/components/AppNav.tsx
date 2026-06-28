"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

type Props = {
  items: NavItem[];
};

export default function AppNav({ items }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-7">
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "relative py-2 text-sm font-semibold text-slate-950 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-emerald-500"
                : "relative py-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
