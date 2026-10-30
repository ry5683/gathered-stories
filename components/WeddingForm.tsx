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

const SOURCES: Record<WeddingTextField, string> = {
  venue: "Aisle Planner",
  city: "Aisle Planner",
  weddingDate: "Aisle Planner",
  ceremonyTime: "HoneyBook timeline",
  receptionTime: "HoneyBook timeline",
  dressCode: "Aisle Planner",
  palette: "Aisle Planner",
  editStyle: "Aisle Planner",
  musicLoved: "HoneyBook music",
  musicRejected: "HoneyBook music",
};

const CORE_FIELDS: Array<{ key: "venue" | "city" | "weddingDate"; label: string }> = [
  { key: "venue", label: "Venue" },
  { key: "city", label: "City" },
  { key: "weddingDate", label: "Date" },
];

const DETAIL_FIELDS: Array<{ key: Exclude<WeddingTextField, "venue" | "city" | "weddingDate">; label: string; multiline?: boolean }> = [
  { key: "ceremonyTime", label: "Ceremony time" },
  { key: "receptionTime", label: "Reception time" },
  { key: "dressCode", label: "Dress code" },
  { key: "palette", label: "Color palette" },
  { key: "editStyle", label: "Edit style" },
  { key: "musicLoved", label: "Music they love", multiline: true },
  { key: "musicRejected", label: "Music to reject", multiline: true },
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
        setImportMessage("No recognized details found. Include labels such as Venue, City, Date, Palette, or Edit Style.");
        return;
      }
      onChange(next);
      setPastedText("");
      setImportMessage(`${updated} field${updated === 1 ? "" : "s"} imported. The pasted text was cleared.`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Could not read those details.");
    }
  }

  return (
    <section className="panel form-panel" aria-labelledby="wedding-details-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Wedding details</p>
          <h2 id="wedding-details-title">Choose a wedding</h2>
        </div>
      </div>
      <p className="muted-copy">Start with the venue, city, and date. Details already on file can stay as they are.</p>
      <div className="field-grid">
        {CORE_FIELDS.map(({ key, label }) => (
          <label className="field" key={key}>
            <span className="field-label">{label}</span>
            <span className="field-source">{SOURCES[key]}</span>
            <input value={wedding[key]} onChange={(event) => onChange({ ...wedding, [key]: event.target.value })} />
          </label>
        ))}
      </div>
      <details className="import-details">
        <summary>Details — already filled in, tap to edit</summary>
        <div className="field-grid detail-grid">
          {DETAIL_FIELDS.map(({ key, label, multiline }) => (
            <label className={`field ${multiline ? "field-wide" : ""}`} key={key}>
              <span className="field-label">{label}</span>
              <span className="field-source">{SOURCES[key]}</span>
              {multiline ? (
                <textarea rows={2} value={wedding[key]} onChange={(event) => onChange({ ...wedding, [key]: event.target.value })} />
              ) : (
                <input value={wedding[key]} onChange={(event) => onChange({ ...wedding, [key]: event.target.value })} />
              )}
            </label>
          ))}
        </div>
      </details>
      <details className="import-details paste-details">
        <summary>Paste HoneyBook details here</summary>
        <p className="muted-copy">Only recognized venue details are kept. Contact information and other questionnaire text are ignored; HoneyBook is not directly synced.</p>
        <textarea aria-label="Paste HoneyBook details" rows={4} placeholder={"Venue: Example Estate\nCity: Example City\nDate: 2026-09-20\nPalette: Sage and ivory\nEdit Style: Film-inspired"} value={pastedText} onChange={(event) => setPastedText(event.target.value)} />
        <div className="inline-actions">
          <button className="button button-secondary" type="button" onClick={importFields} disabled={!pastedText.trim()}>Import details</button>
          {importMessage && <span className="status-message" role="status">{importMessage}</span>}
        </div>
      </details>
    </section>
  );
}
