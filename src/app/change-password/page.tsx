"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = "/login";
      setChecking(false);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    const { error: markError } = await supabase.rpc("mark_my_password_changed");
    if (markError) {
      setError("Password changed, but the account status could not be updated. Please contact an administrator.");
      setSaving(false);
      return;
    }

    setMessage("Password updated successfully. Redirecting to your workspace…");
    window.setTimeout(() => { window.location.href = "/dashboard"; }, 700);
  }

  if (checking) {
    return <main className="auth-page"><div className="auth-card"><span className="public-kicker">ATLAS CMS</span><p>Checking your secure session…</p></div></main>;
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="public-kicker">ATLAS CMS · FIRST LOGIN</span>
        <h1>Set your new password.</h1>
        <p>Your administrator created this account with temporary credentials. Choose a private password before entering the workspace.</p>
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-label">New password<input className="auth-input" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
          <label className="auth-label">Confirm new password<input className="auth-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-success" role="status">{message}</p>}
          <button className="public-button primary" type="submit" disabled={saving}>{saving ? "Updating…" : "Update password"}</button>
        </form>
        <Link className="public-text-link" href="/">Return to the public website</Link>
      </div>
    </main>
  );
}
