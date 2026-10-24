
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || "Registration failed.");
        return;
      }

      router.push("/login");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to registration
      </a>

      <main className="auth-shell" id="main">
        <section className="auth-intro" aria-label="Join HOPE ERP">
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

          <div className="auth-intro-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" aria-hidden="true" />
              Make room for progress
            </p>
            <h1>Bring your team together.</h1>
            <p>
              Create your workspace and give your team a clearer way to
              collaborate and move forward.
            </p>
          </div>

          <p className="auth-aside-note">
            A clearer way to work, together.
          </p>
        </section>

        <section className="auth-panel" aria-labelledby="form-title">
          <div className="auth-card">
            <h2 id="form-title">Create your account</h2>
            <p className="auth-description">
              Get started with your HOPE ERP workspace.
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-field">
                <label className="form-label" htmlFor="full-name">
                  Full name
                </label>
                <input
                  className="form-control"
                  id="full-name"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="email">
                  Email address
                </label>
                <input
                  className="form-control"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <input
                  className="form-control"
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="confirm-password">
                  Confirm password
                </label>
                <input
                  className="form-control"
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Enter your password again"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}

              <button
                className="button button-primary button-large"
                type="submit"
                disabled={loading}
              >
                {loading ? "Registering..." : "Register"}
              </button>
            </form>

            <div className="auth-meta">
              <span>
                Already have an account? <Link href="/login">Sign In</Link>
              </span>
            </div>

            <Link className="auth-back" href="/">
              ← Back to home
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
