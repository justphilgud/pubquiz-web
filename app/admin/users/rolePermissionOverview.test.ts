import assert from "node:assert/strict";
import test from "node:test";
import { loadRoleMessages } from "@/app/i18n/roleMessages";
import {
  getRolePermissionMatrix,
  ROLE_PERMISSION_IDS,
  ROLE_PERMISSION_PROFILES,
} from "./rolePermissionOverview";

test("role overview contains every supported assignment profile", () => {
  assert.deepEqual(
    ROLE_PERMISSION_PROFILES.map((profile) => [profile.role, profile.scopeType]),
    [
      ["ADMIN", "GLOBAL"],
      ["EDITOR", "GLOBAL"],
      ["EDITOR", "EVENT_SERIES"],
      ["EVENT_MANAGER", "EVENT_SERIES"],
    ],
  );
});

test("permission matrix is derived from authorization policies", () => {
  const rows = Object.fromEntries(getRolePermissionMatrix().map((row) => [row.permissionId, row.accessByProfile]));
  assert.equal(rows.USERS.ADMIN_GLOBAL, "GLOBAL");
  assert.equal(rows.USERS.EDITOR_GLOBAL, "NONE");
  assert.equal(rows.EVENT_REVIEW.EDITOR_EVENT_SERIES, "NONE");
  assert.equal(rows.EVENT_REVIEW.EVENT_MANAGER_EVENT_SERIES, "ASSIGNED_EVENT_SERIES");
  assert.equal(rows.QUIZZES.EVENT_MANAGER_EVENT_SERIES, "ASSIGNED_EVENT_SERIES");
  assert.equal(rows.TEMPLATES.EVENT_MANAGER_EVENT_SERIES, "NONE");
  assert.equal(rows.TEAMS.ADMIN_GLOBAL, "GLOBAL");
  assert.equal(rows.TEAMS.EVENT_MANAGER_EVENT_SERIES, "ASSIGNED_EVENT_SERIES");
  assert.equal(rows.TEAMS.EDITOR_GLOBAL, "NONE");
});

test("every role profile and permission has localized explanatory text", () => {
  for (const locale of ["de", "en"] as const) {
    const overview = loadRoleMessages(locale).permissionOverview;
    for (const profile of ROLE_PERMISSION_PROFILES) {
      assert.ok(overview.profiles[profile.id]);
      assert.ok(overview.profileDescriptions[profile.id]);
    }
    for (const permission of ROLE_PERMISSION_IDS) assert.ok(overview.permissions[permission]);
  }
});
