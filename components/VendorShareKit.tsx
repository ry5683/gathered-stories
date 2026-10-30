// WHAT: Per-vendor "you're featured" messages with copy, email, Instagram, and sent tracking.
// WHY: Sharing the post with vendors is how photographers earn referrals; this makes it a two-minute job.
// Messages are a fixed template filled with saved facts. Nothing is sent from the app: email opens the
// photographer's own mail app with no recipient, and Instagram opens the vendor's profile.
"use client";

import { useState } from "react";
import { buildShareMessage, instagramProfileUrl, isHttpsUrl, mailtoLink, orderVendors, roleLabel, type WeddingVendor } from "@/lib/credits";

export type PostLinkInfo = { wordpressUrl: string | null; isPublished: boolean; postUrl: string | null };

type Props = {
  vendors: WeddingVendor[];
  venue: string;
  weddingDate: string;
  link: PostLinkInfo;
  profile: { photographerName: string; photographerInstagram: string };
  onSavePostUrl: (url: string) => Promise<void>;
  onMarkSent: (vendorId: string, sent: boolean) => Promise<void>;
  onEditProfile: () => void;
  onEditVendors: () => void;
};

// The link vendors get: a pasted live link wins, then the WordPress post (its ?p= link redirects once published).
export function resolvePostLink(link: PostLinkInfo): { url: string | null; warning: string } {
  if (link.postUrl) return { url: link.postUrl, warning: "" };
  if (link.wordpressUrl && link.isPublished) return { url: link.wordpressUrl, warning: "" };
  if (link.wordpressUrl) return { url: link.wordpressUrl, warning: "This is the WordPress draft link. It only works for vendors once the post is published." };
  return { url: null, warning: "" };
}

export function VendorShareKit({ vendors, venue, weddingDate, link, profile, onSavePostUrl, onMarkSent, onEditProfile, onEditVendors }: Props) {
  const [postUrlDraft, setPostUrlDraft] = useState(link.postUrl ?? "");
  const [copied, setCopied] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const resolved = resolvePostLink(link);
  const ordered = orderVendors(vendors);
  const sentCount = vendors.filter((item) => item.sharedAt).length;
  const hasCredit = Boolean(profile.photographerName.trim() || profile.photographerInstagram.trim());

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setMessage("Clipboard access failed. Select and copy the text manually.");
    }
  }

  async function savePostUrl() {
    const value = postUrlDraft.trim();
    if (value && !isHttpsUrl(value, 500)) {
      setMessage("The post link must start with https://");
      return;
    }
    setBusyId("post-url");
    try {
      await onSavePostUrl(value);
      setMessage(value ? "Post link saved. Messages now include it." : "Post link cleared.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The link could not be saved.");
    } finally {
      setBusyId("");
    }
  }

  async function markSent(vendorId: string, sent: boolean) {
    setBusyId(vendorId);
    try {
      await onMarkSent(vendorId, sent);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "That couldn't be saved.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="share-kit" aria-labelledby="share-kit-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Share with vendors</p>
          <h2 id="share-kit-title">Let them know they&apos;re featured</h2>
        </div>
        {vendors.length > 0 && <span className="count-badge">{sentCount} of {vendors.length} sent</span>}
      </div>

      {vendors.length === 0 ? (
        <div className="inline-actions">
          <p className="muted-copy">Add the vendors who worked this wedding to get a ready-to-send message for each.</p>
          <button className="button button-secondary" type="button" onClick={onEditVendors}>Add vendors</button>
        </div>
      ) : (
        <>
          <div className="share-kit-setup">
            <label className="field" htmlFor="post-url">
              <span className="field-label">Live post link</span>
              <span className="field-source">
                {resolved.url && !link.postUrl ? "Using your WordPress post. Paste the live link to use a different one." : "Paste the link once the post is live."}
              </span>
              <div className="vendor-add">
                <input id="post-url" type="url" maxLength={500} placeholder="https://" value={postUrlDraft} onChange={(event) => setPostUrlDraft(event.target.value)} />
                <button className="button button-secondary" type="button" onClick={savePostUrl} disabled={busyId === "post-url"}>Save link</button>
              </div>
            </label>
            {resolved.warning && <p className="microcopy share-kit-warning">{resolved.warning}</p>}
            {!hasCredit && (
              <p className="microcopy">
                Add your name and Instagram handle so vendors can credit you.{" "}
                <button className="text-button" type="button" onClick={onEditProfile}>Add your credit line</button>
              </p>
            )}
          </div>

          <ul className="vendor-list">
            {ordered.map((item) => {
              const share = buildShareMessage({
                vendor: item.vendor,
                venue,
                weddingDate,
                postUrl: resolved.url,
                photographerName: profile.photographerName || null,
                photographerInstagram: profile.photographerInstagram || null,
              });
              const id = item.vendor.id;
              return (
                <li className="vendor-row share-row" key={id}>
                  <div className="vendor-row-copy">
                    <span className="vendor-role">{roleLabel(item.vendor)}</span>
                    <span className="vendor-name">{item.vendor.businessName}</span>
                    {item.sharedAt && <span className="status-pill status-approved">Sent {new Date(item.sharedAt).toLocaleDateString()}</span>}
                  </div>
                  <details className="share-message">
                    <summary>Preview message</summary>
                    <pre>{share.body}</pre>
                  </details>
                  <div className="vendor-row-actions">
                    <button className="button button-secondary copy-button" type="button" onClick={() => copy(`msg-${id}`, share.body)}>{copied === `msg-${id}` ? "Copied" : "Copy message"}</button>
                    {hasCredit && <button className="button button-secondary copy-button" type="button" onClick={() => copy(`credit-${id}`, share.creditLine)}>{copied === `credit-${id}` ? "Copied" : "Copy credit line"}</button>}
                    <a className="button button-secondary copy-button" href={mailtoLink(share)}>Open in email</a>
                    {item.vendor.instagramHandle && (
                      <a className="button button-secondary copy-button" href={instagramProfileUrl(item.vendor.instagramHandle)} target="_blank" rel="noreferrer">Open Instagram</a>
                    )}
                    <label className="check-row">
                      <input type="checkbox" checked={Boolean(item.sharedAt)} disabled={busyId === id} onChange={(event) => markSent(id, event.target.checked)} />
                      <span>Sent</span>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {message && <p className="status-message" role="status">{message}</p>}
    </section>
  );
}
