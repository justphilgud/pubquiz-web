import Link from "next/link";
import { requireAdmin } from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import { getRoleAssignmentOptions } from "@/app/eventreihen/membershipActions";
import { loadRoleMessages } from "@/app/i18n/roleMessages";
import { getDefaultLocale } from "@/app/i18n/locale";
import { getGlobalAssignmentRoles } from "./userOverviewPolicy";
import { UserManagementList } from "./UserManagementList";
import CreateUserDialog from "./CreateUserDialog";

export default async function UsersPage() {
  await requireAdmin();
  const locale = getDefaultLocale();
  const messages = loadRoleMessages(locale);

  const [users, assignmentData] = await Promise.all([
    prisma.users.findMany({
      orderBy: [{ is_active: "desc" }, { name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        is_active: true,
        rollenzuweisungen: {
          select: { rolle: true, scope_typ: true, eventreihe_id: true },
        },
      },
    }),
    getRoleAssignmentOptions(),
  ]);

  const rows = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.is_active,
    globalRoles: getGlobalAssignmentRoles(user.rollenzuweisungen),
    roles: [...new Set(user.rollenzuweisungen.map((assignment) => assignment.rolle))],
    eventSeriesIds: [...new Set(user.rollenzuweisungen.flatMap((assignment) =>
      assignment.scope_typ === "EVENT_SERIES" && assignment.eventreihe_id !== null
        ? [assignment.eventreihe_id]
        : [],
    ))],
  }));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Benutzerverwaltung</h1>
            <p className="mt-2 text-slate-600">Verwalte Benutzer, Rollen und Zugriffsrechte.</p>
            <Link
              href="/admin/users/roles"
              className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
            >
              {messages.permissionOverview.title}
            </Link>
          </div>
          <CreateUserDialog eventSeries={assignmentData.eventSeries} locale={locale} messages={messages} />
        </div>

        <UserManagementList
          users={rows}
          assignmentData={assignmentData}
          locale={locale}
          messages={messages}
        />
      </div>
    </main>
  );
}
