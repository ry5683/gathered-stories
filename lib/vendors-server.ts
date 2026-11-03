// WHAT: Shared server-side helpers for the vendor routes: input rules and row mapping.
// WHY: One definition of what a valid vendor is keeps every route consistent with the database checks.
import "server-only";

import { z } from "zod";
import { isHttpsUrl, normalizeHandle, VENDOR_ROLES, type Vendor, type VendorRole, type WeddingVendor } from "@/lib/credits";
import type { createSupabaseServerClient } from "@/lib/supabase-server";

export type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const optionalText = (max: number) =>
  z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().max(max).optional().nullable())
    .transform((value) => (value ? value : null));

// What a vendor form may send. Handles lose a leading @; websites must be https.
export const vendorInputSchema = z.object({
  businessName: z.string().trim().min(1, "Enter the business name.").max(120, "Use 120 characters or fewer."),
  role: z.enum(VENDOR_ROLES, "Choose a role from the list."),
  roleLabel: optionalText(40),
  website: optionalText(300).refine((value) => value === null || isHttpsUrl(value), "Website must start with https://"),
  instagramHandle: z
    .preprocess((value) => (typeof value === "string" ? normalizeHandle(value) : value), z.string().max(30).optional().nullable())
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^[A-Za-z0-9._]{1,30}$/.test(value), "Instagram handles use letters, numbers, dots and underscores."),
});

export type VendorInput = z.infer<typeof vendorInputSchema>;

export const VENDOR_COLUMNS = "id,business_name,role,role_label,website,instagram_handle";

export type VendorRow = {
  id: string;
  business_name: string;
  role: string;
  role_label: string | null;
  website: string | null;
  instagram_handle: string | null;
};

export function toVendor(row: VendorRow): Vendor {
  return {
    id: row.id,
    businessName: row.business_name,
    role: (VENDOR_ROLES as readonly string[]).includes(row.role) ? (row.role as VendorRole) : "other",
    roleLabel: row.role_label,
    website: row.website,
    instagramHandle: row.instagram_handle,
  };
}

export function toVendorRow(input: VendorInput) {
  return {
    business_name: input.businessName,
    role: input.role,
    role_label: input.roleLabel,
    website: input.website,
    instagram_handle: input.instagramHandle,
  };
}

// A wedding's vendors in saved order. Row-level security limits this to the signed-in owner.
export async function loadWeddingVendors(supabase: ServerClient, weddingId: string): Promise<WeddingVendor[]> {
  const { data, error } = await supabase
    .from("wedding_vendors")
    .select(`sort_order,is_collaborator,shared_at,vendors(${VENDOR_COLUMNS})`)
    .eq("wedding_id", weddingId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.code ?? "database_error");
  return (data ?? []).flatMap((row) => {
    const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
    if (!vendor) return [];
    return [{
      vendor: toVendor(vendor as VendorRow),
      sortOrder: row.sort_order,
      isCollaborator: row.is_collaborator,
      sharedAt: row.shared_at,
    }];
  });
}

export const uuidSchema = z.string().uuid();

// Postgres "unique violation": the same business in the same role is already saved.
export function isDuplicate(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}
