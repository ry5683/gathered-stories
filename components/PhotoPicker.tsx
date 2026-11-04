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

  const filled = photos.filter((photo) => photo.description.trim()).length;

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Describe your favorite photos</h2>
        </div>
        <span className="count-badge" key={photos.length}>{filled} of {photos.length} done</span>
      </div>
      <p className="muted-copy">Pick at least 10 favorite photos from this wedding. For each one, write a few words about what&rsquo;s in it. Short is fine.</p>
      <div className="photo-fields">
        {photos.map((photo, index) => (
          <div className="photo-field" key={photo.id} style={cssVar("--i", index < 10 ? index : 0)}>
            <label className="field" htmlFor={`photo-${photo.id}`}>
              <span className="field-label">Photo {index + 1}</span>
              <textarea id={`photo-${photo.id}`} rows={2} placeholder={index === 0 ? "e.g. Bride laughing with her bridesmaids on the porch" : "What's in this photo?"} value={photo.description} onChange={(event) => updateDescription(photo.id, event.target.value)} />
            </label>
            {photos.length > 10 && <button className="icon-button" type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => removeDescription(photo.id)}>×</button>}
          </div>
        ))}
      </div>
      <button className="button button-secondary" type="button" onClick={addDescription} disabled={photos.length >= 20}>Add another photo</button>
    </section>
  );
}
