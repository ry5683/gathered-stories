// WHAT: Changes a saved draft's status to approved for its authenticated owner.
// WHY: Approval is a private workflow marker only; this handler has no publishing integration.
import { NextResponse } from "next/server";
import { z } from "zod";
import { approvableDraftContentSchema } from "@/lib/draft-validation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Request: POST with the draft ID in the route. Response: { id, status: "approved" }.
// The auth check and RLS-scoped status update are the entire approval action; no content is published.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to approve this draft." }, { status: 401 });

    const { data: draft, error: draftError } = await supabase
      .from("drafts")
      .select("id,status,content")
      .eq("id", id)
      .eq("status", "draft")
      .single();
    if (draftError || !draft) return NextResponse.json({ error: "Draft not found or already approved." }, { status: 404 });
    if (!approvableDraftContentSchema.safeParse(draft.content).success) {
      return NextResponse.json({ error: "Complete all required fields, use 5–7 hashtags, and keep filenames and alt text unique before approving." }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("drafts")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "draft")
      .select("id,status")
      .single();
    if (error || !data) return NextResponse.json({ error: "Draft not found or already approved." }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Draft approval failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "The draft could not be approved." }, { status: 503 });
  }
}
