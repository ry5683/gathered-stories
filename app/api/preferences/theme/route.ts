// WHAT: Reads and saves a user's authenticated light/dark theme preference.
// WHY: localStorage works before sign-in; this row carries the preference across browsers.
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Request: authenticated GET. Response: { theme } or a JSON error on auth/database failure.
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { data, error } = await supabase.from("user_preferences").select("theme").eq("user_id", user.id).maybeSingle();
    if (error) {
      console.error("Theme preference read failed:", error.code ?? "database_error");
      return NextResponse.json({ error: "Theme preference could not be loaded." }, { status: 500 });
    }
    return NextResponse.json({ theme: data?.theme ?? null });
  } catch (error) {
    console.error("Theme preference route failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Theme preference is not configured." }, { status: 503 });
  }
}

// Request: authenticated JSON { theme: "light" | "dark" }. Response echoes the saved theme.
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = z.object({ theme: z.enum(["light", "dark"]) }).safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Theme must be light or dark." }, { status: 400 });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { error } = await supabase.from("user_preferences").upsert({ user_id: user.id, theme: parsed.data.theme });
    if (error) {
      console.error("Theme preference save failed:", error.code ?? "database_error");
      return NextResponse.json({ error: "Theme preference could not be saved." }, { status: 500 });
    }
    return NextResponse.json({ theme: parsed.data.theme });
  } catch (error) {
    console.error("Theme preference save failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Theme preference is not configured." }, { status: 503 });
  }
}
