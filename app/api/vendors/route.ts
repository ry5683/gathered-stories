// WHAT: Lists the signed-in photographer's saved vendors (with how many weddings use each) and adds new ones.
// WHY: Vendors are entered once and reused; row-level security keeps each photographer's list private.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isDuplicate, toVendor, VENDOR_COLUMNS, vendorInputSchema, toVendorRow, type VendorRow } from "@/lib/vendors-server";

// Request: authenticated GET. Response: { vendors: [{ ...vendor, weddingCount }] } sorted by name.
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to see your vendors." }, { status: 401 });

    const [vendorResult, linkResult] = await Promise.all([
      supabase.from("vendors").select(VENDOR_COLUMNS).order("business_name", { ascending: true }),
      supabase.from("wedding_vendors").select("vendor_id"),
    ]);
    if (vendorResult.error || linkResult.error) {
      console.error("Vendor list failed:", vendorResult.error?.code ?? linkResult.error?.code ?? "database_error");
      return NextResponse.json({ error: "Your vendors could not be loaded." }, { status: 500 });
    }
    const counts = new Map<string, number>();
    for (const link of linkResult.data ?? []) counts.set(link.vendor_id, (counts.get(link.vendor_id) ?? 0) + 1);
    const vendors = (vendorResult.data as VendorRow[]).map((row) => ({ ...toVendor(row), weddingCount: counts.get(row.id) ?? 0 }));
    return NextResponse.json({ vendors });
  } catch (error) {
    console.error("Vendor route failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Vendors are not configured yet." }, { status: 503 });
  }
}

// Request: authenticated JSON vendor fields. Response: the saved vendor, or 409 if it's already saved.
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = vendorInputSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the vendor details." }, { status: 400 });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to save vendors." }, { status: 401 });

    const { data, error } = await supabase
      .from("vendors")
      .insert({ user_id: user.id, ...toVendorRow(parsed.data) })
      .select(VENDOR_COLUMNS)
      .single();
    if (isDuplicate(error)) return NextResponse.json({ error: "That vendor is already saved in this role." }, { status: 409 });
    if (error || !data) {
      console.error("Vendor save failed:", error?.code ?? "database_error");
      return NextResponse.json({ error: "The vendor could not be saved." }, { status: 500 });
    }
    return NextResponse.json({ vendor: { ...toVendor(data as VendorRow), weddingCount: 0 } }, { status: 201 });
  } catch (error) {
    console.error("Vendor save failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Vendors are not configured yet." }, { status: 503 });
  }
}
