// WHAT: Saves only the safe, structured wedding fields for the authenticated owner.
// WHY: The browser's paste/import box is never persisted as raw questionnaire text;
// this allowlisted payload keeps contact and family details out of the database.
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeDraftContent } from "@/lib/draft-normalization";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const weddingSchema = z.object({
  id: z.string().uuid().optional(),
  venue: z.string().trim().max(160),
  city: z.string().trim().max(120),
  weddingDate: z.string().max(40),
  ceremonyTime: z.string().max(40),
  receptionTime: z.string().max(40),
  dressCode: z.string().max(200),
  palette: z.string().max(200),
  editStyle: z.string().max(200),
  musicLoved: z.string().max(500),
  musicRejected: z.string().max(500),
  photos: z.array(z.object({
    id: z.string().min(1).max(80),
    description: z.string().max(400),
  })).max(20).default([]),
  favoriteMoment: z.string().max(1000).default(""),
  optionalInspiration: z.string().max(500).default(""),
  currentStep: z.number().int().min(0).max(3).default(0),
  voice: z.enum(["delicate", "active"]).default("delicate"),
  useVoiceExamples: z.boolean().default(true),
});

// Request: authenticated GET. Response: owner-scoped weddings with resumable state and latest draft.
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to load saved weddings." }, { status: 401 });

    const { data: weddingRows, error: weddingError } = await supabase
      .from("weddings")
      .select("id,venue,city,wedding_date,ceremony_time,reception_time,dress_code,palette,edit_style,music_loved,music_rejected,photos,favorite_moment,optional_inspiration,current_step,voice,use_voice_examples,updated_at")
      .order("updated_at", { ascending: false });
    if (weddingError) {
      console.error("Wedding list failed:", weddingError.code ?? "database_error");
      return NextResponse.json({ error: "Saved weddings could not be loaded." }, { status: 500 });
    }

    const { data: draftRows, error: draftError } = await supabase
      .from("drafts")
      .select("id,wedding_id,status,content,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (draftError) {
      console.error("Draft list failed:", draftError.code ?? "database_error");
      return NextResponse.json({ error: "Saved drafts could not be loaded." }, { status: 500 });
    }

    let postRows: Array<{ id: string; wedding_id: string; draft_id: string; draft_url: string; sent_at: string; published_at: string | null }> = [];
    let inquiryRows: Array<{ id: string; wordpress_post_id: string; created_at: string }> = [];
    const encryptionKeyIsValid = Buffer.from(process.env.WORDPRESS_ENCRYPTION_KEY ?? "", "base64").length === 32;
    const integrationsEnabled = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && encryptionKeyIsValid);
    if (integrationsEnabled) {
      const admin = createSupabaseAdminClient();
      const [postsResult, inquiriesResult] = await Promise.all([
        admin.from("wordpress_posts").select("id,wedding_id,draft_id,draft_url,sent_at,published_at").eq("user_id", user.id),
        admin.from("post_inquiries").select("id,wordpress_post_id,created_at").eq("user_id", user.id),
      ]);
      if (postsResult.error || inquiriesResult.error) {
        console.error("Integration summary failed:", postsResult.error?.code ?? inquiriesResult.error?.code ?? "database_error");
        return NextResponse.json({ error: "WordPress delivery status could not be loaded." }, { status: 500 });
      }
      postRows = postsResult.data ?? [];
      inquiryRows = inquiriesResult.data ?? [];
    }

    const weddings = (weddingRows ?? []).map((row) => {
      const photos = Array.isArray(row.photos) ? row.photos.filter((photo): photo is { id: string; description: string } =>
        Boolean(photo && typeof photo === "object" && "id" in photo && typeof photo.id === "string" && "description" in photo && typeof photo.description === "string"),
      ) : [];
      const latest = (draftRows ?? []).find((draft) => draft.wedding_id === row.id);
      const post = latest ? postRows.find((candidate) => candidate.draft_id === latest.id) : undefined;
      const matchingPosts = postRows.filter((candidate) => candidate.wedding_id === row.id);
      const latestPost = matchingPosts.sort((a, b) => Date.parse(b.sent_at) - Date.parse(a.sent_at))[0] ?? post;
      const status: "Draft" | "Approved" | "Sent" = latestPost
        ? "Sent"
        : latest?.status === "approved" ? "Approved" : "Draft";
      const data = latest ? normalizeDraftContent(latest.content, photos) : null;
      return {
        wedding: {
          id: row.id,
          venue: row.venue,
          city: row.city,
          weddingDate: row.wedding_date,
          ceremonyTime: row.ceremony_time,
          receptionTime: row.reception_time,
          dressCode: row.dress_code,
          palette: row.palette,
          editStyle: row.edit_style,
          musicLoved: row.music_loved,
          musicRejected: row.music_rejected,
          photos,
          favoriteMoment: row.favorite_moment,
          optionalInspiration: row.optional_inspiration,
          currentStep: row.current_step,
          voice: row.voice,
          useVoiceExamples: row.use_voice_examples,
        },
        draft: latest && data ? { id: latest.id, status: latest.status, ...data } : null,
        status,
        wordpressPostRecordId: latestPost?.id ?? null,
        wordpressDraftUrl: latestPost?.draft_url ?? null,
        isPublished: Boolean(latestPost?.published_at),
        inquiryCount: postRows
          .filter((candidate) => candidate.wedding_id === row.id)
          .reduce((count, candidate) => count + inquiryRows.filter((inquiry) => inquiry.wordpress_post_id === candidate.id).length, 0),
      };
    });
    const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyInquiries = inquiryRows.filter((inquiry) => Date.parse(inquiry.created_at) >= weekStart).length;
    return NextResponse.json({ weddings, integrationsEnabled, weeklyInquiries });
  } catch (error) {
    console.error("Wedding list route failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Saved weddings are not configured yet." }, { status: 503 });
  }
}

// Request: allowlisted wedding fields and an optional owned wedding ID.
// Response: { id } after a RLS-scoped upsert; malformed input, missing auth,
// database errors, and missing Supabase configuration return explicit JSON errors.
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const validation = weddingSchema.safeParse(payload);
  if (!validation.success) {
    return NextResponse.json({ error: "Please complete the required wedding fields." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to save this wedding." }, { status: 401 });

    const {
      id,
      weddingDate,
      ceremonyTime,
      receptionTime,
      dressCode,
      musicLoved,
      musicRejected,
      favoriteMoment,
      optionalInspiration,
      currentStep,
      useVoiceExamples,
      ...fields
    } = validation.data;
    const { data, error } = await supabase
      .from("weddings")
      .upsert({
        ...(id ? { id } : {}),
        user_id: user.id,
        ...fields,
        wedding_date: weddingDate,
        ceremony_time: ceremonyTime,
        reception_time: receptionTime,
        dress_code: dressCode,
        music_loved: musicLoved,
        music_rejected: musicRejected,
        favorite_moment: favoriteMoment,
        optional_inspiration: optionalInspiration,
        current_step: currentStep,
        use_voice_examples: useVoiceExamples,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      console.error("Wedding save failed:", error.code ?? "database_error");
      return NextResponse.json({ error: "The wedding could not be saved. Check your Supabase setup and try again." }, { status: 500 });
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("Wedding route failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Wedding saving is not configured yet." }, { status: 503 });
  }
}
