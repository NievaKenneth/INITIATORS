
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  PermissionFlags,
  PermissionModule,
} from "@/lib/supabase/permissions-core";

type UserRole = "superadmin" | "admin" | "user";
type UserStatus = "pending" | "approved" | "rejected" | "blocked";

type ManagedUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

type CurrentUser = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  permissions: PermissionFlags;
  visibleModules: PermissionModule[];
};

type UserListResponse = {
  users: ManagedUser[];
  currentUser: CurrentUser;
};

const emptyPermissionFlags: PermissionFlags = {
  can_view: false,
  can_add: false,
  can_edit: false,
  can_delete: false,
};

function roleLabel(role: UserRole) {
  switch (role) {
    case "superadmin":
      return "Superadmin";
    case "admin":
      return "Administrator";
    default:
      return "Team member";
  }
}

function isUserRole(role: string): role is UserRole {
  return role === "superadmin" || role === "admin" || role === "user";
}

function statusLabel(status: UserStatus) {
  switch (status) {
    case "approved":
      return "Active";
    case "pending":
      return "Pending";
    case "rejected":
      return "Rejected";
    case "blocked":
      return "Blocked";
  }
}

function avatarInitials(name: string | null) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [permissionUserId, setPermissionUserId] = useState("");
  const [permissionFlags, setPermissionFlags] =
    useState<PermissionFlags>(emptyPermissionFlags);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [permissionNotice, setPermissionNotice] = useState("");

  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [name, setName] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const actionInProgress = useRef(false);
  const permissionRequestId = useRef(0);
  const canAddUsers =
    currentUser?.role === "superadmin" || currentUser?.permissions.can_add;
  const canEditUsers =
    currentUser?.role === "superadmin" || currentUser?.permissions.can_edit;

  const fetchUsers = useCallback(async (): Promise<UserListResponse> => {
    const response = await fetch("/api/admin/users", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load users.");
    }

    return data as UserListResponse;
  }, []);

  async function loadUsers() {
    try {
      const data = await fetchUsers();
      setUsers(data.users);
      setCurrentUser(data.currentUser);
    } catch (err) {
      setUsers([]);
      setCurrentUser(null);
      setError(
        err instanceof Error ? err.message : "Unable to load users.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshUsers() {
    setLoading(true);
    setError("");
    await loadUsers();
  }

  useEffect(() => {
    let active = true;

    void fetchUsers()
      .then((data) => {
        if (active) {
          setUsers(data.users);
          setCurrentUser(data.currentUser);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setUsers([]);
          setCurrentUser(null);
          setError(
            err instanceof Error ? err.message : "Unable to load users.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchUsers]);

  async function loadPermissionsForUser(userId: string) {
    const requestId = ++permissionRequestId.current;
    setPermissionUserId(userId);
    setPermissionFlags(emptyPermissionFlags);
    setPermissionError("");
    setPermissionNotice("");

    if (!userId) {
      setPermissionLoading(false);
      return;
    }

    setPermissionLoading(true);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/permissions`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load user permissions.");
      }

      const permission = data.permission as
        | (PermissionFlags & { user_id: string })
        | null;

      if (
        permission !== null &&
        (permission.user_id !== userId ||
          typeof permission.can_view !== "boolean" ||
          typeof permission.can_add !== "boolean" ||
          typeof permission.can_edit !== "boolean" ||
          typeof permission.can_delete !== "boolean")
      ) {
        throw new Error("The returned permission record is invalid.");
      }

      if (requestId === permissionRequestId.current && permission) {
        setPermissionFlags({
          can_view: permission.can_view,
          can_add: permission.can_add,
          can_edit: permission.can_edit,
          can_delete: permission.can_delete,
        });
      }
    } catch (err) {
      if (requestId === permissionRequestId.current) {
        setPermissionError(
          err instanceof Error
            ? err.message
            : "Unable to load user permissions.",
        );
      }
    } finally {
      if (requestId === permissionRequestId.current) {
        setPermissionLoading(false);
      }
    }
  }

  function openPermissions(userId = "") {
    if (currentUser?.role !== "superadmin") {
      return;
    }

    setDialogOpen(true);
    void loadPermissionsForUser(userId || users[0]?.id || "");
  }

  function closePermissions() {
    permissionRequestId.current += 1;
    setDialogOpen(false);
    setPermissionLoading(false);
    setPermissionFlags(emptyPermissionFlags);
  }

  async function savePermissions() {
    if (currentUser?.role !== "superadmin" || !permissionUserId) {
      setPermissionError("Only an approved superadmin can manage permissions.");
      return;
    }

    setPermissionSaving(true);
    setPermissionError("");
    setPermissionNotice("");

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(permissionUserId)}/permissions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            module_name: "users",
            ...permissionFlags,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save user permissions.");
      }

      setPermissionNotice("Permissions saved successfully.");
    } catch (err) {
      setPermissionError(
        err instanceof Error ? err.message : "Unable to save user permissions.",
      );
    } finally {
      setPermissionSaving(false);
    }
  }

  function openAddUser() {
    if (!canAddUsers) {
      setError("You do not have permission to create users.");
      return;
    }

    setFormOpen(false);
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setCreateOpen(true);
    setNotice("");
    setError("");
  }

  function openEditUser(user: ManagedUser) {
    setCreateOpen(false);
    setEditingUser(user);
    setName(user.full_name ?? "");
    setFormOpen(true);
    setNotice("");
    setError("");
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create the user.");
      }

      setCreateOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setNotice("User created successfully. The account is pending approval.");
      await refreshUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create the user.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function manageUser(
    target: ManagedUser,
    action: "block" | "unblock" | "approve" | "reject" | "set_role",
    role?: UserRole,
  ) {
    if (actionInProgress.current) return;

    actionInProgress.current = true;
    setActionUserId(target.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(target.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...(role ? { role } : {}) }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update account access.");
      }

      if (data.user) {
        setUsers((currentUsers) =>
          currentUsers.map((user) =>
            user.id === target.id ? { ...user, ...data.user } : user,
          ),
        );
      }

      const messages = {
        block: "User blocked successfully.",
        unblock: "User unblocked successfully.",
        approve: "User approved successfully.",
        reject: "User rejected successfully.",
        set_role: "User role updated successfully.",
      };
      setNotice(messages[action]);
      await refreshUsers();
    } catch (err) {
      await refreshUsers();
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update account access.",
      );
    } finally {
      actionInProgress.current = false;
      setActionUserId(null);
    }
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingUser || !canEditUsers) {
      setError("You do not have permission to edit user information.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(editingUser.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: name.trim() }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update the user.");
      }

      setNotice("User name updated successfully.");
      setFormOpen(false);
      setEditingUser(null);
      await refreshUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update the user.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed. Please try again.");
      }

      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed.");
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to user management
      </a>

      <header className="app-header">
        <div className="app-header-inner container">
          <Link className="brand" href="/" aria-label="HOPE ERP home">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8.5 12h2l1.2-2.3 1.6 4.6 1.1-2.3h1.1"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>
              HOPE <span aria-hidden="true">ERP</span>
            </span>
          </Link>

          <nav className="app-nav" aria-label="Workspace navigation">
            {currentUser?.visibleModules.includes("users") && (
              <Link href="/dashboard" aria-current="page">
                Users
              </Link>
            )}
            {currentUser?.role === "superadmin" && (
              <button type="button" onClick={() => openPermissions()}>
                Roles &amp; Rights
              </button>
            )}
          </nav>

          <div className="app-user">
            <span className="user-avatar avatar-gold" aria-hidden="true">
              {avatarInitials(currentUser?.name ?? null)}
            </span>
            <span>
              {currentUser?.name || currentUser?.email || "Loading account"}
              {currentUser && (
                <small style={{ display: "block" }}>
                  {roleLabel(currentUser.role)}
                </small>
              )}
            </span>
            <button
              className="button button-secondary"
              type="button"
              onClick={logout}
              disabled={loggingOut}
            >
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </div>
      </header>

      <main className="app-main container" id="main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              <span className="eyebrow-dot" aria-hidden="true" />
              Workspace settings
            </p>
            <h1>User Management</h1>
            <p>Manage your team members and their access to HOPE ERP.</p>
          </div>

          {canAddUsers && (
            <button
              className="button button-primary"
              type="button"
              onClick={openAddUser}
            >
              + Add user
            </button>
          )}
        </div>

        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}

        <section className="table-card" aria-labelledby="users-title">
          <div className="table-toolbar">
            <div>
              <h2 id="users-title">Team members</h2>
              <p>Manage user access and assigned roles.</p>
            </div>
            {currentUser?.role === "superadmin" && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => openPermissions()}
              >
                Roles &amp; Rights
              </button>
            )}
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <caption className="visually-hidden">
                Team members, email addresses, roles, statuses, and actions.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>Loading users...</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No users found.</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <span className="user-cell">
                          <span
                            className="user-avatar"
                            aria-hidden="true"
                          >
                            {avatarInitials(user.full_name)}
                          </span>
                          {user.full_name || "Unnamed user"}
                        </span>
                      </td>
                      <td>{user.email || "—"}</td>
                      <td>
                        {currentUser?.role === "superadmin" &&
                        currentUser.id !== user.id ? (
                          <select
                            className="form-control"
                            aria-label={`Role for ${user.full_name || user.email || "user"}`}
                            value={user.role}
                            disabled={actionUserId !== null}
                            onChange={(event) => {
                              const role = event.target.value;
                              if (isUserRole(role)) {
                                void manageUser(user, "set_role", role);
                              }
                            }}
                          >
                            <option value="superadmin">Superadmin</option>
                            <option value="admin">Administrator</option>
                            <option value="user">Team member</option>
                          </select>
                        ) : (
                          roleLabel(user.role)
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            user.status !== "approved"
                              ? "status-pending"
                              : ""
                          }`}
                        >
                          {statusLabel(user.status)}
                        </span>
                      </td>
                      <td>
                        {currentUser?.role === "superadmin" && (
                          <button
                            className="table-action"
                            type="button"
                            onClick={() => openPermissions(user.id)}
                          >
                            Rights
                          </button>
                        )}
                        {canEditUsers && (
                          <button
                            className="table-action"
                            type="button"
                            disabled={actionUserId !== null}
                            onClick={() => openEditUser(user)}
                          >
                            Edit
                          </button>
                        )}
                        {(currentUser?.role === "admin" ||
                          currentUser?.role === "superadmin") &&
                          currentUser.id !== user.id &&
                          (user.status === "approved" ||
                            user.status === "blocked") && (
                            <button
                              className="table-action"
                              type="button"
                              disabled={actionUserId !== null}
                              onClick={() =>
                                void manageUser(
                                  user,
                                  user.status === "approved"
                                    ? "block"
                                    : "unblock",
                                )
                              }
                            >
                              {actionUserId === user.id
                                ? "Updating..."
                                : user.status === "approved"
                                  ? "Block"
                                  : "Unblock"}
                            </button>
                          )}
                        {currentUser?.role === "superadmin" &&
                          currentUser.id !== user.id &&
                          user.status === "pending" && (
                            <>
                              <button
                                className="table-action"
                                type="button"
                                disabled={actionUserId !== null}
                                onClick={() =>
                                  void manageUser(user, "approve")
                                }
                              >
                                Approve
                              </button>
                              <button
                                className="table-action"
                                type="button"
                                disabled={actionUserId !== null}
                                onClick={() =>
                                  void manageUser(user, "reject")
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="table-note">
            {loading ? "Loading team members..." : `Showing ${users.length} team members`}
          </p>
        </section>
      </main>

      {(createOpen || (formOpen && editingUser)) && (
        <div
          className="permissions-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-form-title"
        >
          <div className="dialog-header">
            <div>
              <h2 id="user-form-title">
                {createOpen ? "Add user" : "Edit user"}
              </h2>
              <p>
                {createOpen
                  ? "Create a new team member account."
                  : "Update the team member's name."}
              </p>
            </div>
            <button
              className="dialog-close"
              type="button"
              onClick={() => {
                setFormOpen(false);
                setCreateOpen(false);
              }}
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <form onSubmit={createOpen ? createUser : saveUser}>
            <div className="dialog-body">
              <div className="form-field">
                <label className="form-label" htmlFor="user-name">
                  Full name
                </label>
                <input
                  className="form-control"
                  id="user-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  maxLength={100}
                  required
                />
              </div>

              {createOpen ? (
                <>
                  <div className="form-field">
                    <label className="form-label" htmlFor="user-email">
                      Email
                    </label>
                    <input
                      className="form-control"
                      id="user-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      maxLength={254}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label" htmlFor="user-password">
                      Password
                    </label>
                    <input
                      className="form-control"
                      id="user-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={12}
                      maxLength={128}
                      required
                    />
                  </div>
                  <p>New accounts start with the user role and pending status.</p>
                </>
              ) : (
                <>
                  <div className="form-field">
                    <label className="form-label" htmlFor="user-email">
                      Email
                    </label>
                    <input
                      className="form-control"
                      id="user-email"
                      type="email"
                      value={editingUser?.email ?? ""}
                      readOnly
                    />
                  </div>

                  <p>
                    Role: {editingUser && roleLabel(editingUser.role)}. Status:{" "}
                    {editingUser && statusLabel(editingUser.status)}.
                  </p>
                  <p>Role and approval status cannot be changed in this form.</p>
                </>
              )}
            </div>

            {error && <p role="alert">{error}</p>}

            <div className="dialog-footer">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setCreateOpen(false);
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? createOpen
                    ? "Creating..."
                    : "Saving..."
                  : createOpen
                    ? "Create user"
                    : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {dialogOpen && (
        <div
          className="permissions-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-busy={permissionLoading || permissionSaving}
        >
          <div className="dialog-header">
            <div>
              <h2 id="dialog-title">Roles &amp; Rights</h2>
              <p>Assign User Management access for an individual account.</p>
            </div>
            <button
              className="dialog-close"
              type="button"
              onClick={closePermissions}
              disabled={permissionSaving}
              aria-label="Close dialog"
            >
              &times;
            </button>
          </div>

          <div className="dialog-body">
            <div className="form-field">
              <label className="form-label" htmlFor="permission-user">
                User account
              </label>
              <select
                className="form-control"
                id="permission-user"
                value={permissionUserId}
                disabled={permissionSaving}
                onChange={(event) =>
                  void loadPermissionsForUser(event.target.value)
                }
              >
                <option value="">Select a user</option>
                {users.map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.full_name || user.email || "Unnamed user"} (
                    {roleLabel(user.role)})
                  </option>
                ))}
              </select>
            </div>

            {permissionLoading && (
              <p role="status">Loading selected user permissions...</p>
            )}
            {permissionError && (
              <p role="alert">
                {permissionError}{" "}
                {permissionUserId && (
                  <button
                    className="table-action"
                    type="button"
                    disabled={permissionLoading || permissionSaving}
                    onClick={() => void loadPermissionsForUser(permissionUserId)}
                  >
                    Retry
                  </button>
                )}
              </p>
            )}
            {permissionNotice && <p role="status">{permissionNotice}</p>}

            <fieldset
              className="permission-list"
              disabled={
                !permissionUserId ||
                permissionLoading ||
                permissionSaving ||
                Boolean(permissionError)
              }
            >
              <legend>User Management access rights</legend>
              {(
                [
                  ["can_view", "View users", "View User Management."],
                  ["can_add", "Add users", "Create user accounts."],
                  ["can_edit", "Edit users", "Edit user information."],
                  [
                    "can_delete",
                    "Delete users",
                    "No user deletion action is currently available.",
                  ],
                ] as const
              ).map(([action, title, description]) => (
                <label className="permission-option" key={action}>
                  <input
                    type="checkbox"
                    checked={permissionFlags[action]}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setPermissionFlags((current) => ({
                        ...current,
                        [action]: checked,
                      }));
                    }}
                  />
                  <span>
                    <strong>{title}</strong>
                    <span>{description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>

          <div className="dialog-footer">
            <button
              className="button button-secondary"
              type="button"
              onClick={closePermissions}
              disabled={permissionSaving}
            >
              Close
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={
                !permissionUserId ||
                permissionLoading ||
                permissionSaving ||
                Boolean(permissionError)
              }
              onClick={() => void savePermissions()}
            >
              {permissionSaving ? "Saving..." : "Save rights"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
