// WHAT: Formats the approved draft into discrete ShowIt fields with copy controls.
// WHY: ShowIt stays a manual handoff; optional WordPress draft delivery is separate.
"use client";

import { useState } from "react";
import { makeShowItPack } from "@/lib/showit";
import { cssVar } from "@/lib/motion";
import type { DraftContent, PhotoDescription } from "@/lib/types";
import { WordPressControls } from "@/components/WordPressControls";

type Props = { draft: DraftContent; photos: PhotoDescription[]; draftId: string; integrationsEnabled: boolean };

export function ShowItPack({ draft, photos, draftId, integrationsEnabled }: Props) {
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);
  const pack = makeShowItPack(draft, photos);

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
    <section className="panel showit-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Approved draft · manual handoff</p>
          <h2>Your ShowIt-ready pack</h2>
        </div>
        <button className={`button button-primary ${copiedAll ? "is-copied" : ""}`} type="button" onClick={copyAll}>{copiedAll ? "All fields copied" : "Copy all"}</button>
      </div>
      <p className="muted-copy">Copy and paste into ShowIt yourself. ShowIt is never auto-published from this app.</p>
      {copiedAll && <p className="status-message" role="status">Copy all is ready to paste. The pack remains here if you need individual fields.</p>}
      {copyError && <p className="inline-error" role="alert">{copyError}</p>}
      <div className="pack-fields">
        <PackField index={0} label="Title" value={pack.title} button={copyButton("title", pack.title)} />
        <PackField index={1} label="Slug" value={pack.slug} button={copyButton("slug", pack.slug)} />
        <PackField index={2} label="Meta description" value={pack.metaDescription} button={copyButton("meta", pack.metaDescription)} />
        <PackField index={3} label="Headings" value={pack.headings.length ? pack.headings.join("\n") : "No markdown headings found"} button={copyButton("headings", pack.headings.join("\n"))} />
        <PackField index={4} label="Body" value={pack.body} button={copyButton("body", pack.body)} />
        <PackField index={5} label="Social caption" value={pack.socialCaption} button={copyButton("social-caption", pack.socialCaption)} />
        <PackField index={6} label="Hashtags" value={pack.hashtags} button={copyButton("hashtags", pack.hashtags)} />
        <PackField index={7} label="Reels / TikTok script" value={pack.reelsScript} button={copyButton("reels-script", pack.reelsScript)} />
        {pack.photos.map((photo, index) => (
          <div className="pack-photo" key={`pack-photo-${index}`} style={cssVar("--i", index)}>
            <h3>Photo {index + 1}</h3>
            <PackField index={8} label="Filename" value={photo.fileName} button={copyButton(`filename-${index}`, photo.fileName)} />
            <PackField index={5} label="Caption" value={photo.caption} button={copyButton(`caption-${index}`, photo.caption)} />
            <PackField index={6} label="Alt text" value={photo.altText} button={copyButton(`alt-${index}`, photo.altText)} />
          </div>
        ))}
        <details className="import-details">
          <summary>Optional captions and formats</summary>
          {pack.extraCaptions.map((caption, index) => (
            <PackField key={`extra-caption-${index}`} index={index} label={`Alternative caption ${index + 1}`} value={caption} button={copyButton(`extra-caption-${index}`, caption)} />
          ))}
          {pack.extraFormats.pinterest && <PackField index={0} label="Pinterest description" value={pack.extraFormats.pinterest} button={copyButton("pinterest", pack.extraFormats.pinterest)} />}
          {pack.extraFormats.emailSneakPeek && <PackField index={1} label="Email sneak-peek" value={pack.extraFormats.emailSneakPeek} button={copyButton("email-sneak-peek", pack.extraFormats.emailSneakPeek)} />}
        </details>
      </div>
      <WordPressControls draftId={draftId} integrationsEnabled={integrationsEnabled} />
    </section>
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
