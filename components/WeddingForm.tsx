// WHAT: Edits venue and wedding details, including safe field-only import.
// WHY: Each value identifies its source, and raw pasted questionnaires are parsed locally
// and discarded rather than saved or sent to the AI.
"use client";

import { useState } from "react";
import type { Wedding } from "@/lib/types";

type WeddingTextField =
  | "venue" | "city" | "weddingDate" | "ceremonyTime" | "receptionTime"
  | "dressCode" | "palette" | "editStyle" | "musicLoved" | "musicRejected";

type Props = {
  wedding: Wedding;
  onChange: (wedding: Wedding) => void;
};

const CORE_FIELDS: Array<{ key: "venue" | "city" | "weddingDate"; label: string; placeholder: string; type?: string }> = [
  { key: "venue", label: "Venue", placeholder: "e.g. The Churchill House" },
  { key: "city", label: "City", placeholder: "e.g. Escondido" },
  // Plain text, not a date picker: older weddings and HoneyBook pastes hold dates like "Aug 30, 2025".
  { key: "weddingDate", label: "Wedding date", placeholder: "e.g. August 30, 2025" },
];

// Only details the writer actually uses. Ceremony/reception times and dress code are still saved
// for older weddings but aren't shown, because they never reach the blog post.
const DETAIL_FIELDS: Array<{ key: "palette" | "editStyle" | "musicLoved"; label: string; placeholder: string }> = [
  { key: "palette", label: "Colors", placeholder: "e.g. black, deep red, gold" },
  { key: "editStyle", label: "Style or vibe", placeholder: "e.g. moody, goth, rock and roll" },
  { key: "musicLoved", label: "Music the couple loved", placeholder: "e.g. 80s rock, mariachi" },
];

export function WeddingForm({ wedding, onChange }: Props) {
  const [pastedText, setPastedText] = useState("");
  const [importMessage, setImportMessage] = useState("");

  // WHAT: Imports only recognized scalar wedding fields from JSON or labeled text.
  // WHY: The raw questionnaire stays in this component and is discarded after parsing.
  function importFields() {
    try {
      const aliases: Record<string, WeddingTextField> = {
        venue: "venue",
        "venue name": "venue",
        city: "city",
        "wedding date": "weddingDate",
        date: "weddingDate",
        "event date": "weddingDate",
        "ceremony time": "ceremonyTime",
        "reception time": "receptionTime",
        "dress code": "dressCode",
        palette: "palette",
        "color palette": "palette",
        "colour palette": "palette",
        "edit style": "editStyle",
        "editing style": "editStyle",
        "music loved": "musicLoved",
        "music they love": "musicLoved",
        "music to reject": "musicRejected",
        "music rejected": "musicRejected",
      };
      const normalize = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, " ");
      let incoming: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(pastedText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not-object");
        incoming = parsed as Record<string, unknown>;
      } catch {
        incoming = Object.fromEntries(pastedText.split(/\r?\n/).flatMap((line) => {
          const match = line.match(/^\s*([^:=]+)\s*[:=]\s*(.*?)\s*$/);
          return match ? [[match[1], match[2]]] : [];
        }));
      }
      const next = { ...wedding };
      let updated = 0;
      for (const [label, rawValue] of Object.entries(incoming)) {
        const key = aliases[normalize(label)];
        if (key && typeof rawValue === "string" && rawValue.trim()) {
          next[key] = rawValue.trim();
          updated += 1;
        }
      }
      if (!updated) {
        setImportMessage("Nothing we recognize. Make sure lines look like \"Venue: ...\" or \"Date: ...\".");
        return;
      }
      onChange(next);
      setPastedText("");
      setImportMessage(`Filled in ${updated} field${updated === 1 ? "" : "s"}.`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Could not read those details.");
    }
  }

  return (
    <section className="panel form-panel" aria-labelledby="wedding-details-title">
      <div className="panel-heading">
        <div>
          <h2 id="wedding-details-title">Wedding details</h2>
        </div>
      </div>
      <p className="muted-copy">Where and when was it? These go into your blog post title, which helps couples find you on Google.</p>
      <div className="field-grid">
        {CORE_FIELDS.map(({ key, label, placeholder, type }) => (
          <label className="field" key={key}>
            <span className="field-label">{label}</span>
            <input type={type ?? "text"} placeholder={placeholder} value={wedding[key]} onChange={(event) => onChange({ ...wedding, [key]: event.target.value })} />
          </label>
        ))}
      </div>
      <details className="import-details">
        <summary>More details (optional)</summary>
        <div className="field-grid detail-grid">
          {DETAIL_FIELDS.map(({ key, label, placeholder }) => (
            <label className="field" key={key}>
              <span className="field-label">{label}</span>
              <input placeholder={placeholder} value={wedding[key]} onChange={(event) => onChange({ ...wedding, [key]: event.target.value })} />
            </label>
          ))}
        </div>
      </details>
      <details className="import-details paste-details">
        <summary>Copy details from HoneyBook (optional)</summary>
        <p className="muted-copy">Copy the venue, city and date from HoneyBook and paste them here. We&rsquo;ll fill in the boxes above. Anything else you paste is ignored.</p>
        <textarea aria-label="Paste details from HoneyBook" rows={4} placeholder={"Venue: The Churchill House\nCity: Escondido\nDate: 2025-08-30"} value={pastedText} onChange={(event) => setPastedText(event.target.value)} />
        <div className="inline-actions">
          <button className="button button-secondary" type="button" onClick={importFields} disabled={!pastedText.trim()}>Fill in the boxes</button>
          {importMessage && <span className="status-message" role="status">{importMessage}</span>}
        </div>
      </details>
    </section>
  );
}
