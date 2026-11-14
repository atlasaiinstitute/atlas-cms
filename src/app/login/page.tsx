"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setError(signInError?.message ?? "Unable to sign in.");
      setLoading(false);
      return;
    }

    const { data: provisioning, error: provisioningError } = await supabase
      .from("member_auth_provisioning")
      .select("must_change_password")
      .eq("auth_user_id", data.user.id)
      .limit(1)
      .maybeSingle();

    if (provisioningError) {
      await supabase.auth.signOut();
      setError("Your account could not be verified. Please contact an administrator.");
      setLoading(false);
      return;
    }

    window.location.href = provisioning?.must_change_password ? "/change-password" : "/dashboard";
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="public-kicker">ATLAS CMS</span>
        <h1>Sign in to your workspace.</h1>
        <p>Use the individual login created by your organization administrator.</p>
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-label">Email address<input className="auth-input" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label className="auth-label">Password<input className="auth-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="public-button primary" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <Link className="public-text-link" href="/">Return to the public website</Link>
      </div>
    </main>
  );
}
