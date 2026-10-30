// WHAT: Persists edits to an existing draft for its authenticated owner.
// WHY: The review step stays editable across reloads while RLS and status checks prevent
// users from modifying another account's draft or changing an already approved draft.
import { NextResponse } from "next/server";
import { z } from "zod";
import { editableDraftContentSchema } from "@/lib/draft-validation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Request: a complete editable DraftContent object. Response: the saved draft.
// Authentication is checked before the RLS-scoped update; only status=draft rows match.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const validation = editableDraftContentSchema.safeParse(payload);
  if (!validation.success) return NextResponse.json({ error: "Draft fields are incomplete or invalid." }, { status: 400 });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to save changes." }, { status: 401 });

    const { data, error } = await supabase
      .from("drafts")
      .update({ content: validation.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "draft")
      .select("id,status,content")
      .single();
    if (error || !data) return NextResponse.json({ error: "Draft not found or no longer editable." }, { status: 404 });
    return NextResponse.json({ id: data.id, status: data.status, ...data.content });
  } catch (error) {
    console.error("Draft update failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "The draft could not be saved." }, { status: 503 });
  }
}
