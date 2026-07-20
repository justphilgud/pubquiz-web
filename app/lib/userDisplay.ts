export function getUserInitials(
  name: string | null | undefined,
  email: string,
) {
  const trimmedName = name?.trim();

  if (trimmedName) {
    return trimmedName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  return email.slice(0, 2).toUpperCase();
}

export function getUserRoleLabel(role: string) {
  switch (role) {
    case "ADMIN":
      return "Administrator";
    case "EDITOR":
      return "Globaler Editor";
    case "USER":
      return "Keine globale Rolle";
    default:
      return role;
  }
}
