
"use client";

import { useState } from "react";
import Link from "next/link";

const initialUsers = [
  { name: "Morgan Chen", email: "morgan.chen@example.com", role: "Administrator", status: "Active", avatar: "MC", color: "" },
  { name: "Riley Patel", email: "riley.patel@example.com", role: "Manager", status: "Active", avatar: "RP", color: "avatar-blue" },
  { name: "Sam Kim", email: "sam.kim@example.com", role: "Team member", status: "Active", avatar: "SK", color: "avatar-gold" },
  { name: "Alex Taylor", email: "alex.taylor@example.com", role: "Team member", status: "Invited", avatar: "AT", color: "" },
];

const initialRights = {
  users: true,
  roles: true,
  reports: false,
  settings: false,
};

export default function DashboardPage() {
  const [users, setUsers] = useState(initialUsers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Administrator");
  const [rights, setRights] = useState(initialRights);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Team member");
  const [status, setStatus] = useState("Active");
  const [notice, setNotice] = useState("");

  function openAddUser() {
    setEditingIndex(null);
    setName("");
    setEmail("");
    setRole("Team member");
    setStatus("Active");
    setFormOpen(true);
  }

  function openEditUser(index: number) {
    const user = users[index];
    setEditingIndex(index);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setStatus(user.status);
    setFormOpen(true);
  }

  function saveUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const avatar = name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const updatedUser = {
      name: name.trim(),
      email: email.trim(),
      role,
      status,
      avatar,
      color: role === "Manager" ? "avatar-blue" : role === "Administrator" ? "avatar-gold" : "",
    };

    if (editingIndex === null) {
      setUsers((current) => [...current, updatedUser]);
      setNotice("User added to this page.");
    } else {
      setUsers((current) =>
        current.map((user, index) => index === editingIndex ? updatedUser : user)
      );
      setNotice("User updated.");
    }

    setFormOpen(false);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to user management</a>

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
            <span>HOPE <span aria-hidden="true">ERP</span></span>
          </Link>

          <nav className="app-nav" aria-label="Workspace navigation">
            <Link href="/dashboard" aria-current="page">Users</Link>
            <button type="button" onClick={() => setDialogOpen(true)}>
              Roles &amp; Rights
            </button>
          </nav>

          <div className="app-user">
            <span className="user-avatar avatar-gold" aria-hidden="true">JD</span>
            <span>Workspace Admin</span>
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
          <button className="button button-primary" type="button" onClick={openAddUser}>
            + Add user
          </button>
        </div>

        {notice && <p role="status">{notice}</p>}

        <section className="table-card" aria-labelledby="users-title">
          <div className="table-toolbar">
            <div>
              <h2 id="users-title">Team members</h2>
              <p>Manage user access and assigned roles.</p>
            </div>
            <button className="button button-secondary" type="button" onClick={() => setDialogOpen(true)}>
              Roles &amp; Rights
            </button>
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
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={`${user.email}-${index}`}>
                    <td>
                      <span className="user-cell">
                        <span className={`user-avatar ${user.color}`} aria-hidden="true">
                          {user.avatar}
                        </span>
                        {user.name}
                      </span>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <span className={`status-badge ${user.status === "Invited" ? "status-pending" : ""}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>
                      <button className="table-action" type="button" onClick={() => openEditUser(index)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-note">Showing {users.length} team members</p>
        </section>
      </main>

      {formOpen && (
        <div className="permissions-dialog" role="dialog" aria-modal="true" aria-labelledby="user-form-title">
          <div className="dialog-header">
            <div>
              <h2 id="user-form-title">{editingIndex === null ? "Add user" : "Edit user"}</h2>
              <p>Enter the team member details.</p>
            </div>
            <button className="dialog-close" type="button" onClick={() => setFormOpen(false)} aria-label="Close">
              &times;
            </button>
          </div>
          <form onSubmit={saveUser}>
            <div className="dialog-body">
              <div className="form-field">
                <label className="form-label" htmlFor="user-name">Full name</label>
                <input className="form-control" id="user-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="user-email">Email</label>
                <input className="form-control" id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="user-role">Role</label>
                <select className="form-control" id="user-role" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option>Administrator</option>
                  <option>Manager</option>
                  <option>Team member</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="user-status">Status</label>
                <select className="form-control" id="user-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option>Active</option>
                  <option>Invited</option>
                </select>
              </div>
            </div>
            <div className="dialog-footer">
              <button className="button button-secondary" type="button" onClick={() => setFormOpen(false)}>Cancel</button>
              <button className="button button-primary" type="submit">Save user</button>
            </div>
          </form>
        </div>
      )}

      {dialogOpen && (
        <div className="permissions-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <div className="dialog-header">
            <div>
              <h2 id="dialog-title">Roles &amp; Rights</h2>
              <p>Choose access rights for a workspace role.</p>
            </div>
            <button className="dialog-close" type="button" onClick={() => setDialogOpen(false)} aria-label="Close dialog">
              &times;
            </button>
          </div>
          <div className="dialog-body">
            <div className="form-field">
              <label className="form-label" htmlFor="workspace-role">Workspace role</label>
              <select className="form-control" id="workspace-role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                <option>Administrator</option>
                <option>Manager</option>
                <option>Team member</option>
              </select>
            </div>

            <fieldset className="permission-list">
              <legend>Access rights</legend>
              {([
                ["users", "Manage users", "Invite, update, and deactivate workspace members."],
                ["roles", "Manage roles and rights", "Assign workspace roles and configure permissions."],
                ["reports", "View reports", "Access workspace reports and activity summaries."],
                ["settings", "Manage settings", "Update workspace preferences and configuration."],
              ] as const).map(([key, title, description]) => (
                <label className="permission-option" key={key}>
                  <input
                    type="checkbox"
                    checked={rights[key]}
                    onChange={(e) => setRights((current) => ({ ...current, [key]: e.target.checked }))}
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
            <button className="button button-secondary" type="button" onClick={() => setDialogOpen(false)}>
              Cancel
            </button>
            <button className="button button-primary" type="button" onClick={() => { setDialogOpen(false); setNotice(`Rights edited for ${selectedRole} in this page only.`); }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
