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
    if (authError || !user) return NextResponse.json({ error: "Sign in to update this post status." }, { status: 401 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("wordpress_posts")
      .update({ published_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("published_at", null)
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: "Post not found or already marked live." }, { status: 404 });
    return NextResponse.json({ id: data.id, isPublished: true });
  } catch (error) {
    console.error("WordPress post status update failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "The post status could not be updated." }, { status: 503 });
  }
}
