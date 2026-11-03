// WHAT: Reads and saves the photographer's own name and Instagram handle for vendor credit lines.
// WHY: Stored once on user_preferences, so every vendor message uses the same credit.
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeHandle } from "@/lib/credits";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const schema = z.object({
  photographerName: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().max(120))
    .transform((value) => value || null),
  photographerInstagram: z.preprocess((value) => (typeof value === "string" ? normalizeHandle(value) : value), z.string().max(30))
    .transform((value) => value || null)
    .refine((value) => value === null || /^[A-Za-z0-9._]{1,30}$/.test(value), "Instagram handles use letters, numbers, dots and underscores."),
  // Only used if this is the first preference saved, so creating the row never changes the theme.
  currentTheme: z.enum(["light", "dark"]).default("light"),
});

// Request: authenticated GET. Response: { photographerName, photographerInstagram }.
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { data, error } = await supabase
      .from("user_preferences")
      .select("photographer_name,photographer_instagram")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("Profile read failed:", error.code ?? "database_error");
      return NextResponse.json({ error: "Your profile could not be loaded." }, { status: 500 });
    }
    return NextResponse.json({
      photographerName: data?.photographer_name ?? null,
      photographerInstagram: data?.photographer_instagram ?? null,
    });
  } catch (error) {
    console.error("Profile route failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Profile is not configured." }, { status: 503 });
  }
}

// Request: authenticated JSON { photographerName, photographerInstagram, currentTheme }. Response echoes the saved values.
export async function PUT(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your details." }, { status: 400 });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const values = {
      photographer_name: parsed.data.photographerName,
      photographer_instagram: parsed.data.photographerInstagram,
    };
    const { data: existing, error: readError } = await supabase
      .from("user_preferences").select("user_id").eq("user_id", user.id).maybeSingle();
    if (readError) throw new Error(readError.code ?? "database_error");
    const { error } = existing
      ? await supabase.from("user_preferences").update({ ...values, updated_at: new Date().toISOString() }).eq("user_id", user.id)
      : await supabase.from("user_preferences").insert({ user_id: user.id, theme: parsed.data.currentTheme, ...values });
    if (error) {
      console.error("Profile save failed:", error.code ?? "database_error");
      return NextResponse.json({ error: "Your profile could not be saved." }, { status: 500 });
    }
    return NextResponse.json({ photographerName: values.photographer_name, photographerInstagram: values.photographer_instagram });
  } catch (error) {
    console.error("Profile save failed:", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ error: "Profile is not configured." }, { status: 503 });
  }
}
