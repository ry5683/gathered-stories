// WHAT: Reads and saves which vendors worked one wedding, in credit order, and who is a collaborator.
// WHY: The picker saves the whole set at once; sent-message dates are kept for vendors that stay on.
import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_COLLABORATORS } from "@/lib/credits";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadWeddingVendors, uuidSchema } from "@/lib/vendors-server";

const setSchema = z.object({
  vendors: z.array(z.object({ vendorId: z.string().uuid(), isCollaborator: z.boolean() })).max(60),
});

// Request: authenticated GET. Response: { vendors: WeddingVendor[] } in saved order.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Wedding not found." }, { status: 404 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to see this wedding's vendors." }, { status: 401 });
    return NextResponse.json({ vendors: await loadWeddingVendors(supabase, id) });
  } catch (error) {
    console.error("Wedding vendor list failed:", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ error: "This wedding's vendors could not be loaded." }, { status: 500 });
  }
}

// Request: authenticated JSON { vendors: [{ vendorId, isCollaborator }] } in credit order.
// Response: the saved set. Vendors left out are unlinked; at most 5 collaborators.
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Wedding not found." }, { status: 404 });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = setSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Check the vendor list." }, { status: 400 });
  const list = parsed.data.vendors;
  if (new Set(list.map((item) => item.vendorId)).size !== list.length) {
    return NextResponse.json({ error: "A vendor is listed twice." }, { status: 400 });
  }
  if (list.filter((item) => item.isCollaborator).length > MAX_COLLABORATORS) {
    return NextResponse.json({ error: `Instagram allows ${MAX_COLLABORATORS} collaborators per post.` }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to save vendors." }, { status: 401 });

    // One database transaction (migration 20261103): removals, collaborator flags and the new order
    // either all save or none do. It runs as the signed-in user, so row-level security still applies:
    // another person's wedding is "not found", and another person's vendor is refused.
    const { error: saveError } = await supabase.rpc("replace_wedding_vendors", {
      p_wedding_id: id,
      p_vendors: list,
    });
    if (saveError) {
      console.error("Wedding vendor save failed:", saveError.code ?? "database_error");
      if (saveError.code === "P0002") return NextResponse.json({ error: "Wedding not found." }, { status: 404 });
      if (saveError.code === "42883" || saveError.code === "PGRST202") {
        return NextResponse.json({ error: "The vendor update hasn't been applied to the database yet. Run migration 20261103_vendor_save_fixes.sql." }, { status: 500 });
      }
      return NextResponse.json({ error: "The vendor list could not be saved, and nothing was changed. Check that each vendor is still in your library." }, { status: 400 });
    }
    return NextResponse.json({ vendors: await loadWeddingVendors(supabase, id) });
  } catch (error) {
    console.error("Wedding vendor save failed:", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ error: "The vendor list could not be saved." }, { status: 500 });
  }
}
