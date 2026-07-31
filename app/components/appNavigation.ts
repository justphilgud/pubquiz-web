export type AppNavigationItem = {
  href: string;
  label: string;
};

export type AppNavigationCapabilities = {
  canAccessQuestions: boolean;
  canManageQuizzes: boolean;
  canManageEventSeries: boolean;
  canViewPresentationTemplates: boolean;
  canManageCategories: boolean;
  canManageUsers: boolean;
};

export function getAppNavigationItems(
  capabilities: AppNavigationCapabilities,
): AppNavigationItem[] {
  return [
    ...(capabilities.canAccessQuestions
      ? [{ href: "/fragen", label: "Fragen" }]
      : []),
    ...(capabilities.canManageEventSeries
      ? [{ href: "/admin/eventreihen", label: "Eventreihen" }]
      : []),
    ...(capabilities.canManageQuizzes
      ? [{ href: "/quiz", label: "Quiz" }]
      : []),
    ...(capabilities.canViewPresentationTemplates
      ? [{ href: "/templates", label: "Templates" }]
      : []),
    ...(capabilities.canManageUsers
      ? [{ href: "/admin/users", label: "Benutzer" }]
      : []),
  ];
}

export function isAppNavigationItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
