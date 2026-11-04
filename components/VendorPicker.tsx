// WHAT: Picks the vendors who worked this wedding, in credit order, and who to tag as Instagram collaborators.
// WHY: Credits are built from these saved vendors by code, so names and handles are exact.
// Vendor names, handles, and links are never sent to the AI; only their roles are.
"use client";

import { useState } from "react";
import { MAX_COLLABORATORS, ROLE_LABELS, roleLabel, suggestCollaborators, type Vendor, type WeddingVendor } from "@/lib/credits";
import type { LibraryVendor } from "@/lib/types";
import { emptyVendorDraft, VendorFields, type VendorDraft } from "@/components/VendorFields";

type Props = {
  authenticated: boolean;
  library: LibraryVendor[];
  selected: WeddingVendor[];
  saveStatus: string;
  // The picker saves the whole set, so it stays locked until the wedding's saved vendors have loaded.
  loadState: "ready" | "loading" | "failed";
  onRetryLoad: () => void;
  onChange: (next: WeddingVendor[]) => void;
  // Appends to the parent's latest selection, so a slow save can't overwrite changes made meanwhile.
  onAddVendor: (vendor: Vendor) => void;
  onCreateVendorAndAdd: (draft: VendorDraft) => Promise<{ vendor: Vendor; added: boolean }>;
  onOpenLibrary: () => void;
  // Opened from "Edit vendors" on later steps; on the details step it starts folded unless filled.
  startOpen?: boolean;
};

export function VendorPicker({ authenticated, library, selected, saveStatus, loadState, onRetryLoad, onChange, onAddVendor, onCreateVendorAndAdd, onOpenLibrary, startOpen = false }: Props) {
  const [pickId, setPickId] = useState("");
  const [newVendor, setNewVendor] = useState<VendorDraft>(emptyVendorDraft());
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  if (!authenticated) {
    return (
      <section className="panel vendor-panel" aria-labelledby="vendor-picker-title">
        <h2 id="vendor-picker-title">Vendors <span className="optional-label">(optional)</span></h2>
        <p className="muted-copy">Sign in to save vendors.</p>
      </section>
    );
  }

  if (loadState !== "ready") {
    return (
      <section className="panel vendor-panel" aria-labelledby="vendor-picker-title">
        <h2 id="vendor-picker-title">Vendors <span className="optional-label">(optional)</span></h2>
        {loadState === "loading" ? (
          <p className="muted-copy" role="status">Loading this wedding&rsquo;s vendors…</p>
        ) : (
          <div className="inline-actions">
            <span className="status-message" role="alert">This wedding&rsquo;s vendors couldn&rsquo;t be loaded, so editing is paused to protect them.</span>
            <button className="button button-secondary" type="button" onClick={onRetryLoad}>Try again</button>
          </div>
        )}
      </section>
    );
  }

  const selectedIds = new Set(selected.map((item) => item.vendor.id));
  const available = library.filter((vendor) => !selectedIds.has(vendor.id));
  const collaboratorCount = selected.filter((item) => item.isCollaborator).length;

  function renumber(list: WeddingVendor[]): WeddingVendor[] {
    return list.map((item, index) => ({ ...item, sortOrder: index }));
  }

  function addPicked() {
    const vendor = library.find((candidate) => candidate.id === pickId);
    if (!vendor) return;
    onAddVendor(vendor);
    setPickId("");
    setMessage(`${vendor.businessName} added.`);
  }

  async function createAndAdd() {
    setMessage("");
    if (!newVendor.businessName.trim()) {
      setMessage("Enter the business name.");
      return;
    }
    setAdding(true);
    try {
      const { vendor, added } = await onCreateVendorAndAdd(newVendor);
      setNewVendor(emptyVendorDraft(newVendor.role));
      setMessage(added ? `${vendor.businessName} saved to your vendors and added.` : `${vendor.businessName} saved to your vendors.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The vendor could not be saved.");
    } finally {
      setAdding(false);
    }
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(renumber(next));
  }

  function remove(index: number) {
    onChange(renumber(selected.filter((_, position) => position !== index)));
  }

  function toggleCollaborator(index: number, checked: boolean) {
    if (checked && collaboratorCount >= MAX_COLLABORATORS) return;
    onChange(selected.map((item, position) => (position === index ? { ...item, isCollaborator: checked } : item)));
  }

  function applySuggestions() {
    const picks = new Set(suggestCollaborators(selected));
    onChange(selected.map((item) => ({ ...item, isCollaborator: picks.has(item.vendor.id) })));
    setMessage(picks.size ? `Picked ${picks.size} to tag. Change any you like.` : "Add Instagram handles to your vendors first.");
  }

  return (
    <section className="panel vendor-panel" aria-labelledby="vendor-picker-title">
      <div className="panel-heading">
        <div>
          <h2 id="vendor-picker-title">Vendors <span className="optional-label">(optional)</span></h2>
        </div>
      </div>
      <details className="import-details vendor-details" open={startOpen || selected.length > 0}>
      <summary>{selected.length ? `${selected.length} ${selected.length === 1 ? "vendor" : "vendors"} added` : "Add the venue, florist, planner and others who worked this wedding"}</summary>
      <p className="muted-copy">They&rsquo;re listed at the end of your post with links, and you can tag them on Instagram. Vendors often share posts they&rsquo;re credited in.</p>

      {selected.length > 0 && (
        <ol className="vendor-list" aria-label="Vendors in credit order">
          {selected.map((item, index) => (
            <li className="vendor-row" key={item.vendor.id}>
              <div className="vendor-row-copy">
                <span className="vendor-role">{roleLabel(item.vendor)}</span>
                <span className="vendor-name">{item.vendor.businessName}</span>
                <span className="muted-copy">{item.vendor.instagramHandle ? `@${item.vendor.instagramHandle}` : "No Instagram handle"}</span>
              </div>
              <label className="check-row vendor-collab">
                <input
                  type="checkbox"
                  checked={item.isCollaborator}
                  disabled={!item.isCollaborator && (!item.vendor.instagramHandle || collaboratorCount >= MAX_COLLABORATORS)}
                  onChange={(event) => toggleCollaborator(index, event.target.checked)}
                />
                <span>Tag on Instagram</span>
              </label>
              <div className="vendor-row-actions">
                <button className="icon-button" type="button" aria-label={`Move ${item.vendor.businessName} up`} onClick={() => move(index, -1)} disabled={index === 0}>↑</button>
                <button className="icon-button" type="button" aria-label={`Move ${item.vendor.businessName} down`} onClick={() => move(index, 1)} disabled={index === selected.length - 1}>↓</button>
                <button className="icon-button" type="button" aria-label={`Remove ${item.vendor.businessName}`} onClick={() => remove(index)}>×</button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {selected.length > 0 && (
        <div className="inline-actions vendor-collab-summary">
          <span className="muted-copy">{collaboratorCount} of {MAX_COLLABORATORS} tagged (Instagram allows 5).</span>
          <button className="button button-secondary copy-button" type="button" onClick={applySuggestions}>Pick for me</button>
        </div>
      )}

      <div className="vendor-add">
        <label className="field" htmlFor="vendor-pick">
          <span className="field-label">Add a vendor you&rsquo;ve used before</span>
          <select id="vendor-pick" value={pickId} onChange={(event) => setPickId(event.target.value)} disabled={available.length === 0}>
            <option value="">{available.length === 0 ? "None saved yet. Add a new one below." : "Choose a vendor…"}</option>
            {available.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>{vendor.businessName} · {vendor.roleLabel || ROLE_LABELS[vendor.role]}</option>
            ))}
          </select>
        </label>
        <button className="button button-secondary" type="button" onClick={addPicked} disabled={!pickId}>Add</button>
      </div>

      <details className="import-details">
        <summary>Add a new vendor</summary>
        <VendorFields value={newVendor} onChange={setNewVendor} idPrefix="new-vendor" />
        <div className="inline-actions vendor-new-actions">
          <button className="button button-primary" type="button" onClick={createAndAdd} disabled={adding} aria-busy={adding}>{adding ? "Saving…" : "Save and add"}</button>
          <button className="button button-secondary" type="button" onClick={onOpenLibrary}>See all my vendors</button>
        </div>
      </details>

      <div className="inline-actions">
        {message && <span className="status-message" role="status">{message}</span>}
        {saveStatus && <span className="microcopy">{saveStatus}</span>}
      </div>
      </details>
    </section>
  );
}
