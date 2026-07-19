export type AppNavigationItem = {
  href: string;
  label: string;
};

export type AppNavigationCapabilities = {
  canManageQuizzes: boolean;
  canManageEventSeries: boolean;
  canManageUsers: boolean;
};

export function getAppNavigationItems(
  capabilities: AppNavigationCapabilities,
): AppNavigationItem[] {
  return [
    { href: "/fragen", label: "Fragen" },
    ...(capabilities.canManageQuizzes
      ? [{ href: "/quiz", label: "Quiz" }]
      : []),
    ...(capabilities.canManageEventSeries
      ? [{ href: "/admin/eventreihen", label: "Eventreihen" }]
      : []),
    ...(capabilities.canManageUsers
      ? [{ href: "/admin/users", label: "Benutzerverwaltung" }]
      : []),
  ];
}

export function isAppNavigationItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
