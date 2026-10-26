"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminAppearanceContext } from "./AdminAppearanceContext";
import { isAdministrationPath } from "./adminAppearancePolicy";
/** Visual boundary only; server children retain their own authorization and state. */
export default function AdminAppearance({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (!isAdministrationPath(path)) return children;
  return <AdminAppearanceContext.Provider value={true}><div data-admin-ui="phil-gud" className="min-h-dvh flex flex-1 flex-col">{children}</div></AdminAppearanceContext.Provider>;
}
