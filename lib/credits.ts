// WHAT: Builds vendor credits, collaborator picks, and share-kit messages from the saved vendor list.
// WHY: Credits are assembled by code, never written by the AI, so business names, handles, and links
// are exactly what the photographer saved. Nothing here sends anything; it only produces text.

export const VENDOR_ROLES = [
  "venue", "planner", "coordinator", "florist", "rentals", "stationery", "catering", "cake",
  "hair_makeup", "attire", "music", "officiant", "videographer", "second_photographer", "other",
] as const;

export type VendorRole = (typeof VENDOR_ROLES)[number];

export const ROLE_LABELS: Record<VendorRole, string> = {
  venue: "Venue",
  planner: "Planner",
  coordinator: "Coordinator",
  florist: "Florist",
  rentals: "Rentals",
  stationery: "Stationery",
  catering: "Catering",
  cake: "Cake and desserts",
  hair_makeup: "Hair and makeup",
  attire: "Attire",
  music: "Music",
  officiant: "Officiant",
  videographer: "Videographer",
  second_photographer: "Second photographer",
  other: "Other",
};

// How the prompt refers to a role ("the florist"). Only roles are ever sent to the AI, never names.
export const ROLE_PROSE: Record<VendorRole, string> = {
  venue: "venue",
  planner: "planner",
  coordinator: "coordinator",
  florist: "florist",
  rentals: "rentals team",
  stationery: "stationer",
  catering: "caterer",
  cake: "baker",
  hair_makeup: "hair and makeup artist",
  attire: "attire shop",
  music: "musicians",
  officiant: "officiant",
  videographer: "videographer",
  second_photographer: "second photographer",
  other: "vendor",
};

export type Vendor = {
  id: string;
  businessName: string;
  role: VendorRole;
  roleLabel: string | null;
  website: string | null;
  instagramHandle: string | null;
};

export type WeddingVendor = {
  vendor: Vendor;
  sortOrder: number;
  isCollaborator: boolean;
  sharedAt: string | null;
};

export const MAX_COLLABORATORS = 5;
export const CREDITS_HEADING = "Vendor credits";

// Instagram collaborator priority: the vendors whose audiences matter most for referrals come first.
const COLLABORATOR_PRIORITY: VendorRole[] = ["venue", "planner", "florist", "videographer", "hair_makeup"];

export function roleLabel(vendor: Vendor): string {
  return vendor.roleLabel?.trim() || ROLE_LABELS[vendor.role];
}

// Credits run in role order (venue first), then the photographer's own order within a role.
export function orderVendors(list: WeddingVendor[]): WeddingVendor[] {
  return [...list].sort(
    (a, b) =>
      VENDOR_ROLES.indexOf(a.vendor.role) - VENDOR_ROLES.indexOf(b.vendor.role) ||
      a.sortOrder - b.sortOrder ||
      a.vendor.businessName.localeCompare(b.vendor.businessName),
  );
}

// Business names go into Markdown, so characters Markdown treats specially are escaped.
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+!|<>~])/g, "\\$1");
}

export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "");
}

export function isValidHandle(handle: string): boolean {
  return /^[A-Za-z0-9._]{1,30}$/.test(handle);
}

export function isHttpsUrl(value: string, maxLength = 300): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && value.length <= maxLength;
  } catch {
    return false;
  }
}

// The block appended to the blog post: "## Vendor credits" and one line per vendor.
export function buildBlogCredits(list: WeddingVendor[]): string {
  if (list.length === 0) return "";
  const lines = orderVendors(list).map(({ vendor }) => {
    const name = escapeMarkdown(vendor.businessName.trim());
    const linked = vendor.website ? `[${name}](${vendor.website})` : name;
    return `- **${escapeMarkdown(roleLabel(vendor))}:** ${linked}`;
  });
  return `## ${CREDITS_HEADING}\n\n${lines.join("\n")}`;
}

// Caption credit lines: "Florist: @bloomandvine", or the business name when there's no handle.
export function buildCaptionCredits(list: WeddingVendor[]): string {
  return orderVendors(list)
    .map(({ vendor }) => `${roleLabel(vendor)}: ${vendor.instagramHandle ? `@${vendor.instagramHandle}` : vendor.businessName.trim()}`)
    .join("\n");
}

// The caption with credits between the caption and its hashtags.
export function captionWithCredits(caption: string, list: WeddingVendor[], hashtags = ""): string {
  const credits = buildCaptionCredits(list);
  return [caption.trim(), credits, hashtags.trim()].filter(Boolean).join("\n\n");
}

// Up to 5 vendor IDs to suggest as Instagram collaborators: only vendors with a handle,
// priority roles first, then the rest in credit order.
export function suggestCollaborators(list: WeddingVendor[]): string[] {
  const withHandles = orderVendors(list).filter(({ vendor }) => vendor.instagramHandle);
  const rank = (role: VendorRole) => {
    const index = COLLABORATOR_PRIORITY.indexOf(role);
    return index === -1 ? COLLABORATOR_PRIORITY.length : index;
  };
  return [...withHandles]
    .sort((a, b) => rank(a.vendor.role) - rank(b.vendor.role))
    .slice(0, MAX_COLLABORATORS)
    .map(({ vendor }) => vendor.id);
}

// The roles present at a wedding, for the prompt ("the florist"). Names, handles, and links are never included.
export function vendorRolesForPrompt(list: WeddingVendor[]): string[] {
  const roles = orderVendors(list).map(({ vendor }) => vendor.role).filter((role) => role !== "venue" && role !== "other");
  return [...new Set(roles)].map((role) => ROLE_PROSE[role]);
}

export type ShareMessage = { subject: string; body: string; creditLine: string };

// One vendor's "you're featured" message. No AI call: a fixed template filled with saved facts.
export function buildShareMessage(input: {
  vendor: Vendor;
  venue: string;
  weddingDate: string;
  postUrl: string | null;
  photographerName: string | null;
  photographerInstagram: string | null;
}): ShareMessage {
  const { vendor } = input;
  const photographer = input.photographerName?.trim() || "";
  const creditLine = [
    photographer ? `Photos by ${photographer}` : "Photos",
    input.photographerInstagram ? `@${input.photographerInstagram}` : "",
  ].filter(Boolean).join(" ");
  const weddingWords = [input.venue.trim(), "wedding", input.weddingDate.trim() ? `on ${input.weddingDate.trim()}` : ""]
    .filter(Boolean).join(" ");
  const subject = `You're featured: ${input.venue.trim()} wedding`;
  const body = [
    `Hi ${vendor.businessName.trim()},`,
    "",
    `The ${weddingWords} is on the blog, and you're credited as ${roleLabel(vendor).toLowerCase()}.`,
    input.postUrl ? input.postUrl : "(Add the post link before sending.)",
    "",
    "Feel free to share it. If you post any of the photos, here's the credit line:",
    creditLine,
    "",
    "Thank you for being part of the day!",
    ...(photographer ? [photographer] : []),
  ].join("\n");
  return { subject, body, creditLine };
}

// Opens the photographer's own mail app with the message filled in and no recipient.
export function mailtoLink(message: ShareMessage): string {
  return `mailto:?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
}

export function instagramProfileUrl(handle: string): string {
  return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
}
