import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import {
  isAdmin,
} from "@/app/lib/permissions";
import UserMenu from "@/app/components/UserMenu";
import WorkspaceNavigation from "@/app/workspaces/WorkspaceNavigation";
import { loadWorkspaceNavigation } from "@/app/workspaces/workspace.server";
import { getNavigationCapabilities } from "@/app/workspaces/workspacePolicy";

import { getActorForSession } from "@/app/roles/roleAssignments.server";
import { hasGlobalRole } from "@/app/roles/roleAssignmentPolicy";
import { APP_BRAND } from "@/app/branding/appBrand";

export default async function AppHeader() {
  const session = await auth();

  if (!session?.user) return null;

  const actor = await getActorForSession(session);
  const admin = isAdmin(actor);
  const globalRoleLabel = [
    ...(admin ? ["Administrator"] : []),
    ...(hasGlobalRole(actor, "EDITOR") ? ["Globaler Editor"] : []),
  ].join(", ") || "Keine globale Rolle";

  async function logoutAction() {
    "use server";

    await signOut({
      redirectTo: "/login",
    });
  }

  const { choices } = await loadWorkspaceNavigation();

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm md:px-6">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-5">
        <Link
          href="/"
          className="flex min-h-11 min-w-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          <Image
            src={APP_BRAND.assets.mark}
            alt={APP_BRAND.name}
            width={660}
            height={720}
            priority
            className="h-10 w-auto sm:h-11"
          />
        </Link>

        <div className="col-span-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
          <WorkspaceNavigation capabilities={getNavigationCapabilities(actor, choices)} />
        </div>

        <div className="col-start-2 row-start-1 shrink-0 md:col-start-3">
          <UserMenu
            email={session.user.email ?? ""}
            name={session.user.name}
            roleLabel={globalRoleLabel}
            isAdmin={admin}
            logoutAction={logoutAction}
          />
        </div>
      </div>
    </header>
  );
}
