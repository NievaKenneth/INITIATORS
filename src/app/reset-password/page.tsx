
"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const recoveryError = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("error"),
    () => null,
  );
  const recoveryLinkInvalid =
    recoveryError === "invalid_link" || recoveryError === "unavailable";
  const recoveryErrorMessage =
    recoveryError === "invalid_link"
      ? "This password reset link is invalid or has expired. Request a new link to continue."
      : recoveryError === "unavailable"
        ? "Password recovery is temporarily unavailable. Please try again later."
        : "";

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

          {(recoveryErrorMessage || error) && (
            <p role="alert">{recoveryErrorMessage || error}</p>
          )}

          {!recoveryLinkInvalid && (
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
                  minLength={12}
                  maxLength={128}
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
                  minLength={12}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {message && <p role="status">{message}</p>}

              <button
                className="button button-primary button-large"
                type="submit"
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}

          {recoveryLinkInvalid && (
            <p>
              <Link href="/forgot-password">Request a new reset link</Link>
            </p>
          )}

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
