// WHAT: The posting step: send to the blog (when connected), or copy and paste; then social copy.
// WHY: Sending to the blog is the easy path, so it comes first; copy-paste stays as the fallback.
"use client";

import { useState } from "react";
import { makeShowItPack } from "@/lib/showit";
import { cssVar } from "@/lib/motion";
import type { DraftContent, PhotoDescription, WeddingVendor } from "@/lib/types";
import { WordPressControls } from "@/components/WordPressControls";

type Props = { draft: DraftContent; photos: PhotoDescription[]; draftId: string; integrationsEnabled: boolean; vendors: WeddingVendor[]; children?: React.ReactNode; onWordPressDelivered?: (draftUrl: string) => void };

export function ShowItPack({ draft, photos, draftId, integrationsEnabled, vendors, children, onWordPressDelivered }: Props) {
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);
  const pack = makeShowItPack(draft, photos, vendors);

  // WHAT: Copies one formatted field and reports clipboard failures for manual recovery.
  // WHY: Copy is explicit and local; there is no publishing call or hidden ShowIt integration.
  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setCopyError("");
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopyError("Clipboard access failed. Select and copy the text manually.");
      setCopied("");
    }
  }

  async function copyAll() {
    const allFields = [
      `TITLE\n${pack.title}`,
      `SLUG\n${pack.slug}`,
      `META DESCRIPTION\n${pack.metaDescription}`,
      `HEADINGS\n${pack.headings.join("\n")}`,
      `BODY\n${pack.body}`,
      `SOCIAL CAPTION\n${pack.socialCaption}`,
      `HASHTAGS\n${pack.hashtags}`,
      `REELS SCRIPT\n${pack.reelsScript}`,
      ...(pack.vendorCredits ? [`VENDOR CREDITS\n${pack.vendorCredits}`, `CAPTION WITH CREDITS\n${pack.captionWithCredits}`] : []),
      ...(pack.collaborators.length ? [`INSTAGRAM COLLABORATORS\n${pack.collaborators.join(" ")}`] : []),
      ...pack.extraCaptions.map((caption, index) => `ALTERNATIVE CAPTION ${index + 1}\n${caption}`),
      ...(pack.extraFormats.pinterest ? [`PINTEREST DESCRIPTION\n${pack.extraFormats.pinterest}`] : []),
      ...(pack.extraFormats.emailSneakPeek ? [`EMAIL SNEAK-PEEK\n${pack.extraFormats.emailSneakPeek}`] : []),
      ...pack.photos.flatMap((photo, index) => [
        `PHOTO ${index + 1} FILENAME\n${photo.fileName}`,
        `PHOTO ${index + 1} CAPTION\n${photo.caption}`,
        `PHOTO ${index + 1} ALT TEXT\n${photo.altText}`,
      ]),
    ].join("\n\n");
    try {
      await navigator.clipboard.writeText(allFields);
      setCopiedAll(true);
      setCopied("");
      setCopyError("");
    } catch {
      setCopyError("Clipboard access failed. Select and copy the fields manually.");
      setCopiedAll(false);
    }
  }

  function copyButton(label: string, value: string) {
    return <button className={`button button-secondary copy-button ${copied === label ? "is-copied" : ""}`} type="button" onClick={() => copy(label, value)}>{copied === label ? "Copied" : "Copy"}</button>;
  }

  return (
    <>
      {integrationsEnabled && <WordPressControls draftId={draftId} integrationsEnabled={integrationsEnabled} onDelivered={onWordPressDelivered} />}
      <section className="panel showit-panel">
        <details className="pack-details" open={!integrationsEnabled}>
          <summary>
            <span className="pack-summary-title">{integrationsEnabled ? "Prefer to copy and paste?" : "Copy your post into Showit"}</span>
          </summary>
          <p className="muted-copy">Copy each piece and paste it into your Showit blog. &ldquo;Copy everything&rdquo; puts it all on your clipboard at once.</p>
          <div className="inline-actions">
            <button className={`button button-primary ${copiedAll ? "is-copied" : ""}`} type="button" onClick={copyAll}>{copiedAll ? "Copied everything" : "Copy everything"}</button>
          </div>
          {copyError && <p className="inline-error" role="alert">{copyError}</p>}
          <div className="pack-fields">
            <PackField index={0} label="Title" value={pack.title} button={copyButton("title", pack.title)} />
            <PackField index={1} label="Blog post" value={pack.body} button={copyButton("body", pack.body)} />
            {pack.vendorCredits && <PackField index={2} label="Vendor credits" value={pack.vendorCredits} button={copyButton("vendor-credits", pack.vendorCredits)} />}
            <details className="import-details">
              <summary>Photo names, captions and descriptions</summary>
              <p className="muted-copy">Rename each photo file before uploading, and paste its description into the image&rsquo;s &ldquo;alt text&rdquo; box.</p>
              {pack.photos.map((photo, index) => (
                <div className="pack-photo" key={`pack-photo-${index}`} style={cssVar("--i", index)}>
                  <h3>Photo {index + 1}</h3>
                  <PackField index={0} label="File name" value={photo.fileName} button={copyButton(`filename-${index}`, photo.fileName)} />
                  <PackField index={1} label="Caption" value={photo.caption} button={copyButton(`caption-${index}`, photo.caption)} />
                  <PackField index={2} label="Description (alt text)" value={photo.altText} button={copyButton(`alt-${index}`, photo.altText)} />
                </div>
              ))}
            </details>
            <details className="import-details">
              <summary>Google details</summary>
              <PackField index={0} label="Web address ending" value={pack.slug} button={copyButton("slug", pack.slug)} />
              <PackField index={1} label="Google summary" value={pack.metaDescription} button={copyButton("meta", pack.metaDescription)} />
            </details>
          </div>
        </details>
      </section>
      <section className="panel showit-panel">
        <details className="pack-details">
          <summary><span className="pack-summary-title">Instagram &amp; TikTok</span></summary>
          <div className="pack-fields">
            <PackField index={0} label={pack.vendorCredits ? "Caption with vendor credits" : "Caption"} value={pack.vendorCredits ? pack.captionWithCredits : `${pack.socialCaption}\n\n${pack.hashtags}`} button={copyButton("caption-credits", pack.vendorCredits ? pack.captionWithCredits : `${pack.socialCaption}\n\n${pack.hashtags}`)} />
            {pack.collaborators.length > 0 && <PackField index={1} label="Tag as collaborators" value={`${pack.collaborators.join(" ")}\n\nAdd these accounts as collaborators when you post (up to 5).`} button={copyButton("collaborators", pack.collaborators.join(" "))} />}
            <PackField index={2} label="Reel / TikTok script" value={pack.reelsScript} button={copyButton("reels-script", pack.reelsScript)} />
            {pack.extraCaptions.map((caption, index) => (
              <PackField key={`extra-caption-${index}`} index={3 + index} label={`Another caption idea ${index + 1}`} value={caption} button={copyButton(`extra-caption-${index}`, caption)} />
            ))}
            {pack.extraFormats.pinterest && <PackField index={5} label="Pinterest description" value={pack.extraFormats.pinterest} button={copyButton("pinterest", pack.extraFormats.pinterest)} />}
            {pack.extraFormats.emailSneakPeek && <PackField index={6} label="Sneak-peek email to the couple" value={pack.extraFormats.emailSneakPeek} button={copyButton("email-sneak-peek", pack.extraFormats.emailSneakPeek)} />}
          </div>
        </details>
      </section>
      {children}
    </>
  );
}

function PackField({ label, value, button, index }: { label: string; value: string; button: React.ReactNode; index: number }) {
  return (
    <div className="pack-field" style={cssVar("--i", index)}>
      <div className="pack-field-heading"><h3>{label}</h3>{button}</div>
      <pre>{value}</pre>
    </div>
  );
}
