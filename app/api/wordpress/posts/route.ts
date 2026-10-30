import { NextResponse } from "next/server";
import { z } from "zod";
import { approvableDraftContentSchema } from "@/lib/draft-validation";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { decryptWordPressCredentials, wordpressRequest } from "@/lib/wordpress";

const sendSchema = z.object({ draftId: z.string().uuid() });

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const validation = sendSchema.safeParse(payload);
  if (!validation.success) return NextResponse.json({ error: "A valid approved draft is required." }, { status: 400 });

  let adminClient: ReturnType<typeof createSupabaseAdminClient> | undefined;
  let reservationHeld = false;
  let remoteAttempted = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before sending a draft." }, { status: 401 });
    const { data: draft, error: draftError } = await supabase.from("drafts")
      .select("id,wedding_id,status,content")
      .eq("id", validation.data.draftId)
      .eq("status", "approved")
      .single();
    if (draftError || !draft) return NextResponse.json({ error: "Only an approved draft can be sent." }, { status: 404 });
    const content = approvableDraftContentSchema.safeParse(draft.content);
    if (!content.success) return NextResponse.json({ error: "The approved draft is incomplete. Review it before sending." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    adminClient = admin;
    const { data: existingPost, error: existingError } = await admin.from("wordpress_posts")
      .select("id,draft_url")
      .eq("user_id", user.id)
      .eq("draft_id", draft.id)
      .maybeSingle();
    if (existingError) throw new Error("WordPress post status could not be checked.");
    if (existingPost) return NextResponse.json({ error: "This draft was already sent to WordPress." }, { status: 409 });
    const now = new Date();
    const { error: expiredLockError } = await admin.from("wordpress_delivery_locks")
      .delete()
      .eq("draft_id", draft.id)
      .lt("expires_at", now.toISOString());
    if (expiredLockError) throw new Error("WordPress delivery status could not be checked.");
    const { error: reservationError } = await admin.from("wordpress_delivery_locks").insert({
      user_id: user.id,
      draft_id: draft.id,
      expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    });
    if (reservationError) return NextResponse.json({ error: "This draft is already being sent to WordPress. Wait a few minutes before retrying." }, { status: 409 });
    reservationHeld = true;

    const { data: connection, error: connectionError } = await admin.from("wordpress_connections")
      .select("site_url,credentials_ciphertext")
      .eq("user_id", user.id)
      .single();
    if (connectionError || !connection) return NextResponse.json({ error: "Connect a WordPress site before sending a draft." }, { status: 409 });
    const credentials = decryptWordPressCredentials(connection.credentials_ciphertext);
    remoteAttempted = true;
    const response = await wordpressRequest(connection.site_url, credentials, "/wp-json/wp/v2/posts", "POST", {
      title: content.data.title,
      slug: content.data.slug,
      excerpt: content.data.metaDescription,
      content: content.data.body,
      status: "draft",
    });
    if (
      !response || typeof response !== "object" ||
      !("id" in response) || typeof response.id !== "number" || !Number.isSafeInteger(response.id) || response.id < 1 ||
      !("status" in response) || response.status !== "draft"
    ) {
      throw new Error("WordPress did not confirm draft-only status.");
    }
    const siteUrl = new URL(connection.site_url);
    const returnedUrl = new URL("wp-admin/post.php", `${siteUrl.toString().replace(/\/$/, "")}/`);
    returnedUrl.searchParams.set("post", String(response.id));
    returnedUrl.searchParams.set("action", "edit");
    const { data: storedPost, error: storeError } = await admin.from("wordpress_posts").insert({
      user_id: user.id,
      wedding_id: draft.wedding_id,
      draft_id: draft.id,
      wordpress_post_id: response.id,
      draft_url: returnedUrl.toString(),
    }).select("id").single();
    if (storeError || !storedPost) {
      console.error("WordPress delivery tracking failed:", storeError?.code ?? "database_error");
      return NextResponse.json({ error: "WordPress created a draft, but its delivery record failed. Do not retry; refresh the wedding list and contact support if it is missing." }, { status: 500 });
    }
    const { error: lockReleaseError } = await admin.from("wordpress_delivery_locks").delete().eq("draft_id", draft.id);
    if (lockReleaseError) console.error("WordPress delivery reservation cleanup failed:", lockReleaseError.code ?? "database_error");
    reservationHeld = false;
    return NextResponse.json({ id: storedPost.id, draftUrl: returnedUrl.toString(), status: "draft" });
  } catch (error) {
    console.error("WordPress draft delivery failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "The WordPress draft could not be sent. Check the site connection and try again." }, { status: 502 });
  } finally {
    if (reservationHeld && !remoteAttempted && adminClient) {
      const { error } = await adminClient.from("wordpress_delivery_locks").delete().eq("draft_id", validation.data.draftId);
      if (error) console.error("WordPress delivery reservation cleanup failed:", error.code ?? "database_error");
    }
  }
}
