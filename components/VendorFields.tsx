// WHAT: The add/edit fields for one vendor, shared by the wedding's vendor picker and the vendor library.
// WHY: One form means the same rules everywhere: https websites only, handles without the @.
"use client";

import { ROLE_LABELS, VENDOR_ROLES, type Vendor, type VendorRole } from "@/lib/credits";

export type VendorDraft = {
  businessName: string;
  role: VendorRole;
  roleLabel: string;
  website: string;
  instagramHandle: string;
};

export const emptyVendorDraft = (role: VendorRole = "florist"): VendorDraft => ({
  businessName: "",
  role,
  roleLabel: "",
  website: "",
  instagramHandle: "",
});

export function draftFromVendor(vendor: Vendor): VendorDraft {
  return {
    businessName: vendor.businessName,
    role: vendor.role,
    roleLabel: vendor.roleLabel ?? "",
    website: vendor.website ?? "",
    instagramHandle: vendor.instagramHandle ?? "",
  };
}

export function VendorFields({ value, onChange, idPrefix }: { value: VendorDraft; onChange: (next: VendorDraft) => void; idPrefix: string }) {
  const set = <K extends keyof VendorDraft>(key: K, next: VendorDraft[K]) => onChange({ ...value, [key]: next });
  return (
    <div className="field-grid vendor-fields">
      <label className="field" htmlFor={`${idPrefix}-name`}>
        <span className="field-label">Business name</span>
        <input id={`${idPrefix}-name`} maxLength={120} value={value.businessName} onChange={(event) => set("businessName", event.target.value)} />
      </label>
      <label className="field" htmlFor={`${idPrefix}-role`}>
        <span className="field-label">Role</span>
        <select id={`${idPrefix}-role`} value={value.role} onChange={(event) => set("role", event.target.value as VendorRole)}>
          {VENDOR_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
        </select>
      </label>
      <label className="field" htmlFor={`${idPrefix}-handle`}>
        <span className="field-label">Instagram handle</span>
        <span className="field-source">Optional · used for tags in captions</span>
        <input id={`${idPrefix}-handle`} maxLength={31} placeholder="bloomandvine" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={value.instagramHandle} onChange={(event) => set("instagramHandle", event.target.value)} />
      </label>
      <label className="field" htmlFor={`${idPrefix}-website`}>
        <span className="field-label">Website</span>
        <span className="field-source">Optional · linked in the blog credits</span>
        <input id={`${idPrefix}-website`} type="url" maxLength={300} placeholder="https://" value={value.website} onChange={(event) => set("website", event.target.value)} />
      </label>
      <label className="field field-wide" htmlFor={`${idPrefix}-label`}>
        <span className="field-label">Credit wording</span>
        <span className="field-source">Optional · replaces &ldquo;{ROLE_LABELS[value.role]}&rdquo; in the credits, for example &ldquo;Florals and installs&rdquo;</span>
        <input id={`${idPrefix}-label`} maxLength={40} value={value.roleLabel} onChange={(event) => set("roleLabel", event.target.value)} />
      </label>
    </div>
  );
}
