// WHAT: Edits or deletes one saved vendor.
// WHY: Fixing a handle here fixes the credits on every wedding, because credits are rebuilt from this row.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isDuplicate, toVendor, toVendorRow, uuidSchema, VENDOR_COLUMNS, vendorInputSchema, type VendorRow } from "@/lib/vendors-server";

// Request: authenticated JSON vendor fields. Response: the updated vendor.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
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
    if (authError || !user) return NextResponse.json({ error: "Sign in to edit vendors." }, { status: 401 });

    const { data, error } = await supabase
      .from("vendors")
      .update({ ...toVendorRow(parsed.data), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(VENDOR_COLUMNS)
      .maybeSingle();
    if (isDuplicate(error)) return NextResponse.json({ error: "Another saved vendor already has that name and role." }, { status: 409 });
    if (error) {
      console.error("Vendor update failed:", error.code ?? "database_error");
      return NextResponse.json({ error: "The vendor could not be saved." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    return NextResponse.json({ vendor: toVendor(data as VendorRow) });
  } catch (error) {
    console.error("Vendor update failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Vendors are not configured yet." }, { status: 503 });
  }
}

// Request: authenticated DELETE. A vendor credited on weddings needs ?confirm=1, because deleting it
// removes it from those weddings' credits. Response: { deleted: true } or 409 { weddingCount }.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
  const confirmed = new URL(request.url).searchParams.get("confirm") === "1";

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to delete vendors." }, { status: 401 });

    const { count, error: countError } = await supabase
      .from("wedding_vendors")
      .select("vendor_id", { count: "exact", head: true })
      .eq("vendor_id", id);
    if (countError) {
      console.error("Vendor usage check failed:", countError.code ?? "database_error");
      return NextResponse.json({ error: "The vendor could not be deleted." }, { status: 500 });
    }
    if ((count ?? 0) > 0 && !confirmed) {
      return NextResponse.json({ error: "This vendor is credited on saved weddings.", weddingCount: count }, { status: 409 });
    }

    const { data, error } = await supabase.from("vendors").delete().eq("id", id).select("id");
    if (error) {
      console.error("Vendor delete failed:", error.code ?? "database_error");
      return NextResponse.json({ error: "The vendor could not be deleted." }, { status: 500 });
    }
    if (!data || data.length === 0) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Vendor delete failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Vendors are not configured yet." }, { status: 503 });
  }
}
