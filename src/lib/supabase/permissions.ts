import "server-only";

import { getCurrentUser } from "./auth";
import { createSupabaseServerClient } from "./server";
import {
  createPermissionAssignmentHelpers,
  createPermissionHelpers,
} from "./permissions-core";
import {
  PermissionDeniedError,
  PermissionVerificationError,
} from "./permissions-core";

const permissionHelpers = createPermissionHelpers(
  async () => {
    const user = await getCurrentUser();

    if (!user) {
      return null;
    }

    const supabase = await createSupabaseServerClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    return {
      userId: user.id,
      profile,
      loadPermissions: async (userId: string) => {
        const { data, error } = await supabase
          .from("module_permissions")
          .select(
            "id, user_id, module_name, can_view, can_add, can_edit, can_delete, created_at, updated_at",
          )
          .eq("user_id", userId);

        if (error) {
          throw error;
        }

        return data;
      },
    };
  },
  () => {
    console.error("Current user's permissions could not be verified.");
  },
);

const permissionAssignmentHelpers = createPermissionAssignmentHelpers(
  permissionHelpers.requireApprovedSuperadmin,
  async (userId, moduleName) => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("module_permissions")
      .select(
        "id, user_id, module_name, can_view, can_add, can_edit, can_delete, created_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("module_name", moduleName)
      .maybeSingle();

    if (error) {
      console.error("Selected user's module permission could not be loaded.");
      throw new PermissionVerificationError();
    }

    return data;
  },
  async (userId, moduleName, flags) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("set_module_permissions", {
      p_user_id: userId,
      p_module_name: moduleName,
      p_can_view: flags.can_view,
      p_can_add: flags.can_add,
      p_can_edit: flags.can_edit,
      p_can_delete: flags.can_delete,
    });

    if (error?.code === "42501") {
      throw new PermissionDeniedError();
    }

    if (error) {
      console.error("Selected user's module permission could not be saved.");
      throw new PermissionVerificationError();
    }
  },
);

export const getCurrentUserPermissions =
  permissionHelpers.getCurrentUserPermissions;
export const getCurrentUserPermissionSummary =
  permissionHelpers.getCurrentUserPermissionSummary;
export const canCurrentUserPerform =
  permissionHelpers.canCurrentUserPerform;
export const requireCurrentUserPermission =
  permissionHelpers.requireCurrentUserPermission;
export const requireCurrentUserModulePermission =
  permissionHelpers.requireCurrentUserModulePermission;
export const requireApprovedSuperadmin =
  permissionHelpers.requireApprovedSuperadmin;

export const getUserModulePermission =
  permissionAssignmentHelpers.getUserModulePermission;
export const saveUserModulePermission =
  permissionAssignmentHelpers.saveUserModulePermission;

export type {
  PermissionAction,
  PermissionFlags,
  PermissionModule,
  PermissionRecord,
  CurrentUserPermissionSummary,
} from "./permissions-core";
export {
  getVisibleModulesForUser,
  isExistingAccountAccessActionAllowed,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  PermissionDeniedError,
  PermissionVerificationError,
  PermissionInputError,
} from "./permissions-core";
