import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/supabase/auth";
import {
  getCurrentUserPermissionSummary,
  PermissionDeniedError,
  PermissionVerificationError,
  type CurrentUserPermissionSummary,
} from "@/lib/supabase/permissions";

const transactions = [
  { id: "TXN-1048", date: "Nov 04, 2026", amount: "$248.00", status: "Completed" },
  { id: "TXN-1047", date: "Nov 03, 2026", amount: "$1,025.50", status: "Processing" },
  { id: "TXN-1046", date: "Nov 02, 2026", amount: "$86.75", status: "Completed" },
  { id: "TXN-1045", date: "Nov 01, 2026", amount: "$420.00", status: "Refunded" },
];

const activities = [
  { title: "Completed a sale", detail: "Transaction TXN-1048", time: "Today, 10:42 AM" },
  { title: "Updated product inventory", detail: "Wireless Headphones", time: "Today, 9:18 AM" },
  { title: "Added a new customer", detail: "Jordan Lee", time: "Yesterday, 4:36 PM" },
];

const quickAccessItems = [
  { title: "Products", description: "Browse your product catalog", icon: "box" },
  { title: "Sales", description: "Review sales and transactions", icon: "trend" },
  { title: "Customers", description: "View customer information", icon: "users" },
];

async function logoutFromDashboard(): Promise<void> {
  "use server";
  await logout();
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

function DashboardIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    sales: "M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3",
    transactions: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
    products: "m7 7 5-4 5 4-5 4-5-4Zm-4 4 9 5 9-5M3 11v9l9 5 9-5v-9M12 16v9",
    activity: "M22 12h-4l-3 9L9 3l-3 9H2",
    box: "m21 8-9-5-9 5 9 5 9-5Zm-18 0v9l9 5 9-5V8M12 13v9",
    trend: "M3 17 9 11l4 4 8-8 M15 7h6v6",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] ?? paths.activity} />
    </svg>
  );
}

function transactionStatusClass(status: string) {
  if (status === "Processing") {
    return "status-badge status-processing";
  }

  if (status === "Refunded") {
    return "status-badge status-refunded";
  }

  return "status-badge";
}

export default async function UserDashboardPage() {
  await requireUser();
  let permissionSummary: CurrentUserPermissionSummary;

  try {
    permissionSummary = await getCurrentUserPermissionSummary();
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return (
        <main className="min-h-screen p-8">
          <h1 className="text-2xl font-bold">Account approval required</h1>
          <p className="mt-2">
            Your account must be approved before you can access the dashboard.
          </p>
        </main>
      );
    }

    if (error instanceof PermissionVerificationError) {
      return (
        <main className="min-h-screen p-8">
          <h1 className="text-2xl font-bold">Dashboard unavailable</h1>
          <p className="mt-2">
            Your account access could not be verified. Please try again later.
          </p>
        </main>
      );
    }

    throw error;
  }

  if (
    permissionSummary.role !== "user" &&
    permissionSummary.role !== "admin" &&
    permissionSummary.role !== "superadmin"
  ) {
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-2xl font-bold">Dashboard unavailable</h1>
        <p className="mt-2">Your account role could not be verified.</p>
      </main>
    );
  }

  const fullName = permissionSummary.fullName || "User";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to dashboard
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
            <Link href="/user-dashboard" aria-current="page">
              Overview
            </Link>
            <a href="#transactions">Transactions</a>
            <a href="#activity">Activity</a>
            {permissionSummary.visibleModules.includes("users") && (
              <Link href="/dashboard">User Management</Link>
            )}
          </nav>

          <div className="app-user">
            <span className="user-avatar avatar-gold" aria-hidden="true">
              {initials(fullName)}
            </span>
            <span>
              {fullName}
              <small style={{ display: "block" }}>
                {permissionSummary.role === "user"
                  ? "Team member"
                  : permissionSummary.role === "admin"
                    ? "Administrator"
                    : "Superadmin"}
              </small>
            </span>
            <form action={logoutFromDashboard}>
              <button className="button button-secondary" type="submit">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="app-main container user-dashboard" id="main">
        <div className="page-heading user-dashboard-heading">
          <div>
            <p className="eyebrow">
              <span className="eyebrow-dot" aria-hidden="true" />
              Your workspace
            </p>
            <h1>Welcome back, {fullName}</h1>
            <p>Here&apos;s a snapshot of your workspace activity.</p>
          </div>
          <span className="user-dashboard-date">Wednesday, November 4</span>
        </div>

        <p className="user-dashboard-preview-note">
          Dashboard preview · The figures below are sample data.
        </p>

        <section
          className="user-overview-grid"
          id="overview"
          aria-label="Workspace overview"
        >
          <article className="user-stat-card">
            <span className="user-stat-icon user-stat-icon-brand">
              <DashboardIcon name="sales" />
            </span>
            <span className="user-stat-label">Total Sales</span>
            <strong className="user-stat-value">$24,580.00</strong>
            <span className="user-stat-detail">Across all transactions</span>
          </article>
          <article className="user-stat-card">
            <span className="user-stat-icon user-stat-icon-gold">
              <DashboardIcon name="transactions" />
            </span>
            <span className="user-stat-label">Total Transactions</span>
            <strong className="user-stat-value">186</strong>
            <span className="user-stat-detail">Recorded this month</span>
          </article>
          <article className="user-stat-card">
            <span className="user-stat-icon user-stat-icon-blue">
              <DashboardIcon name="products" />
            </span>
            <span className="user-stat-label">Total Products</span>
            <strong className="user-stat-value">42</strong>
            <span className="user-stat-detail">In your workspace catalog</span>
          </article>
          <article className="user-stat-card">
            <span className="user-stat-icon user-stat-icon-activity">
              <DashboardIcon name="activity" />
            </span>
            <span className="user-stat-label">Recent Activity</span>
            <strong className="user-stat-value">8 updates</strong>
            <span className="user-stat-detail">Over the past 7 days</span>
          </article>
        </section>

        <div className="user-dashboard-columns">
          <section
            className="table-card user-dashboard-transactions"
            id="transactions"
            aria-labelledby="transactions-title"
          >
            <div className="table-toolbar">
              <div>
                <h2 id="transactions-title">Recent Transactions</h2>
                <p>Your latest sales activity</p>
              </div>
              <a className="user-dashboard-text-link" href="#quick-access">
                View all
              </a>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <caption className="visually-hidden">
                  Sample recent transactions and their status.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Transaction ID</th>
                    <th scope="col">Date</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="user-transaction-id">{transaction.id}</td>
                      <td>{transaction.date}</td>
                      <td className="user-transaction-amount">
                        {transaction.amount}
                      </td>
                      <td>
                        <span
                          className={transactionStatusClass(transaction.status)}
                        >
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="table-note">Sample transactions shown for preview only.</p>
          </section>

          <aside className="user-dashboard-side">
            <section
              className="table-card user-dashboard-quick-access"
              id="quick-access"
              aria-labelledby="quick-access-title"
            >
              <div className="table-toolbar">
                <div>
                  <h2 id="quick-access-title">Quick Access</h2>
                  <p>Your workspace tools</p>
                </div>
              </div>
              <div className="user-quick-access-list">
                {quickAccessItems.map((item) => (
                  <div className="user-quick-access-item" key={item.title}>
                    <span className="user-quick-access-icon">
                      <DashboardIcon name={item.icon} />
                    </span>
                    <span className="user-quick-access-copy">
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </span>
                    <span className="user-quick-access-soon">Preview</span>
                  </div>
                ))}
              </div>
              <p className="table-note">
                Reports are not shown because no Reports permission is configured
                for regular users.
              </p>
            </section>

            <section
              className="table-card user-dashboard-activity"
              id="activity"
              aria-labelledby="activity-title"
            >
              <div className="table-toolbar">
                <div>
                  <h2 id="activity-title">Recent Activity</h2>
                  <p>Latest updates in your workspace</p>
                </div>
              </div>
              <ol className="user-activity-list">
                {activities.map((activity) => (
                  <li className="user-activity-item" key={activity.title}>
                    <span className="activity-icon">
                      <DashboardIcon name="activity" />
                    </span>
                    <span className="user-activity-copy">
                      <strong>{activity.title}</strong>
                      <span>{activity.detail}</span>
                      <time>{activity.time}</time>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
