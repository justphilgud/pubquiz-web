import { requireAdmin } from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import CreateUserDialog from "./CreateUserDialog";
import EditUserDialog from "./EditUserDialog";
import { getUserInitials } from "@/app/lib/userDisplay";
import { ArchiveUser } from "./ArchiveUser";
import { ReactivateUser } from "./ReactivateUser";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { getRoleAssignmentOptions } from "@/app/eventreihen/membershipActions";
import { countEventSeriesRoleAssignments } from "@/app/eventreihen/membershipPolicy";
import { loadRoleMessages } from "@/app/i18n/roleMessages";
import { getDefaultLocale } from "@/app/i18n/locale";
import { formatMessage } from "@/app/i18n/formatMessage";
import { getGlobalAssignmentRoles } from "./userOverviewPolicy";

export default async function UsersPage() {
  await requireAdmin();
  const locale = getDefaultLocale();
  const messages = loadRoleMessages(locale);

  const [users, assignmentData] = await Promise.all([
    prisma.users.findMany({
      orderBy: [
        { is_active: "desc" },
        { name: "asc" },
        { email: "asc" },
      ],
      select: {
        id: true,
        name: true,
        email: true,
        is_active: true,
        rollenzuweisungen: {
          where: { scope_typ: "GLOBAL" },
          select: {
            rolle: true,
            scope_typ: true,
            eventreihe_id: true,
          },
        },
      },
    }),
    getRoleAssignmentOptions(),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Benutzerverwaltung</h1>
            <p className="mt-2 text-slate-600">
              Verwalte Benutzer, Rollen und Zugriffsrechte.
            </p>
          </div>

          <CreateUserDialog
            eventSeries={assignmentData.eventSeries}
            locale={locale}
            messages={messages}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {users.map((user) => {
            const assignments = assignmentData.assignments.filter(
              (assignment) => assignment.userId === user.id,
            );
            const counts = countEventSeriesRoleAssignments(assignments);
            const globalRoles = getGlobalAssignmentRoles(user.rollenzuweisungen);
            return (
            <article
              key={user.id}
              className="border-b border-slate-100 px-4 py-4 last:border-b-0 sm:px-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                  {getUserInitials(user.name, user.email)}
                </div>

                <div>
                  <div className="font-semibold">{user.name || user.email}</div>
                  <div className="text-sm text-slate-500">{user.email}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {messages.fields.globalRoles}: {globalRoles.length > 0
                    ? globalRoles.map((role) => messages.assignmentRoles[role]).join(", ")
                    : messages.summaries.noGlobalRole}
                </span>

                <span
                  className={
                    user.is_active
                      ? "inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700"
                      : "inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                  }
                >
                  {user.is_active ? (
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircleIcon className="h-4 w-4 text-red-600" />
                  )}

                  {user.is_active
                    ? messages.status.active
                    : messages.status.archived}
                </span>

                <div className="flex items-center gap-2">
                  <EditUserDialog
                    user={{ ...user, globalRoles }}
                    assignmentData={assignmentData}
                    messages={messages}
                    locale={locale}
                  />

                  {user.is_active ? (
                    <ArchiveUser userId={user.id} />
                  ) : (
                    <ReactivateUser userId={user.id} />
                  )}
                </div>
                </div>
              </div>
              <div className="mt-3 text-sm text-slate-600">
                {assignments.length === 0 ? (
                  messages.summaries.noAssignment
                ) : (
                  <>
                    <p className="font-medium">
                      {assignments.length === 1
                        ? messages.summaries.oneAssignment
                        : formatMessage(messages.summaries.multipleAssignments, {
                            count: assignments.length,
                          })}
                    </p>
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {formatMessage(messages.summaries.managers, {
                        count: counts.EVENT_MANAGER,
                      })}
                      {" · "}
                      {formatMessage(messages.summaries.editors, {
                        count: counts.EDITOR,
                      })}
                    </p>
                  </>
                )}
              </div>
            </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
