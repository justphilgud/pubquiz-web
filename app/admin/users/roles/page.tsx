import Link from "next/link";
import { requireAdmin } from "@/app/lib/permissions";
import { getDefaultLocale } from "@/app/i18n/locale";
import { loadRoleMessages } from "@/app/i18n/roleMessages";
import {
  getRolePermissionMatrix,
  ROLE_PERMISSION_PROFILES,
  type RolePermissionAccess,
} from "../rolePermissionOverview";

function AccessCell({
  access,
  label,
}: {
  access: RolePermissionAccess;
  label: string;
}) {
  const granted = access !== "NONE";
  return (
    <span
      className={granted ? "inline-flex items-center gap-1.5 text-emerald-800" : "inline-flex items-center gap-1.5 text-slate-500"}
      title={label}
    >
      <span aria-hidden="true" className="font-bold">{granted ? "✓" : "–"}</span>
      <span className="text-xs font-medium">{label}</span>
    </span>
  );
}

export default async function RolesAndPermissionsPage() {
  await requireAdmin();
  const messages = loadRoleMessages(getDefaultLocale());
  const overview = messages.permissionOverview;
  const matrix = getRolePermissionMatrix();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/users" className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline">
          ← {overview.backToUsers}
        </Link>
        <div className="mt-5 max-w-3xl">
          <h1 className="text-3xl font-bold">{overview.title}</h1>
          <p className="mt-2 text-slate-600">{overview.introduction}</p>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={overview.title}>
          {ROLE_PERMISSION_PROFILES.map((profile) => (
            <article key={profile.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-bold">{overview.profiles[profile.id]}</h2>
              <p className="mt-1 text-sm text-slate-600">{overview.profileDescriptions[profile.id]}</p>
            </article>
          ))}
        </section>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[980px] w-full border-collapse text-left">
            <thead className="bg-slate-100 text-sm">
              <tr>
                <th className="px-4 py-3 font-semibold">{overview.area}</th>
                {ROLE_PERMISSION_PROFILES.map((profile) => (
                  <th key={profile.id} className="px-4 py-3 font-semibold">{overview.profiles[profile.id]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.permissionId} className="border-t border-slate-200 align-top">
                  <th scope="row" className="px-4 py-3 text-sm font-medium">{overview.permissions[row.permissionId]}</th>
                  {ROLE_PERMISSION_PROFILES.map((profile) => {
                    const access = row.accessByProfile[profile.id];
                    return (
                      <td key={profile.id} className="px-4 py-3">
                        <AccessCell access={access} label={overview.access[access]} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 max-w-4xl text-sm text-slate-600">{overview.sourceNote}</p>
      </div>
    </main>
  );
}
