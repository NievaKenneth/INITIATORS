export const PERMISSION_MODULES = ["users"] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = [
  "can_view",
  "can_add",
  "can_edit",
  "can_delete",
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type UserRole = "superadmin" | "admin" | "user";
export type ExistingAccountAccessAction =
  | "block"
  | "unblock"
  | "approve"
  | "reject"
  | "set_role";

export function isExistingAccountAccessActionAllowed(
  role: unknown,
  action: ExistingAccountAccessAction,
): boolean {
  if (role === "superadmin") {
    return true;
  }

  return (
    role === "admin" && (action === "block" || action === "unblock")
  );
}

export type PermissionFlags = Pick<
  PermissionRecord,
  "can_view" | "can_add" | "can_edit" | "can_delete"
>;

export type PermissionRecord = {
  id: string;
  user_id: string;
  module_name: PermissionModule;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
};

export const NO_PERMISSION_FLAGS: PermissionFlags = {
  can_view: false,
  can_add: false,
  can_edit: false,
  can_delete: false,
};

export type PermissionProfile = {
  role: UserRole;
  status: "approved";
};

export type CurrentUserPermissionSummary = {
  userId: string;
  role: UserRole;
  permissions: PermissionFlags;
  visibleModules: PermissionModule[];
};

export type PermissionContext = {
  userId: string;
  profile: unknown;
  loadPermissions: (userId: string) => Promise<unknown>;
};

export type PermissionContextLoader = () => Promise<PermissionContext | null>;

export class PermissionDeniedError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export class PermissionVerificationError extends Error {
  constructor(message = "Unable to verify permissions.") {
    super(message);
    this.name = "PermissionVerificationError";
  }
}

export class PermissionInputError extends Error {
  constructor(message = "Invalid permission assignment.") {
    super(message);
    this.name = "PermissionInputError";
  }
}

export type PermissionAssignmentLoader = (
  userId: string,
  moduleName: PermissionModule,
) => Promise<unknown>;

export type PermissionAssignmentSaver = (
  userId: string,
  moduleName: PermissionModule,
  flags: PermissionFlags,
) => Promise<void>;

function isPermissionModule(value: unknown): value is PermissionModule {
  return (
    typeof value === "string" &&
    PERMISSION_MODULES.some((moduleName) => moduleName === value)
  );
}

export function isSupportedPermissionModule(
  value: unknown,
): value is PermissionModule {
  return isPermissionModule(value);
}

export function parsePermissionFlags(value: unknown): PermissionFlags | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const flags = value as Record<string, unknown>;

  if (
    typeof flags.can_view !== "boolean" ||
    typeof flags.can_add !== "boolean" ||
    typeof flags.can_edit !== "boolean" ||
    typeof flags.can_delete !== "boolean"
  ) {
    return null;
  }

  return {
    can_view: flags.can_view,
    can_add: flags.can_add,
    can_edit: flags.can_edit,
    can_delete: flags.can_delete,
  };
}

function isPermissionAction(value: unknown): value is PermissionAction {
  return (
    typeof value === "string" &&
    PERMISSION_ACTIONS.some((action) => action === value)
  );
}

function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    value !== "" &&
    (["superadmin", "admin", "user"] as const).some((role) => role === value)
  );
}

function isPermissionProfile(value: unknown): value is PermissionProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Record<string, unknown>;

  return profile.status === "approved" && isUserRole(profile.role);
}

function isPermissionRecord(value: unknown): value is PermissionRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.user_id === "string" &&
    isPermissionModule(record.module_name) &&
    typeof record.can_view === "boolean" &&
    typeof record.can_add === "boolean" &&
    typeof record.can_edit === "boolean" &&
    typeof record.can_delete === "boolean" &&
    typeof record.created_at === "string" &&
    typeof record.updated_at === "string"
  );
}

export function getVisibleModulesForUser(
  role: unknown,
  userId: unknown,
  permissions: unknown,
): PermissionModule[] {
  if (!isUserRole(role)) {
    return [];
  }

  if (role === "superadmin") {
    return [...PERMISSION_MODULES];
  }

  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    !Array.isArray(permissions) ||
    !permissions.every(
      (record) =>
        isPermissionRecord(record) && record.user_id === userId,
    )
  ) {
    return [];
  }

  return PERMISSION_MODULES.filter((moduleName) =>
    permissions.some(
      (record) => record.module_name === moduleName && record.can_view,
    ),
  );
}

export function createPermissionHelpers(
  loadContext: PermissionContextLoader,
  onVerificationError: () => void,
) {
  async function getApprovedContext(): Promise<
    PermissionContext & { profile: PermissionProfile }
  > {
    let context: PermissionContext | null;

    try {
      context = await loadContext();
    } catch {
      onVerificationError();
      throw new PermissionVerificationError();
    }

    if (!context) {
      throw new PermissionDeniedError("Please sign in to continue.");
    }

    if (
      typeof context.userId !== "string" ||
      context.userId.length === 0 ||
      !isPermissionProfile(context.profile)
    ) {
      throw new PermissionDeniedError("Your account is not approved.");
    }

    return {
      ...context,
      profile: context.profile,
    };
  }

  async function loadPermissionsForContext(
    context: PermissionContext & { profile: PermissionProfile },
  ): Promise<PermissionRecord[]> {
    let data: unknown;

    try {
      data = await context.loadPermissions(context.userId);
    } catch {
      onVerificationError();
      throw new PermissionVerificationError();
    }

    if (
      !Array.isArray(data) ||
      !data.every(
        (record) =>
          isPermissionRecord(record) && record.user_id === context.userId,
      )
    ) {
      onVerificationError();
      throw new PermissionVerificationError();
    }

    return data;
  }

  async function getCurrentUserPermissions(): Promise<PermissionRecord[]> {
    const context = await getApprovedContext();
    return loadPermissionsForContext(context);
  }

  async function getCurrentUserPermissionSummary(): Promise<CurrentUserPermissionSummary> {
    const context = await getApprovedContext();

    if (context.profile.role === "superadmin") {
      return {
        userId: context.userId,
        role: context.profile.role,
        permissions: { ...NO_PERMISSION_FLAGS },
        visibleModules: getVisibleModulesForUser(
          context.profile.role,
          context.userId,
          [],
        ),
      };
    }

    const data = await loadPermissionsForContext(context);

    const modulePermission = data.find(
      (record) => record.module_name === "users",
    );

    return {
      userId: context.userId,
      role: context.profile.role,
      permissions: modulePermission
        ? {
            can_view: modulePermission.can_view,
            can_add: modulePermission.can_add,
            can_edit: modulePermission.can_edit,
            can_delete: modulePermission.can_delete,
          }
        : { ...NO_PERMISSION_FLAGS },
      visibleModules: getVisibleModulesForUser(
        context.profile.role,
        context.userId,
        data,
      ),
    };
  }

  async function canCurrentUserPerform(
    moduleName: unknown,
    action: unknown,
  ): Promise<boolean> {
    if (!isPermissionModule(moduleName) || !isPermissionAction(action)) {
      return false;
    }

    try {
      const permissions = await getCurrentUserPermissions();

      return permissions.some(
        (permission) =>
          permission.module_name === moduleName && permission[action] === true,
      );
    } catch (error) {
      if (
        !(error instanceof PermissionDeniedError) &&
        !(error instanceof PermissionVerificationError)
      ) {
        onVerificationError();
      }

      return false;
    }
  }

  async function requireCurrentUserPermission(
    moduleName: unknown,
    action: unknown,
  ): Promise<void> {
    if (!(await canCurrentUserPerform(moduleName, action))) {
      throw new PermissionDeniedError();
    }
  }

  async function requireCurrentUserModulePermission(
    moduleName: unknown,
    action: unknown,
  ): Promise<void> {
    if (!isPermissionModule(moduleName) || !isPermissionAction(action)) {
      throw new PermissionDeniedError("Unsupported permission action.");
    }

    const context = await getApprovedContext();

    if (context.profile.role === "superadmin") {
      return;
    }

    const permissions = await loadPermissionsForContext(context);
    const allowed = permissions.some(
      (permission) =>
        permission.module_name === moduleName && permission[action] === true,
    );

    if (!allowed) {
      throw new PermissionDeniedError();
    }
  }

  async function requireApprovedSuperadmin(): Promise<void> {
    const context = await getApprovedContext();

    if (context.profile.role !== "superadmin") {
      throw new PermissionDeniedError(
        "Only an approved superadmin can manage permissions.",
      );
    }
  }

  return {
    getCurrentUserPermissions,
    getCurrentUserPermissionSummary,
    canCurrentUserPerform,
    requireCurrentUserPermission,
    requireCurrentUserModulePermission,
    requireApprovedSuperadmin,
  };
}

export function createPermissionAssignmentHelpers(
  requireSuperadmin: () => Promise<void>,
  loadRecord: PermissionAssignmentLoader,
  saveRecord: PermissionAssignmentSaver,
) {
  async function getUserModulePermission(
    userId: string,
    moduleName: unknown,
  ): Promise<PermissionRecord | null> {
    await requireSuperadmin();

    if (!userId || !isPermissionModule(moduleName)) {
      throw new PermissionInputError("Invalid user or permission module.");
    }

    let data: unknown;

    try {
      data = await loadRecord(userId, moduleName);
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        throw error;
      }

      throw new PermissionVerificationError();
    }

    if (data === null) {
      return null;
    }

    if (
      !isPermissionRecord(data) ||
      data.user_id !== userId ||
      data.module_name !== moduleName
    ) {
      throw new PermissionVerificationError(
        "Selected user's permission could not be verified.",
      );
    }

    return data;
  }

  async function saveUserModulePermission(
    userId: string,
    moduleName: unknown,
    values: unknown,
  ): Promise<void> {
    await requireSuperadmin();

    if (!userId || !isPermissionModule(moduleName)) {
      throw new PermissionInputError("Invalid user or permission module.");
    }

    const flags = parsePermissionFlags(values);

    if (!flags) {
      throw new PermissionInputError(
        "All four permission values must be boolean.",
      );
    }

    try {
      await saveRecord(userId, moduleName, flags);
    } catch (error) {
      if (
        error instanceof PermissionDeniedError ||
        error instanceof PermissionVerificationError
      ) {
        throw error;
      }

      throw new PermissionVerificationError(
        "Selected user's permission could not be saved.",
      );
    }
  }

  return { getUserModulePermission, saveUserModulePermission };
}
