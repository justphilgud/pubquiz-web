import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { isAdmin } from "@/app/lib/permissions";
import UserMenu from "@/app/components/UserMenu";
import AppNav from "@/app/components/AppNav";

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

  const navItems = [
    { href: "/fragen", label: "Fragen" },
    ...(admin
      ? [
          { href: "/quiz", label: "Quiz" },
          { href: "/admin/users", label: "Benutzer" },
        ]
      : []),
  ];

  return (
    <header className="border-b border-slate-200 bg-white px-6 py-3 text-slate-900 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
        <nav className="flex items-center gap-12">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="ungegoogelt"
              width={180}
              height={48}
              priority
              className="h-10 w-auto"
            />
          </Link>

          <AppNav items={navItems} />
        </nav>

        <UserMenu
          email={session.user.email ?? ""}
          name={session.user.name}
          role={session.user.role}
          isAdmin={admin}
          logoutAction={logoutAction}
        />
      </div>
    </header>
  );
}
