// WHAT: Shows and edits every generated field before it can be approved.
// WHY: Claude output is a private draft; autosave and explicit approval are separate actions.
"use client";

import { useEffect, useState } from "react";
import type { DraftContent } from "@/lib/types";
import { cssVar } from "@/lib/motion";

type Props = {
  draft: DraftContent;
  approved: boolean;
  busy: boolean;
  voice: "delicate" | "active";
  similarityWarning: boolean;
  saveStatus: string;
  onChange: (draft: DraftContent) => void;
  onVoiceChange: (voice: "delicate" | "active") => void;
  onRegenerate: () => void;
  onApprove: () => void;
};

export function DraftReview({ draft, approved, busy, voice, similarityWarning, saveStatus, onChange, onVoiceChange, onRegenerate, onApprove }: Props) {
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const contentKey = JSON.stringify(draft);

  useEffect(() => {
    setApprovalConfirmed(false);
  }, [contentKey]);
  // WHAT: Applies one field edit to the current draft.
  // WHY: The parent owns the draft state so save, rewrite, and approval operate on the same content.
  function update<K extends keyof DraftContent>(key: K, value: DraftContent[K]) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <section className="panel draft-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Editable draft · {approved ? "Approved" : "Not published"}</p>
          <h2>Read it in your voice</h2>
        </div>
        <label className="voice-control">
          <span>Voice</span>
          <select aria-label="Voice" value={voice} onChange={(event) => onVoiceChange(event.target.value as "delicate" | "active")} disabled={approved || busy}>
            <option value="delicate">Delicate / romantic</option>
            <option value="active">Fun / active</option>
          </select>
        </label>
      </div>
      <p className="muted-copy">Use the voice switch and rewrite to change the tone. Rewriting replaces the current draft text, including saved edits. Approval only marks this draft approved; it never publishes.</p>
      {similarityWarning && <p className="status-message" role="status">This draft may be similar to previous work. Review it carefully and make it your own before approval.</p>}
      {!approved && <p className="status-message" role="status">{saveStatus === "Saved" ? "Edits saved automatically." : saveStatus || "Edits save automatically."}</p>}
      <div className="draft-fields">
        <label className="field">
          <span className="field-label">Blog title</span>
          <input value={draft.title} onChange={(event) => update("title", event.target.value)} disabled={approved || busy} />
        </label>
        <label className="field">
          <span className="field-label">Slug</span>
          <input value={draft.slug} onChange={(event) => update("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))} disabled={approved || busy} />
        </label>
        <label className="field">
          <span className="field-label">Meta description</span>
          <textarea rows={2} value={draft.metaDescription} onChange={(event) => update("metaDescription", event.target.value)} disabled={approved || busy} />
        </label>
        <label className="field">
          <span className="field-label">Blog post</span>
          <textarea className="body-editor" rows={18} value={draft.body} onChange={(event) => update("body", event.target.value)} disabled={approved || busy} />
        </label>
        <label className="field">
          <span className="field-label">Reels / TikTok script</span>
          <textarea rows={6} value={draft.reelsScript} onChange={(event) => update("reelsScript", event.target.value)} disabled={approved || busy} />
        </label>
        <label className="field">
          <span className="field-label">Social caption</span>
          <textarea rows={4} value={draft.caption} onChange={(event) => update("caption", event.target.value)} disabled={approved || busy} />
        </label>
        <label className="field">
          <span className="field-label">Hashtags</span>
          <textarea rows={2} value={draft.hashtags} onChange={(event) => update("hashtags", event.target.value)} disabled={approved || busy} />
        </label>
        <details className="import-details">
          <summary>Optional captions and formats</summary>
          {draft.extraCaptions.map((caption, index) => (
            <label className="field" key={`extra-caption-${index}`}>
              <span className="field-label">Alternative caption {index + 1}</span>
              <textarea rows={3} value={caption} onChange={(event) => update("extraCaptions", draft.extraCaptions.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} disabled={approved || busy} />
            </label>
          ))}
          <label className="field">
            <span className="field-label">Pinterest description</span>
            <textarea rows={3} value={draft.extraFormats.pinterest ?? ""} onChange={(event) => update("extraFormats", { ...draft.extraFormats, pinterest: event.target.value })} disabled={approved || busy} />
          </label>
          <label className="field">
            <span className="field-label">Email sneak-peek</span>
            <textarea rows={3} value={draft.extraFormats.emailSneakPeek ?? ""} onChange={(event) => update("extraFormats", { ...draft.extraFormats, emailSneakPeek: event.target.value })} disabled={approved || busy} />
          </label>
        </details>
        <div className="field">
          <span className="field-label">Alt text for each photo</span>
          {draft.altTexts.map((text, index) => (
            <label className="alt-row" key={`alt-${index}`} style={cssVar("--i", index)}>
              <span className="sr-only">Alt text for photo {index + 1}</span>
              <span className="alt-number">{index + 1}</span>
              <input value={text} onChange={(event) => update("altTexts", draft.altTexts.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} disabled={approved || busy} />
            </label>
          ))}
        </div>
      </div>
      <div className="step-actions">
        {!approved && <button className="button button-secondary" type="button" onClick={onRegenerate} disabled={busy}>{busy ? "Regenerating…" : "Rewrite in this voice"}</button>}
        {!approved && (
          <label className="check-row approval-check">
            <input type="checkbox" checked={approvalConfirmed} onChange={(event) => setApprovalConfirmed(event.target.checked)} />
            <span>I reviewed this draft and approve it for the ShowIt copy step. This does not publish it.</span>
          </label>
        )}
        {!approved && <button className="button button-approve" type="button" onClick={onApprove} disabled={busy || !approvalConfirmed}>{busy ? "Approving…" : "Approve draft"}</button>}
      </div>
      <p className="microcopy">Approval changes the workflow status only. Copy the approved content into ShowIt yourself.</p>
    </section>
  );
}
