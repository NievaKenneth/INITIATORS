
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || "Unable to reset password.");
        return;
      }

      setMessage(data.message || "Password updated successfully.");

      setTimeout(() => router.push("/login"), 1500);
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
          <h1>A fresh start.</h1>
          <p>Create a new password to secure your HOPE ERP account.</p>
        </div>

        <p className="auth-aside-note">A clearer way to work, together.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h2>Choose a new password</h2>
          <p className="auth-description">
            Enter your new password below.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label" htmlFor="password">
                New password
              </label>
              <input
                className="form-control"
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="confirm-password">
                Confirm new password
              </label>
              <input
                className="form-control"
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? "Updating..." : "Update Password"}
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
