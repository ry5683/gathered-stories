// WHAT: Shows the written post for editing, with the extras (social, Google details) folded away.
// WHY: The title and post are what people read; everything else is filled in for them and only
// needs a glance. Edits autosave; approving only moves to the posting step, it never publishes.
"use client";

import { buildBlogCredits, CREDITS_HEADING, type WeddingVendor } from "@/lib/credits";
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
  vendors: WeddingVendor[];
  onEditVendors: () => void;
};

export function DraftReview({ draft, approved, busy, voice, similarityWarning, saveStatus, onChange, onVoiceChange, onRegenerate, onApprove, vendors, onEditVendors }: Props) {
  // WHAT: Applies one field edit to the current draft.
  // WHY: The parent owns the draft state so save, rewrite, and approval operate on the same content.
  function update<K extends keyof DraftContent>(key: K, value: DraftContent[K]) {
    onChange({ ...draft, [key]: value });
  }

  function rewrite() {
    if (window.confirm("Write a new version? This replaces the current text, including any changes you made.")) onRegenerate();
  }

  const locked = approved || busy;

  return (
    <section className="panel draft-panel">
      <div className="panel-heading">
        <div>
          <h2>Your blog post</h2>
        </div>
      </div>
      <p className="muted-copy">
        {approved
          ? "This post is approved. Go back to the photos step if you want to start a new version."
          : "Read it over and change anything you like. Your changes save on their own."}
      </p>
      {similarityWarning && <p className="status-message" role="status">This sounds a lot like one of your earlier posts. Change a few lines so it doesn&rsquo;t repeat itself.</p>}
      {!approved && saveStatus && saveStatus !== "Saved" && <p className="microcopy" role="status">{saveStatus}</p>}

      <div className="draft-fields">
        <label className="field">
          <span className="field-label">Title</span>
          <input value={draft.title} onChange={(event) => update("title", event.target.value)} disabled={locked} />
        </label>
        <label className="field">
          <span className="field-label">Blog post</span>
          <span className="field-source">Lines starting with ## become headings on your blog.</span>
          <textarea className="body-editor" rows={18} value={draft.body} onChange={(event) => update("body", event.target.value)} disabled={locked} />
        </label>
        <div className="field credits-preview">
          <div className="pack-field-heading">
            <span className="field-label">{CREDITS_HEADING}</span>
            <button className="button button-secondary copy-button" type="button" onClick={onEditVendors}>{vendors.length ? "Edit vendors" : "Add vendors"}</button>
          </div>
          {vendors.length ? <pre>{buildBlogCredits(vendors)}</pre> : <p className="muted-copy">No vendors yet. They&rsquo;re listed at the end of your post with links.</p>}
        </div>

        <details className="import-details">
          <summary>Instagram &amp; TikTok</summary>
          <label className="field">
            <span className="field-label">Caption</span>
            <textarea rows={4} value={draft.caption} onChange={(event) => update("caption", event.target.value)} disabled={locked} />
          </label>
          <label className="field">
            <span className="field-label">Hashtags</span>
            <textarea rows={2} value={draft.hashtags} onChange={(event) => update("hashtags", event.target.value)} disabled={locked} />
          </label>
          <label className="field">
            <span className="field-label">Reel / TikTok script</span>
            <textarea rows={6} value={draft.reelsScript} onChange={(event) => update("reelsScript", event.target.value)} disabled={locked} />
          </label>
          {draft.extraCaptions.map((caption, index) => (
            <label className="field" key={`extra-caption-${index}`}>
              <span className="field-label">Another caption idea {index + 1}</span>
              <textarea rows={3} value={caption} onChange={(event) => update("extraCaptions", draft.extraCaptions.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} disabled={locked} />
            </label>
          ))}
          <label className="field">
            <span className="field-label">Pinterest description</span>
            <textarea rows={3} value={draft.extraFormats.pinterest ?? ""} onChange={(event) => update("extraFormats", { ...draft.extraFormats, pinterest: event.target.value })} disabled={locked} />
          </label>
          <label className="field">
            <span className="field-label">Sneak-peek email to the couple</span>
            <textarea rows={3} value={draft.extraFormats.emailSneakPeek ?? ""} onChange={(event) => update("extraFormats", { ...draft.extraFormats, emailSneakPeek: event.target.value })} disabled={locked} />
          </label>
        </details>

        <details className="import-details">
          <summary>Google details (already filled in)</summary>
          <p className="muted-copy">These help couples find this post on Google. You don&rsquo;t have to change them.</p>
          <label className="field">
            <span className="field-label">Web address ending</span>
            <span className="field-source">The last part of the post&rsquo;s link. Lowercase words with dashes.</span>
            <input value={draft.slug} onChange={(event) => update("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))} disabled={locked} />
          </label>
          <label className="field">
            <span className="field-label">Google summary</span>
            <span className="field-source">The short description shown under the title in search results.</span>
            <textarea rows={2} value={draft.metaDescription} onChange={(event) => update("metaDescription", event.target.value)} disabled={locked} />
          </label>
          <div className="field">
            <span className="field-label">Photo descriptions</span>
            <span className="field-source">Read aloud by screen readers and used by Google. One per photo, in order.</span>
            {draft.altTexts.map((text, index) => (
              <label className="alt-row" key={`alt-${index}`} style={cssVar("--i", index)}>
                <span className="sr-only">Description for photo {index + 1}</span>
                <span className="alt-number">{index + 1}</span>
                <input value={text} onChange={(event) => update("altTexts", draft.altTexts.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} disabled={locked} />
              </label>
            ))}
          </div>
        </details>
      </div>

      {!approved && (
        <details className="import-details rewrite-details">
          <summary>Not quite right? Write a new version</summary>
          <div className="inline-actions">
            <label className="voice-control">
              <span>Tone</span>
              <select aria-label="Tone" value={voice} onChange={(event) => onVoiceChange(event.target.value as "delicate" | "active")} disabled={busy}>
                <option value="active">Fun &amp; playful</option>
                <option value="delicate">Soft &amp; romantic</option>
              </select>
            </label>
            <button className="button button-secondary" type="button" onClick={rewrite} disabled={busy}>{busy ? "Writing…" : "Write a new version"}</button>
          </div>
        </details>
      )}

      {!approved && (
        <div className="step-actions">
          <button className="button button-approve" type="button" onClick={onApprove} disabled={busy}>{busy ? "Saving…" : "Looks good, next step"} <span className="btn-arrow" aria-hidden="true">→</span></button>
        </div>
      )}
    </section>
  );
}
