// WHAT: The photographer's saved vendors: edit details once, delete ones no longer used.
// WHY: Credits are rebuilt from this list every time, so fixing a handle here fixes every wedding.
"use client";

import { useState } from "react";
import { ROLE_LABELS } from "@/lib/credits";
import type { LibraryVendor } from "@/lib/types";
import { draftFromVendor, VendorFields, type VendorDraft } from "@/components/VendorFields";

type Props = {
  vendors: LibraryVendor[];
  onSave: (id: string, draft: VendorDraft) => Promise<void>;
  onDelete: (id: string, confirmed: boolean) => Promise<{ needsConfirm: number } | null>;
  onClose: () => void;
  profile: { photographerName: string; photographerInstagram: string };
  onSaveProfile: (profile: { photographerName: string; photographerInstagram: string }) => Promise<void>;
};

export function VendorLibrary({ vendors, onSave, onDelete, onClose, profile, onSaveProfile }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VendorDraft | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; count: number } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [profileDraft, setProfileDraft] = useState(profile);

  function startEdit(vendor: LibraryVendor) {
    setEditingId(vendor.id);
    setDraft(draftFromVendor(vendor));
    setConfirming(null);
    setMessage("");
  }

  async function save() {
    if (!editingId || !draft) return;
    setBusy(true);
    try {
      await onSave(editingId, draft);
      setMessage("Saved. Credits on every wedding now use the new details.");
      setEditingId(null);
      setDraft(null);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The vendor could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, confirmed: boolean) {
    setBusy(true);
    try {
      const result = await onDelete(id, confirmed);
      if (result) {
        setConfirming({ id, count: result.needsConfirm });
      } else {
        setConfirming(null);
        setMessage("Vendor deleted.");
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The vendor could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    try {
      await onSaveProfile(profileDraft);
      setMessage("Your credit details are saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Your details could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel vendor-library" aria-labelledby="vendor-library-title">
      <div className="panel-heading">
        <div>
          <h2 id="vendor-library-title">Saved vendors</h2>
        </div>
        <button className="button button-secondary" type="button" onClick={onClose}>Done</button>
      </div>

      <div className="vendor-profile">
        <p className="field-label">Your credit line</p>
        <p className="muted-copy">Used in the messages you send vendors: &ldquo;Photos by [your name] @[your handle]&rdquo;.</p>
        <div className="field-grid">
          <label className="field" htmlFor="profile-name">
            <span className="field-label">Your name or studio</span>
            <input id="profile-name" maxLength={120} value={profileDraft.photographerName} onChange={(event) => setProfileDraft({ ...profileDraft, photographerName: event.target.value })} />
          </label>
          <label className="field" htmlFor="profile-handle">
            <span className="field-label">Your Instagram handle</span>
            <input id="profile-handle" maxLength={31} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={profileDraft.photographerInstagram} onChange={(event) => setProfileDraft({ ...profileDraft, photographerInstagram: event.target.value })} />
          </label>
        </div>
        <div className="inline-actions vendor-new-actions">
          <button className="button button-secondary" type="button" onClick={saveProfile} disabled={busy}>Save credit line</button>
        </div>
      </div>

      {vendors.length === 0 ? (
        <p className="muted-copy">No saved vendors yet. Add them from a wedding&apos;s Vendor credits card.</p>
      ) : (
        <ul className="vendor-list">
          {vendors.map((vendor) => (
            <li className="vendor-row vendor-library-row" key={vendor.id}>
              {editingId === vendor.id && draft ? (
                <div className="vendor-edit">
                  <VendorFields value={draft} onChange={setDraft} idPrefix={`edit-${vendor.id}`} />
                  <div className="inline-actions vendor-new-actions">
                    <button className="button button-primary" type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                    <button className="button button-secondary" type="button" onClick={() => { setEditingId(null); setDraft(null); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="vendor-row-copy">
                    <span className="vendor-role">{vendor.roleLabel || ROLE_LABELS[vendor.role]}</span>
                    <span className="vendor-name">{vendor.businessName}</span>
                    <span className="muted-copy">
                      {[vendor.instagramHandle ? `@${vendor.instagramHandle}` : "No handle", vendor.website ? "website" : "", `${vendor.weddingCount} ${vendor.weddingCount === 1 ? "wedding" : "weddings"}`].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="vendor-row-actions">
                    <button className="button button-secondary copy-button" type="button" onClick={() => startEdit(vendor)}>Edit</button>
                    {confirming?.id === vendor.id ? (
                      <>
                        <span className="muted-copy">Remove from {confirming.count} {confirming.count === 1 ? "wedding" : "weddings"}?</span>
                        <button className="button button-secondary copy-button" type="button" onClick={() => remove(vendor.id, true)} disabled={busy}>Delete anyway</button>
                        <button className="button button-secondary copy-button" type="button" onClick={() => setConfirming(null)}>Keep</button>
                      </>
                    ) : (
                      <button className="button button-secondary copy-button" type="button" onClick={() => remove(vendor.id, false)} disabled={busy}>Delete</button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {message && <p className="status-message" role="status">{message}</p>}
    </section>
  );
}
