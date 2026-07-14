import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/ui/Card";

type DashboardIcon = ComponentType<{ className?: string }>;
type DashboardTone = "slate" | "amber" | "emerald" | "sky";

const heroTones: Record<DashboardTone, string> = {
  slate: "border-slate-800 bg-slate-900 text-white",
  amber: "border-amber-300 bg-amber-50 text-slate-950",
  emerald: "border-emerald-300 bg-emerald-50 text-slate-950",
  sky: "border-sky-300 bg-sky-50 text-slate-950",
};

const statTones: Record<DashboardTone, string> = {
  slate: "bg-slate-100 text-slate-700",
  amber: "bg-amber-100 text-amber-800",
  emerald: "bg-emerald-100 text-emerald-800",
  sky: "bg-sky-100 text-sky-800",
};

export function DashboardHero({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  icon: Icon,
  tone = "slate",
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  icon: DashboardIcon;
  tone?: DashboardTone;
}) {
  const dark = tone === "slate";

  return (
    <section
      className={`overflow-hidden rounded-3xl border p-5 shadow-sm md:p-7 ${heroTones[tone]}`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className={`hidden rounded-2xl p-3 sm:block ${
              dark ? "bg-white/10" : "bg-white/70"
            }`}
          >
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p
              className={`text-sm font-semibold ${
                dark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              {eyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              {title}
            </h1>
            <p
              className={`mt-2 max-w-2xl text-sm leading-6 ${
                dark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              {description}
            </p>
          </div>
        </div>
        <Link
          href={actionHref}
          className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ${
            dark
              ? "bg-white text-slate-950 hover:bg-slate-100"
              : "bg-slate-900 text-white hover:bg-slate-700"
          }`}
        >
          {actionLabel}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export function QuickActionCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: DashboardIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-24 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
    >
      <span className="rounded-xl bg-slate-100 p-2 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-slate-900">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-slate-600">
          {description}
        </span>
      </span>
    </Link>
  );
}

export function StatCard({
  href,
  label,
  value,
  icon: Icon,
  tone = "slate",
}: {
  href: string;
  label: string;
  value: number;
  icon: DashboardIcon;
  tone?: DashboardTone;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
    >
      <span className={`rounded-xl p-2.5 ${statTones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-xl font-bold text-slate-900">{value}</span>
        <span className="block text-xs leading-4 text-slate-600">{label}</span>
      </span>
    </Link>
  );
}

export function DashboardPanel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`rounded-2xl p-5 md:p-6 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}
