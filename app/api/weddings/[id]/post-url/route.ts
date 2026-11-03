// WHAT: Saves the public link to a wedding's published post (for example on ShowIt), used in vendor messages.
// WHY: The app doesn't publish anywhere, so the photographer pastes the live link once it's up.
import { NextResponse } from "next/server";
import { z } from "zod";
import { isHttpsUrl } from "@/lib/credits";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { uuidSchema } from "@/lib/vendors-server";

const schema = z.object({
  postUrl: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().max(500).nullable())
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || isHttpsUrl(value, 500), "The post link must start with https://"),
});

// Request: authenticated JSON { postUrl: string | null }. Response: the saved link.
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Wedding not found." }, { status: 404 });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the link." }, { status: 400 });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to save the link." }, { status: 401 });
    const { data, error } = await supabase
      .from("weddings")
      .update({ post_url: parsed.data.postUrl })
      .eq("id", id)
      .select("post_url")
      .maybeSingle();
    if (error) {
      console.error("Post link save failed:", error.code ?? "database_error");
      return NextResponse.json({ error: "The link could not be saved." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Wedding not found." }, { status: 404 });
    return NextResponse.json({ postUrl: data.post_url });
  } catch (error) {
    console.error("Post link save failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Saving is not configured yet." }, { status: 503 });
  }
}
