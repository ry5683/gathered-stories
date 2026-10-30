// WHAT: Provides passwordless email sign-in and a sign-out action through Supabase Auth.
// WHY: Writes and Claude generation require an authenticated account, with access limited by RLS.
"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AuthPanel({ onAuthChange }: { onAuthChange: (authenticated: boolean) => void }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (active && !error) {
        const emailAddress = data.user?.email ?? null;
        setUserEmail(emailAddress);
        onAuthChange(Boolean(emailAddress));
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUserEmail(session?.user.email ?? null);
        onAuthChange(Boolean(session?.user));
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [onAuthChange, supabase]);

  // WHAT: Sends a passwordless Supabase email link and reports the result in the header.
  // WHY: Users authenticate without the app ever collecting or storing a password.
  async function sendSignInLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    setMessage(error ? "The sign-in email could not be sent. Check your Supabase Auth settings." : "Check your inbox for a secure sign-in link.");
  }

  // WHAT: Ends the current Supabase session.
  // WHY: Signing out clears access to future owner-scoped API requests.
  async function signOut() {
    if (!supabase) return;
    if (!window.confirm("Sign out and clear the current wedding workspace from this browser?")) return;
    const { error } = await supabase.auth.signOut();
    if (error) setMessage("Sign out failed. Please try again.");
  }

  if (!supabase) {
    return <p className="auth-note">Add Supabase settings in your local environment to sign in and save drafts.</p>;
  }
  if (userEmail) {
    return (
      <div className="auth-controls">
        <span className="auth-email">{userEmail}</span>
        <button className="button button-secondary" type="button" onClick={signOut}>Sign out</button>
        {message && <span className="status-message" role="status">{message}</span>}
      </div>
    );
  }

  return (
    <form className="auth-controls" onSubmit={sendSignInLink}>
      <label className="sr-only" htmlFor="signin-email">Email address</label>
      <input id="signin-email" className="auth-input" type="email" autoComplete="email" required placeholder="Email to sign in" value={email} onChange={(event) => setEmail(event.target.value)} />
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Email sign-in link"}</button>
      {message && <span className="status-message" role="status">{message}</span>}
    </form>
  );
}
