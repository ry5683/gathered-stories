// WHAT: Passwordless email sign-in (SignInCard) and the signed-in header (AuthPanel) via Supabase Auth.
// WHY: Saving and writing need an account, with access limited by row-level security.
"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

// The header part: watches the sign-in state, and shows the signed-in email with Sign out.
// Signed-out visitors see SignInCard in the page instead, so the header stays empty for them.
export function AuthPanel({ onAuthChange }: { onAuthChange: (authenticated: boolean) => void }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) {
      onAuthChange(false);
      return;
    }
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      const emailAddress = error ? null : data.user?.email ?? null;
      setUserEmail(emailAddress);
      onAuthChange(Boolean(emailAddress));
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

  // WHAT: Ends the current Supabase session.
  // WHY: Signing out clears access to future owner-scoped API requests.
  async function signOut() {
    if (!supabase) return;
    if (!window.confirm("Sign out? Your saved weddings stay in your account.")) return;
    const { error } = await supabase.auth.signOut();
    if (error) setMessage("Sign out failed. Please try again.");
  }

  if (!supabase || !userEmail) return null;
  return (
    <div className="auth-controls">
      <span className="auth-email">{userEmail}</span>
      <button className="button button-secondary" type="button" onClick={signOut}>Sign out</button>
      {message && <span className="status-message" role="status">{message}</span>}
    </div>
  );
}

// The signed-out screen: one email box and one button. No password; Supabase emails a link.
export function SignInCard() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
    if (error) setMessage("We couldn't send the email. Check the address and try again.");
    else setSentTo(email);
  }

  return (
    <section className="panel signin-card" aria-labelledby="signin-title">
      <h1 id="signin-title">Turn a wedding into a blog post</h1>
      <p className="muted-copy">Add the wedding details and describe your favorite photos. We write the blog post, captions and a Reel script in your style, ready for your website.</p>
      {!supabase ? (
        <p className="auth-note">Sign-in isn&rsquo;t set up yet (missing Supabase settings).</p>
      ) : sentTo ? (
        <p className="alert-success" role="status">Check your email ({sentTo}) and tap the link to sign in. You can close this tab.</p>
      ) : (
        <form className="auth-controls" onSubmit={sendSignInLink}>
          <label className="field-label" htmlFor="signin-email">Your email</label>
          <input id="signin-email" className="auth-input" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          <button className="button button-primary" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
          <span className="microcopy">No password needed. We&rsquo;ll email you a link.</span>
          {message && <span className="inline-error" role="alert">{message}</span>}
        </form>
      )}
    </section>
  );
}
