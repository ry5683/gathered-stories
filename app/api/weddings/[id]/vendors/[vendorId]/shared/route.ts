// WHAT: Marks a vendor's share-kit message as sent (POST) or not sent (DELETE).
// WHY: The app never sends the message itself; this is the photographer's own checkbox.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { uuidSchema } from "@/lib/vendors-server";

async function setShared(context: { params: Promise<{ id: string; vendorId: string }> }, sharedAt: string | null) {
  const { id, vendorId } = await context.params;
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(vendorId).success) {
    return NextResponse.json({ error: "Vendor not found on this wedding." }, { status: 404 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to track sent messages." }, { status: 401 });

    const { data, error } = await supabase
      .from("wedding_vendors")
      .update({ shared_at: sharedAt })
      .eq("wedding_id", id)
      .eq("vendor_id", vendorId)
      .select("shared_at")
      .maybeSingle();
    if (error) {
      console.error("Share tracking failed:", error.code ?? "database_error");
      return NextResponse.json({ error: "That couldn't be saved." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Vendor not found on this wedding." }, { status: 404 });
    return NextResponse.json({ sharedAt: data.shared_at });
  } catch (error) {
    console.error("Share tracking failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Vendors are not configured yet." }, { status: 503 });
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string; vendorId: string }> }) {
  return setShared(context, new Date().toISOString());
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; vendorId: string }> }) {
  return setShared(context, null);
}
