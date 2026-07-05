import { requireAdmin } from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import CreateUserDialog from "./CreateUserDialog";
import EditUserDialog from "./EditUserDialog";
import { getUserInitials, getUserRoleLabel } from "@/app/lib/userDisplay";
import { ArchiveUser } from "./ArchiveUser";
import { ReactivateUser } from "./ReactivateUser";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";

export default async function UsersPage() {
  await requireAdmin();

  const users = await prisma.users.findMany({
    orderBy: [
      { is_active: "desc" },
      { role: "asc" },
      { name: "asc" },
      { email: "asc" },
    ],
  });

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

          <CreateUserDialog />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                  {getUserInitials(user.name, user.email)}
                </div>

                <div>
                  <div className="font-semibold">{user.name || user.email}</div>
                  <div className="text-sm text-slate-500">{user.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {getUserRoleLabel(user.role)}
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

                  {user.is_active ? "Aktiv" : "Archiviert"}
                </span>

                <div className="flex items-center gap-2">
                  <EditUserDialog user={user} />

                  {user.is_active ? (
                    <ArchiveUser userId={user.id} />
                  ) : (
                    <ReactivateUser userId={user.id} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
