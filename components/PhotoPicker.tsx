// WHAT: Collects 10–20 photo descriptions without uploading image files.
// WHY: V1 sends captions only to Claude, reducing unnecessary exposure of private images.
"use client";

import type { PhotoDescription } from "@/lib/types";
import { cssVar } from "@/lib/motion";

type Props = {
  photos: PhotoDescription[];
  onChange: (photos: PhotoDescription[]) => void;
};

export function PhotoPicker({ photos, onChange }: Props) {
  // WHAT: Updates a single photo description by stable UI ID.
  // WHY: IDs keep the right textarea attached to its value when descriptions are added or removed.
  function updateDescription(id: string, description: string) {
    onChange(photos.map((photo) => photo.id === id ? { ...photo, description } : photo));
  }

  // WHAT: Adds one blank description until the 20-photo limit.
  // WHY: The API requires between 10 and 20 descriptions and intentionally accepts no image files.
  function addDescription() {
    if (photos.length >= 20) return;
    onChange([...photos, { id: crypto.randomUUID(), description: "" }]);
  }

  // WHAT: Removes a description only while at least ten remain.
  // WHY: The minimum count is shared with server validation.
  function removeDescription(id: string) {
    if (photos.length <= 10) return;
    onChange(photos.filter((photo) => photo.id !== id));
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Photo notes</p>
          <h2>Choose 10–20 moments to describe</h2>
        </div>
        <span className="count-badge" key={photos.length}>{photos.length} / 20</span>
      </div>
      <p className="muted-copy">No image upload in v1. Add a short caption or description for each photo; these notes inform generated ShowIt photo captions. Leave names and contact details out.</p>
      <div className="photo-fields">
        {photos.map((photo, index) => (
          <div className="photo-field" key={photo.id} style={cssVar("--i", index < 10 ? index : 0)}>
            <label className="field" htmlFor={`photo-${photo.id}`}>
              <span className="field-label">Photo {index + 1}</span>
              <textarea id={`photo-${photo.id}`} rows={2} placeholder="What is visible in this frame?" value={photo.description} onChange={(event) => updateDescription(photo.id, event.target.value)} />
            </label>
            {photos.length > 10 && <button className="icon-button" type="button" aria-label={`Remove photo description ${index + 1}`} onClick={() => removeDescription(photo.id)}>×</button>}
          </div>
        ))}
      </div>
      <button className="button button-secondary" type="button" onClick={addDescription} disabled={photos.length >= 20}>Add another description</button>
    </section>
  );
}
