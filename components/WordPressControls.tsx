// WHAT: Connects the user's WordPress blog once, then sends each approved post there as a draft.
// WHY: Showit blogs run on WordPress; a one-click draft beats copying a dozen fields by hand.
"use client";

import { useEffect, useState } from "react";

type Props = { draftId: string; integrationsEnabled: boolean; onDelivered?: (draftUrl: string) => void };
type ConnectionResult = { connected: boolean; siteUrl: string | null };
type DeliveryResult = { draftUrl: string; status: "draft" };

async function requestJson<T>(url: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : "WordPress could not complete the request.";
    throw new Error(message);
  }
  return result as T;
}

export function WordPressControls({ draftId, integrationsEnabled, onDelivered }: Props) {
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draftUrl, setDraftUrl] = useState("");

  useEffect(() => {
    if (!integrationsEnabled) return;
    let active = true;
    requestJson<ConnectionResult>("/api/wordpress/connection", "GET")
      .then((result) => {
        if (!active) return;
        setConnected(result.connected);
        setSiteUrl(result.siteUrl ?? "");
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "WordPress settings could not be loaded.");
      });
    return () => { active = false; };
  }, [integrationsEnabled]);

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestJson<ConnectionResult>("/api/wordpress/connection", "POST", {
        siteUrl,
        username,
        applicationPassword,
      });
      setConnected(result.connected);
      setSiteUrl(result.siteUrl ?? siteUrl);
      setUsername("");
      setApplicationPassword("");
      setNotice("Your blog is connected.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't connect to your blog. Check the address, username and app password.");
    } finally {
      setBusy(false);
    }
  }

  async function sendDraft() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestJson<DeliveryResult>("/api/wordpress/posts", "POST", { draftId });
      setDraftUrl(result.draftUrl);
      onDelivered?.(result.draftUrl);
      setNotice("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The WordPress draft could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  const connectForm = (
    <form className="wordpress-form" onSubmit={connect}>
      <label className="field">
        <span className="field-label">Your website address</span>
        <input type="url" required maxLength={300} placeholder="https://llenavidamedia.com" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">WordPress username</span>
        <span className="field-source">The name you use to log in to your blog&rsquo;s WordPress dashboard.</span>
        <input autoComplete="username" required maxLength={120} value={username} onChange={(event) => setUsername(event.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">App password</span>
        <span className="field-source">Not your normal password. See the steps above.</span>
        <input type="password" autoComplete="new-password" required minLength={8} maxLength={300} value={applicationPassword} onChange={(event) => setApplicationPassword(event.target.value)} />
      </label>
      <div className="inline-actions">
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Checking…" : connected ? "Save new connection" : "Connect my blog"}</button>
      </div>
    </form>
  );

  return (
    <section className="panel wordpress-panel" aria-labelledby="wordpress-title">
      <div className="panel-heading">
        <div>
          <h2 id="wordpress-title">Put it on your blog</h2>
        </div>
      </div>
      {connected ? (
        <>
          <p className="muted-copy">We&rsquo;ll send the post to your blog as a draft. Nothing goes live until you open it in WordPress and press Publish.</p>
          <div className="inline-actions">
            <button className="button button-primary" type="button" onClick={sendDraft} disabled={busy || Boolean(draftUrl)}>{busy ? "Sending…" : draftUrl ? "Sent to your blog" : "Send to my blog"}</button>
          </div>
          {draftUrl && <p className="alert-success" role="status">Done! <a href={draftUrl} target="_blank" rel="noreferrer">Open it in WordPress</a> to add photos, check it, and press Publish.</p>}
          <details className="import-details">
            <summary>Change which blog this connects to</summary>
            {connectForm}
          </details>
        </>
      ) : (
        <>
          <p className="muted-copy">Connect your blog once, and from then on each post goes there with one click (as a draft you publish yourself).</p>
          <ol className="plain-steps">
            <li>Log in to your blog&rsquo;s WordPress dashboard.</li>
            <li>Go to <strong>Users</strong>, then <strong>Profile</strong>, and scroll to <strong>Application Passwords</strong>.</li>
            <li>Type <strong>Gathered Stories</strong> as the name and click <strong>Add</strong>.</li>
            <li>Copy the password it shows (you only see it once) and paste it below.</li>
          </ol>
          <p className="field-source">Don&rsquo;t see Application Passwords? Your website host may have turned it off. Use &ldquo;copy and paste&rdquo; below instead.</p>
          {connectForm}
        </>
      )}
      {notice && !draftUrl && <p className="alert-success" role="status">{notice}</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </section>
  );
}
