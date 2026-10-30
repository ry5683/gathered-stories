"use client";

import { useEffect, useState } from "react";

type Props = { draftId: string; integrationsEnabled: boolean };
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

export function WordPressControls({ draftId, integrationsEnabled }: Props) {
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
      setNotice("WordPress connected. Credentials are stored encrypted on the server.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "WordPress could not be connected.");
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
      setNotice("Sent to WordPress as a draft. It is not live until you publish it there.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The WordPress draft could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel wordpress-panel" aria-labelledby="wordpress-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Optional delivery</p>
          <h2 id="wordpress-title">WordPress draft</h2>
        </div>
        <span className="sample-badge">{connected ? "Connected" : "Not connected"}</span>
      </div>
      {!integrationsEnabled ? (
        <p className="muted-copy">Optional WordPress delivery needs server-side Supabase service access and a 32-byte encryption key. You can still copy the ShowIt pack above.</p>
      ) : (
        <>
          <p className="muted-copy">WordPress receives an unpublished draft only. This app never publishes it automatically.</p>
          <form className="wordpress-form" onSubmit={connect}>
            <label className="field">
              <span className="field-label">WordPress site URL (HTTPS)</span>
              <input type="url" required maxLength={300} placeholder="https://example.com" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">WordPress username</span>
              <input autoComplete="username" required maxLength={120} value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Application password</span>
              <input type="password" autoComplete="new-password" required minLength={8} maxLength={300} value={applicationPassword} onChange={(event) => setApplicationPassword(event.target.value)} />
            </label>
            <div className="inline-actions">
              <button className="button button-secondary" type="submit" disabled={busy}>{busy ? "Verifying…" : connected ? "Update connection" : "Connect WordPress"}</button>
              {connected && <button className="button button-primary" type="button" onClick={sendDraft} disabled={busy}>{busy ? "Sending…" : "Send as WordPress draft"}</button>}
            </div>
          </form>
        </>
      )}
      {draftUrl && <p className="status-message" role="status"><a href={draftUrl} target="_blank" rel="noreferrer">Open WordPress draft</a></p>}
      {notice && <p className="alert-success" role="status">{notice}</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </section>
  );
}
