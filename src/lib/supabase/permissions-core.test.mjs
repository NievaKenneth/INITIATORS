import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPermissionAssignmentHelpers,
  createPermissionHelpers,
  getVisibleModulesForUser,
  isExistingAccountAccessActionAllowed,
  PermissionDeniedError,
  PermissionInputError,
  PermissionVerificationError,
} from "./permissions-core.ts";

const userId = "user-123";
const permission = {
  id: "permission-1",
  user_id: userId,
  module_name: "users",
  can_view: true,
  can_add: true,
  can_edit: false,
  can_delete: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function makeHelpers({
  profile = { role: "user", status: "approved" },
  permissions = [permission],
  loadContextError,
  loadPermissionsError,
} = {}) {
  let permissionLoadCount = 0;
  let verificationErrorCount = 0;
  const helpers = createPermissionHelpers(
    async () => {
      if (loadContextError) {
        throw loadContextError;
      }

      if (profile === null) {
        return null;
      }

      return {
        userId,
        profile,
        async loadPermissions(requestedUserId) {
          assert.equal(requestedUserId, userId);
          permissionLoadCount += 1;

          if (loadPermissionsError) {
            throw loadPermissionsError;
          }

          return permissions;
        },
      };
    },
    () => {
      verificationErrorCount += 1;
    },
  );

  return {
    ...helpers,
    getPermissionLoadCount: () => permissionLoadCount,
    getVerificationErrorCount: () => verificationErrorCount,
  };
}

test("allows an action whose per-user flag is true", async () => {
  const helpers = makeHelpers();
  assert.equal(await helpers.canCurrentUserPerform("users", "can_add"), true);
});

test("denies an action whose per-user flag is false", async () => {
  const helpers = makeHelpers();
  assert.equal(await helpers.canCurrentUserPerform("users", "can_edit"), false);
});

test("denies when no permission record exists", async () => {
  const helpers = makeHelpers({ permissions: [] });
  assert.equal(await helpers.canCurrentUserPerform("users", "can_view"), false);
});

test("denies and records permission lookup failures", async () => {
  const helpers = makeHelpers({
    loadPermissionsError: new Error("database unavailable"),
  });
  assert.equal(await helpers.canCurrentUserPerform("users", "can_view"), false);
  assert.equal(helpers.getVerificationErrorCount(), 1);
  await assert.rejects(
    helpers.getCurrentUserPermissions(),
    PermissionVerificationError,
  );
});

test("rejects invalid modules and actions without loading permissions", async () => {
  const helpers = makeHelpers();
  assert.equal(await helpers.canCurrentUserPerform("reports", "can_view"), false);
  assert.equal(await helpers.canCurrentUserPerform("users", "view"), false);
  assert.equal(helpers.getPermissionLoadCount(), 0);
});

test("denies unauthenticated and unapproved users", async () => {
  const unauthenticated = makeHelpers({ profile: null });
  assert.equal(
    await unauthenticated.canCurrentUserPerform("users", "can_view"),
    false,
  );
  await assert.rejects(
    unauthenticated.getCurrentUserPermissions(),
    PermissionDeniedError,
  );

  const unapproved = makeHelpers({
    profile: { role: "superadmin", status: "pending" },
  });
  assert.equal(
    await unapproved.canCurrentUserPerform("users", "can_view"),
    false,
  );
  assert.equal(unapproved.getPermissionLoadCount(), 0);
});

test("requires trusted approved superadmin profile data", async () => {
  const superadmin = makeHelpers({
    profile: { role: "superadmin", status: "approved" },
  });
  await assert.doesNotReject(superadmin.requireApprovedSuperadmin());

  const admin = makeHelpers({
    profile: { role: "admin", status: "approved" },
  });
  await assert.rejects(admin.requireApprovedSuperadmin(), PermissionDeniedError);
  await assert.rejects(
    admin.requireApprovedSuperadmin("superadmin"),
    PermissionDeniedError,
  );
});

test("rejects permission rows that do not belong to the authenticated user", async () => {
  const helpers = makeHelpers({
    permissions: [{ ...permission, user_id: "another-user" }],
  });
  assert.equal(await helpers.canCurrentUserPerform("users", "can_view"), false);
  assert.equal(helpers.getVerificationErrorCount(), 1);
});

test("denies malformed permission records", async () => {
  const helpers = makeHelpers({
    permissions: [{ ...permission, can_view: "true" }],
  });
  assert.equal(await helpers.canCurrentUserPerform("users", "can_view"), false);
  assert.equal(helpers.getVerificationErrorCount(), 1);
});

test("denies when authenticated identity or profile lookup cannot be verified", async () => {
  const helpers = makeHelpers({
    loadContextError: new Error("profile lookup failed"),
  });
  assert.equal(await helpers.canCurrentUserPerform("users", "can_view"), false);
  assert.equal(helpers.getVerificationErrorCount(), 1);
});

test("requires can_view, can_add, and can_edit for the corresponding operations", async () => {
  const permissions = [
    { ...permission, can_view: true, can_add: false, can_edit: false },
  ];
  const helpers = makeHelpers({ permissions });
  await assert.doesNotReject(
    helpers.requireCurrentUserModulePermission("users", "can_view"),
  );
  await assert.rejects(
    helpers.requireCurrentUserModulePermission("users", "can_add"),
    PermissionDeniedError,
  );
  await assert.rejects(
    helpers.requireCurrentUserModulePermission("users", "can_edit"),
    PermissionDeniedError,
  );

  const addUser = makeHelpers({
    permissions: [{ ...permission, can_view: false, can_add: true }],
  });
  await assert.doesNotReject(
    addUser.requireCurrentUserModulePermission("users", "can_add"),
  );

  const editUser = makeHelpers({
    profile: { role: "user", status: "approved" },
    permissions: [{ ...permission, can_view: false, can_edit: true }],
  });
  await assert.doesNotReject(
    editUser.requireCurrentUserModulePermission("users", "can_edit"),
  );
});

test("missing records and permission lookup errors deny module access", async () => {
  const missing = makeHelpers({ permissions: [] });
  await assert.rejects(
    missing.requireCurrentUserModulePermission("users", "can_view"),
    PermissionDeniedError,
  );

  const failed = makeHelpers({
    loadPermissionsError: new Error("database unavailable"),
  });
  await assert.rejects(
    failed.requireCurrentUserModulePermission("users", "can_add"),
    PermissionVerificationError,
  );
});

test("unapproved and unauthenticated callers cannot use module permission checks", async () => {
  const unauthenticated = makeHelpers({ profile: null });
  await assert.rejects(
    unauthenticated.requireCurrentUserModulePermission("users", "can_view"),
    PermissionDeniedError,
  );

  const pending = makeHelpers({
    profile: { role: "admin", status: "pending" },
  });
  await assert.rejects(
    pending.requireCurrentUserModulePermission("users", "can_view"),
    PermissionDeniedError,
  );
});

test("client-supplied role and permission claims cannot bypass server checks", async () => {
  const user = makeHelpers({ permissions: [] });
  await assert.rejects(
    user.requireCurrentUserModulePermission("users", "can_view", {
      role: "superadmin",
      can_view: true,
    }),
    PermissionDeniedError,
  );
});

test("approved superadmins preserve management access without permission defaults", async () => {
  const superadmin = makeHelpers({
    profile: { role: "superadmin", status: "approved" },
    loadPermissionsError: new Error("permission table unavailable"),
  });
  await assert.doesNotReject(
    superadmin.requireCurrentUserModulePermission("users", "can_view"),
  );
  await assert.doesNotReject(
    superadmin.requireCurrentUserModulePermission("users", "can_add"),
  );
});

test("module visibility uses per-user view permissions for admins and users", () => {
  const allowed = [{ ...permission, can_view: true }];
  const denied = [{ ...permission, can_view: false }];

  assert.deepEqual(getVisibleModulesForUser("superadmin", userId, []), [
    "users",
  ]);
  assert.deepEqual(getVisibleModulesForUser("admin", userId, allowed), [
    "users",
  ]);
  assert.deepEqual(getVisibleModulesForUser("user", userId, allowed), [
    "users",
  ]);
  assert.deepEqual(getVisibleModulesForUser("admin", userId, denied), []);
  assert.deepEqual(getVisibleModulesForUser("user", userId, []), []);
});

test("module visibility denies missing, malformed, mismatched, or unverifiable data", () => {
  assert.deepEqual(getVisibleModulesForUser("user", userId, null), []);
  assert.deepEqual(
    getVisibleModulesForUser("user", userId, [
      { ...permission, can_view: "true" },
    ]),
    [],
  );
  assert.deepEqual(
    getVisibleModulesForUser("user", userId, [
      { ...permission, user_id: "another-user" },
    ]),
    [],
  );
  assert.deepEqual(getVisibleModulesForUser("unknown", userId, [permission]), []);
  assert.deepEqual(getVisibleModulesForUser("user", "", [permission]), []);
});

test("permission lookup failures do not produce dashboard module tiles", async () => {
  const failedLookup = makeHelpers({
    loadPermissionsError: new Error("permission service unavailable"),
  });

  await assert.rejects(
    failedLookup.getCurrentUserPermissionSummary(),
    PermissionVerificationError,
  );
});

test("current-user API summary exposes server-derived visible modules", async () => {
  const allowed = makeHelpers({
    profile: {
      role: "admin",
      status: "approved",
      full_name: "Casey Example",
    },
    permissions: [{ ...permission, can_view: true }],
  });
  const allowedSummary = await allowed.getCurrentUserPermissionSummary();

  assert.equal(allowedSummary.userId, userId);
  assert.equal(allowedSummary.role, "admin");
  assert.equal(allowedSummary.fullName, "Casey Example");
  assert.deepEqual(allowedSummary.visibleModules, ["users"]);

  const missing = makeHelpers({
    profile: { role: "user", status: "approved" },
    permissions: [],
  });
  const missingSummary = await missing.getCurrentUserPermissionSummary();

  assert.equal(missingSummary.fullName, null);
  assert.deepEqual(missingSummary.visibleModules, []);
});

test("client-side role spoofing cannot bypass the server page permission check", async () => {
  assert.deepEqual(getVisibleModulesForUser("superadmin", userId, []), [
    "users",
  ]);

  const user = makeHelpers({
    profile: { role: "user", status: "approved" },
    permissions: [],
  });
  await assert.rejects(
    user.requireCurrentUserModulePermission("users", "can_view"),
    PermissionDeniedError,
  );
});

test("normal permission cannot grant approval or role-assignment authority", async () => {
  const userWithEdit = makeHelpers({
    profile: { role: "user", status: "approved" },
    permissions: [{ ...permission, can_edit: true }],
  });
  await assert.doesNotReject(
    userWithEdit.requireCurrentUserModulePermission("users", "can_edit"),
  );

  for (const action of ["approve", "reject", "set_role", "block", "unblock"]) {
    assert.equal(isExistingAccountAccessActionAllowed("user", action), false);
  }
  assert.equal(isExistingAccountAccessActionAllowed("admin", "block"), true);
  assert.equal(isExistingAccountAccessActionAllowed("admin", "approve"), false);
  assert.equal(isExistingAccountAccessActionAllowed("superadmin", "set_role"), true);
});

function makeAssignmentHelpers({
  role = "superadmin",
  status = "approved",
  record = permission,
  saveError,
} = {}) {
  const saved = [];
  let loadCount = 0;
  const identity = createPermissionHelpers(
    async () => ({
      userId: "admin-user",
      profile: { role, status },
      loadPermissions: async () => [],
    }),
    () => {},
  );
  const helpers = createPermissionAssignmentHelpers(
    identity.requireApprovedSuperadmin,
    async (targetUserId, moduleName) => {
      loadCount += 1;
      assert.equal(targetUserId, "target-user");
      assert.equal(moduleName, "users");
      return record;
    },
    async (targetUserId, moduleName, flags) => {
      if (saveError) {
        throw saveError;
      }

      saved.push({ targetUserId, moduleName, flags });
    },
  );

  return {
    ...helpers,
    saved,
    getLoadCount: () => loadCount,
  };
}

test("approved superadmin can load and save selected-user permissions", async () => {
  const helpers = makeAssignmentHelpers({
    record: { ...permission, user_id: "target-user" },
  });
  const loaded = await helpers.getUserModulePermission("target-user", "users");

  assert.equal(loaded.user_id, "target-user");
  await helpers.saveUserModulePermission("target-user", "users", {
    can_view: true,
    can_add: false,
    can_edit: true,
    can_delete: false,
  });
  assert.deepEqual(helpers.saved, [
    {
      targetUserId: "target-user",
      moduleName: "users",
      flags: {
        can_view: true,
        can_add: false,
        can_edit: true,
        can_delete: false,
      },
    },
  ]);
});

test("admins and regular users cannot load or save permission assignments", async () => {
  for (const role of ["admin", "user"]) {
    const helpers = makeAssignmentHelpers({ role });
    await assert.rejects(
      helpers.getUserModulePermission("target-user", "users"),
      PermissionDeniedError,
    );
    await assert.rejects(
      helpers.saveUserModulePermission("target-user", "users", permission),
      PermissionDeniedError,
    );
    assert.equal(helpers.getLoadCount(), 0);
    assert.deepEqual(helpers.saved, []);
  }

  const pendingSuperadmin = makeAssignmentHelpers({ status: "pending" });
  await assert.rejects(
    pendingSuperadmin.getUserModulePermission("target-user", "users"),
    PermissionDeniedError,
  );
  assert.equal(pendingSuperadmin.getLoadCount(), 0);
});

test("missing target permission records are represented as null", async () => {
  const helpers = makeAssignmentHelpers({ record: null });
  assert.equal(
    await helpers.getUserModulePermission("target-user", "users"),
    null,
  );
});

test("invalid module names and permission values are rejected before saving", async () => {
  const helpers = makeAssignmentHelpers();
  await assert.rejects(
    helpers.saveUserModulePermission("target-user", "reports", permission),
    PermissionInputError,
  );
  await assert.rejects(
    helpers.saveUserModulePermission("target-user", "users", {
      ...permission,
      can_add: "true",
    }),
    PermissionInputError,
  );
  assert.deepEqual(helpers.saved, []);
});

test("RPC failures propagate as errors and are never reported as success", async () => {
  const helpers = makeAssignmentHelpers({
    saveError: new PermissionVerificationError("RPC rejected the request."),
  });
  await assert.rejects(
    helpers.saveUserModulePermission("target-user", "users", permission),
    PermissionVerificationError,
  );
  assert.deepEqual(helpers.saved, []);
});

test("permission loads reject records belonging to another selected user", async () => {
  const helpers = makeAssignmentHelpers({
    record: { ...permission, user_id: "different-user" },
  });
  await assert.rejects(
    helpers.getUserModulePermission("target-user", "users"),
    PermissionVerificationError,
  );
});
