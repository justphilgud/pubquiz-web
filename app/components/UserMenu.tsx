"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  Cog8ToothIcon,
  KeyIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { getUserInitials, getUserRoleLabel } from "@/app/lib/userDisplay";

type Props = {
  email: string;
  role: string;
  name?: string | null;
  isAdmin: boolean;
  logoutAction: () => Promise<void>;
};


function InitialsAvatar({
  name,
  email,
  size = "md",
}: {
  name?: string | null;
  email: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "h-11 w-11 text-sm"
      : size === "sm"
        ? "h-8 w-8 text-xs"
        : "h-9 w-9 text-sm";

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 transition`}
    >
      {getUserInitials(name, email)}
    </div>
  );
}

export default function UserMenu({
  email,
  role,
  name,
  isAdmin,
  logoutAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const displayName = name?.trim() || email;
  const roleLabel = getUserRoleLabel(role);
  const iconClass = "h-5 w-5 shrink-0 text-slate-600";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
      >
        <InitialsAvatar name={name} email={email} size="sm" />
        <ChevronDownIcon className="h-4 w-4 text-slate-500" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex gap-3 px-4 py-4">
            <InitialsAvatar name={name} email={email} size="lg" />

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">
                {displayName}
              </div>
              <div className="mt-0.5 truncate text-xs text-slate-500">
                {email}
              </div>
              <div className="mt-1 text-xs font-medium text-slate-500">
                {roleLabel}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 py-2">
            {isAdmin && (
              <Link
                href="/admin/users"
                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                <UsersIcon className={iconClass} />
                Benutzerverwaltung
              </Link>
            )}

            <Link
              href="/settings"
              className="flex items-center gap-3 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <Cog8ToothIcon className={iconClass} />
              Einstellungen
            </Link>

            <Link
              href="/password"
              className="flex items-center gap-3 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <KeyIcon className={iconClass} />
              Passwort ändern
            </Link>
          </div>

          <div className="border-t border-slate-100 py-2">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
              >
                <ArrowRightOnRectangleIcon className={iconClass} />
                Abmelden
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
