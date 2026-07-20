import type { WidenMessageCatalog } from "../../messageTypes";
import type { deRoleMessages } from "../de/roles";

export const enRoleMessages: WidenMessageCatalog<typeof deRoleMessages> = {
  globalRoles: {
    USER: "User",
    EDITOR: "Editor",
    ADMIN: "Administrator",
  },
  globalRoleDescriptions: {
    USER: "No global functional role",
    EDITOR: "Global editorial role",
    ADMIN: "Global administration",
  },
  eventSeriesRoles: {
    EVENT_MANAGER: "Event manager",
    EVENT_EDITOR: "Event editor",
  },
  fields: {
    globalRole: "Global role",
    accountStatus: "Account status",
    eventSeriesAccess: "Event series access",
    access: "Access",
    eventSeries: "Event series",
    eventSeriesRole: "Role in the event series",
    assignments: "Event series assignments",
    filteredByEventSeries: "Filtered by event series",
  },
  status: {
    active: "Active",
    archived: "Archived",
  },
  actions: {
    edit: "Edit",
    addEventSeries: "Add event series",
    addAssignment: "Add assignment",
    changeRole: "Change role",
    removeAssignment: "Remove assignment",
    editInUserManagement: "Edit in user management",
    cancel: "Cancel",
    confirmRemove: "Confirm removal",
    removeFilter: "Remove filter",
  },
  summaries: {
    noAssignment: "No event series assignment",
    oneAssignment: "1 event series assignment",
    multipleAssignments: "{count} event series assignments",
    managers: "Event manager in {count} series",
    editors: "Event editor in {count} series",
    accessManagers: "{count} event managers",
    accessEditors: "{count} event editors",
  },
  messages: {
    duplicateAssignment: "This user is already assigned to the event series.",
    addSuccess: "Event series assignment was added.",
    changeSuccess: "Role was changed.",
    removeSuccess: "Event series assignment was removed.",
    removeQuestion: "Do you really want to remove this event series assignment?",
    noAvailableSeries: "All active event series are already assigned.",
    noManagerWarning: "This event series will no longer have an event manager.",
  },
};
