"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to request password reset.");
        return;
      }

      setMessage(data.message);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">♥</span>
          <span>HOPE <span>ERP</span></span>
        </Link>

        <div className="auth-intro-copy">
          <p className="eyebrow">Make room for progress</p>
          <h1>Find your way back.</h1>
          <p>Request a secure link to reset your HOPE ERP password.</p>
        </div>

        <p className="auth-aside-note">A clearer way to work, together.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h2>Reset your password</h2>
          <p className="auth-description">
            Enter your account email and we’ll send reset instructions if an
            account exists.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label" htmlFor="email">
                Email address
              </label>
              <input
                className="form-control"
                id="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            {error && <p role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}

            <button
              className="button button-primary button-large"
              type="submit"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>

          <div className="auth-meta">
            <span>Remembered your password? <Link href="/login">Sign In</Link></span>
          </div>

          <Link className="auth-back" href="/">
            ← Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
