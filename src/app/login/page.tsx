
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Unable to sign in. Please try again.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setMessage("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to sign in
      </a>

      <main className="auth-shell" id="main">
        <section className="auth-intro" aria-label="Welcome to HOPE ERP">
          <a className="brand" href="/" aria-label="HOPE ERP home">
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
          </a>

          <div className="auth-intro-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" aria-hidden="true" />
              Welcome back
            </p>
            <h1>Your team’s work, all in one place.</h1>
            <p>
              Sign in to pick up where you left off and keep your team moving
              forward.
            </p>
          </div>

          <p className="auth-aside-note">A clearer way to work, together.</p>
        </section>

        <section className="auth-panel" aria-labelledby="form-title">
          <div className="auth-card">
            <h2 id="form-title">Sign in to HOPE ERP</h2>
            <p className="auth-description">
              Enter your account details to continue.
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
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
                  onChange={(event) => setEmail(event.target.value)}
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
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              {message && (
                <p role="alert" aria-live="polite">
                  {message}
                </p>
              )}

              <button
                className="button button-primary button-large"
                type="submit"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="auth-meta">
              <a href="/reset-password">Forgot your password?</a>
              <span>
                New to HOPE? <a href="/register">Create an account</a>
              </span>
            </div>

            <a className="auth-back" href="/">
              ← Back to home
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
