import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "WordPress post not found." }, { status: 404 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to record an inquiry." }, { status: 401 });
    const admin = createSupabaseAdminClient();
    const { data: post, error: postError } = await admin.from("wordpress_posts")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .not("published_at", "is", null)
      .single();
    if (postError || !post) return NextResponse.json({ error: "Mark this WordPress post live before recording inquiries." }, { status: 409 });
    const { error } = await admin.from("post_inquiries").insert({ user_id: user.id, wordpress_post_id: post.id });
    if (error) {
      console.error("Inquiry record failed:", error.code ?? "database_error");
      return NextResponse.json({ error: "The inquiry could not be recorded." }, { status: 500 });
    }
    return NextResponse.json({ recorded: true });
  } catch (error) {
    console.error("Inquiry route failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Inquiry tracking is not configured on the server." }, { status: 503 });
  }
}
