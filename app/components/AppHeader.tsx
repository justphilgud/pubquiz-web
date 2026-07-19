import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import {
  canManageEventSeries,
  canManageQuizzes,
  canManageUsers,
  isAdmin,
} from "@/app/lib/permissions";
import UserMenu from "@/app/components/UserMenu";
import AppNav from "@/app/components/AppNav";
import { getAppNavigationItems } from "@/app/components/appNavigation";

export default async function AppHeader() {
  const session = await auth();

  if (!session?.user) return null;

  const admin = isAdmin(session);

  async function logoutAction() {
    "use server";

    await signOut({
      redirectTo: "/login",
    });
  }

  const navItems = getAppNavigationItems({
    canManageQuizzes: canManageQuizzes(session),
    canManageEventSeries: canManageEventSeries(session),
    canManageUsers: canManageUsers(session),
  });

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm md:px-6">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-12">
        <Link
          href="/"
          className="flex min-h-11 min-w-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          <Image
            src="/logo.png"
            alt="ungegoogelt"
            width={180}
            height={48}
            priority
            className="h-8 w-auto max-w-full sm:h-10"
          />
        </Link>

        <div className="col-span-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
          <AppNav items={navItems} />
        </div>

        <div className="col-start-2 row-start-1 shrink-0 md:col-start-3">
          <UserMenu
            email={session.user.email ?? ""}
            name={session.user.name}
            role={session.user.role}
            isAdmin={admin}
            logoutAction={logoutAction}
          />
        </div>
      </div>
    </header>
  );
}
