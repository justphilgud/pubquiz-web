export type AppNavigationItem = {
  href: string;
  label: string;
  children?: AppNavigationChild[];
};

export type AppNavigationChild = {
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
  canManageTeams: boolean;
};

export function getAppNavigationItems(
  capabilities: AppNavigationCapabilities,
): AppNavigationItem[] {
  return [
    ...(capabilities.canAccessQuestions || capabilities.canAccessStoryElements
      ? [{
          href: "/content",
          label: "Content",
          children: [
            { href: "/content", label: "Alle Inhalte" },
            ...(capabilities.canAccessQuestions
              ? [{ href: "/fragen", label: "Fragen" }]
              : []),
            ...(capabilities.canAccessStoryElements
              ? [
                  { href: "/story-elemente", label: "Story-Elemente" },
                  { href: "/content/polls", label: "Umfragen" },
                ]
              : []),
          ],
        }]
      : []),
    ...(capabilities.canManageEventSeries
      ? [{ href: "/admin/eventreihen", label: "Eventreihen" }]
      : []),
    ...(capabilities.canManageQuizzes
      ? [{ href: "/quiz", label: "Quiz" }]
      : []),
    ...(capabilities.canManageTeams
      ? [{ href: "/admin/teams", label: "Teams" }]
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
