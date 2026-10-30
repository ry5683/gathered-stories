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

    // The wedding has to be the signed-in owner's (row-level security hides anyone else's).
    const { data: wedding, error: weddingError } = await supabase.from("weddings").select("id").eq("id", id).maybeSingle();
    if (weddingError || !wedding) return NextResponse.json({ error: "Wedding not found." }, { status: 404 });

    const keep = list.map((item) => item.vendorId);
    let removeQuery = supabase.from("wedding_vendors").delete().eq("wedding_id", id);
    if (keep.length > 0) removeQuery = removeQuery.not("vendor_id", "in", `(${keep.join(",")})`);
    // Clear collaborator flags first, so swapping one collaborator for another never trips the limit of 5.
    const [{ error: removeError }, { error: clearError }] = await Promise.all([
      removeQuery,
      supabase.from("wedding_vendors").update({ is_collaborator: false }).eq("wedding_id", id),
    ]);
    if (removeError || clearError) throw new Error(removeError?.code ?? clearError?.code ?? "database_error");

    if (list.length > 0) {
      // Upsert leaves shared_at alone, so a vendor already sent their message stays marked as sent.
      const { error: upsertError } = await supabase.from("wedding_vendors").upsert(
        list.map((item, index) => ({
          wedding_id: id,
          vendor_id: item.vendorId,
          user_id: user.id,
          sort_order: index,
          is_collaborator: item.isCollaborator,
        })),
        { onConflict: "wedding_id,vendor_id" },
      );
      if (upsertError) {
        console.error("Wedding vendor save failed:", upsertError.code ?? "database_error");
        return NextResponse.json({ error: "The vendor list could not be saved. Check that each vendor is still in your library." }, { status: 400 });
      }
    }
    return NextResponse.json({ vendors: await loadWeddingVendors(supabase, id) });
  } catch (error) {
    console.error("Wedding vendor save failed:", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ error: "The vendor list could not be saved." }, { status: 500 });
  }
}
