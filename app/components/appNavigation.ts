export type AppNavigationItem = {
  href: string;
  label: string;
};

export type AppNavigationCapabilities = {
  canAccessQuestions: boolean;
  canAccessStoryElements: boolean;
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
    ...(capabilities.canAccessQuestions || capabilities.canAccessStoryElements
      ? [{ href: "/content", label: "Content" }]
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
  if (href === "/content") {
    return ["/content", "/fragen", "/story-elemente"].some(
      (contentRoot) => pathname === contentRoot || pathname.startsWith(`${contentRoot}/`),
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
