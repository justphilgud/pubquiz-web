import type { RoleAssignmentRoleValue } from "@/app/roles/roleAssignmentPolicy";

export type UserStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
export type UserEventSeriesFilter = "ALL" | "NONE" | number;
export type UserRoleFilter = "ALL" | RoleAssignmentRoleValue;

export type UserListFilters = {
  query: string;
  eventSeries: UserEventSeriesFilter;
  role: UserRoleFilter;
  status: UserStatusFilter;
};

export type FilterableUser = {
  name: string | null;
  email: string;
  isActive: boolean;
  roles: readonly RoleAssignmentRoleValue[];
  eventSeriesIds: readonly number[];
};

export const EMPTY_USER_LIST_FILTERS: UserListFilters = {
  query: "",
  eventSeries: "ALL",
  role: "ALL",
  status: "ALL",
};

function includesSearchValue(value: string, query: string, locale: string) {
  return value.toLocaleLowerCase(locale).includes(query);
}

export function filterUsers<T extends FilterableUser>(
  users: readonly T[],
  filters: UserListFilters,
  locale = "de",
): T[] {
  const query = filters.query.trim().toLocaleLowerCase(locale);

  return users.filter((user) => {
    const matchesQuery = query.length === 0 ||
      includesSearchValue(user.name ?? "", query, locale) ||
      includesSearchValue(user.email, query, locale);
    const matchesEventSeries = filters.eventSeries === "ALL" ||
      (filters.eventSeries === "NONE"
        ? user.eventSeriesIds.length === 0
        : user.eventSeriesIds.includes(filters.eventSeries));
    const matchesRole = filters.role === "ALL" || user.roles.includes(filters.role);
    const matchesStatus = filters.status === "ALL" ||
      (filters.status === "ACTIVE" ? user.isActive : !user.isActive);

    return matchesQuery && matchesEventSeries && matchesRole && matchesStatus;
  });
}

export function hasActiveUserFilters(filters: UserListFilters) {
  return filters.query.trim().length > 0 ||
    filters.eventSeries !== "ALL" ||
    filters.role !== "ALL" ||
    filters.status !== "ALL";
}
