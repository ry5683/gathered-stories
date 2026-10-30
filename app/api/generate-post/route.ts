// WHAT: Authenticates, verifies ownership, limits AI inputs, and saves a validated draft.
// WHY: This is the only API route that calls Claude; it never receives photo files,
// questionnaire blobs, contacts, or other personal data.
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateWeddingDraft, InvalidClaudeResponseError } from "@/lib/claude";
import { resemblesApprovedWork } from "@/lib/similarity";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const requestSchema = z.object({
  weddingId: z.string().uuid(),
  favoriteMoment: z.string().trim().min(1).max(1000),
  voice: z.enum(["delicate", "active"]),
  optionalInspiration: z.string().trim().max(500).default(""),
  useVoiceExamples: z.boolean().default(true),
  draftId: z.string().uuid().optional(),
  photos: z.array(z.object({
    id: z.string().max(80),
    description: z.string().trim().min(1).max(400),
  })).min(10).max(20),
});

function approvedWorkStyleProfile(body: string): string {
  const words = body.match(/\b[\w'-]+\b/g) ?? [];
  const sentences = body.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
  const averageSentenceLength = sentences.length ? Math.round(words.length / sentences.length) : 0;
  const firstPersonUses = (body.match(/\b(?:I|we|our|my)\b/gi) ?? []).length;
  const contractions = (body.match(/\b[\w]+['’][\w]+\b/g) ?? []).length;
  return `Prior approved style profile: about ${averageSentenceLength} words per sentence, ${firstPersonUses ? "uses first-person perspective" : "uses little first-person perspective"}, ${contractions ? "uses contractions" : "uses few contractions"}. Do not reuse prior wording or facts.`;
}

// Request: { weddingId, photos[10..20], favoriteMoment, voice, draftId? }.
// Response: validated draft fields plus id/status; auth, ownership, model, and save
// failures return a JSON error with a non-success status. The server-only key is read
// in lib/claude.ts after auth and wedding ownership have been checked.
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const validation = requestSchema.safeParse(payload);
  if (!validation.success) {
    return NextResponse.json({ error: "Add a favorite moment and descriptions for 10–20 photos." }, { status: 400 });
  }
  const containsContactDetails = (value: string) => {
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) return true;
    return [...value.matchAll(/(?:\+?\d[\d\s().-]{7,}\d)/g)]
      .some((match) => (match[0].match(/\d/g)?.length ?? 0) >= 10);
  };
  if (
    [validation.data.favoriteMoment, validation.data.optionalInspiration, ...validation.data.photos.map((photo) => photo.description)]
      .some(containsContactDetails)
  ) {
    return NextResponse.json({ error: "Remove email addresses and phone numbers from the moment, inspiration, and photo descriptions." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before writing a draft." }, { status: 401 });

    const { data: wedding, error: weddingError } = await supabase
      .from("weddings")
      .select("id,venue,city,wedding_date,palette,edit_style,music_loved,music_rejected")
      .eq("id", validation.data.weddingId)
      .single();
    if (weddingError || !wedding) return NextResponse.json({ error: "Wedding not found for this account." }, { status: 404 });

    const promptFields = [
      wedding.venue, wedding.city, wedding.wedding_date, wedding.palette, wedding.edit_style,
      wedding.music_loved, wedding.music_rejected,
    ];
    if (promptFields.some(containsContactDetails)) {
      return NextResponse.json({ error: "Remove email addresses and phone numbers from the wedding details before writing." }, { status: 400 });
    }

    const { data: priorApproved, error: priorError } = await supabase
      .from("drafts")
      .select("content")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .neq("wedding_id", wedding.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (priorError) {
      console.error("Approved draft lookup failed:", priorError.code ?? "database_error");
      return NextResponse.json({ error: "Previous approved work could not be checked. Please try again." }, { status: 500 });
    }

    const cleanWedding = {
      venue: wedding.venue,
      city: wedding.city,
      weddingDate: wedding.wedding_date,
      palette: wedding.palette,
      editStyle: wedding.edit_style,
      musicLoved: wedding.music_loved,
      musicRejected: wedding.music_rejected,
    };
    const content = await generateWeddingDraft({
      wedding: cleanWedding,
      photos: validation.data.photos,
      favoriteMoment: validation.data.favoriteMoment,
      voice: validation.data.voice,
      optionalInspiration: validation.data.optionalInspiration,
      voiceExamples: validation.data.useVoiceExamples
        ? (priorApproved ?? []).slice(0, 2).flatMap(({ content }) => {
            if (!content || typeof content !== "object" || !("body" in content) || typeof content.body !== "string") return [];
            return [approvedWorkStyleProfile(content.body)];
          })
        : [],
    });

    const draftSave = validation.data.draftId
      ? await supabase
          .from("drafts")
          .update({ content })
          .eq("id", validation.data.draftId)
          .eq("wedding_id", wedding.id)
          .eq("status", "draft")
          .select("id,status,content")
          .single()
      : await supabase
          .from("drafts")
          .insert({ wedding_id: wedding.id, user_id: user.id, status: "draft", content })
          .select("id,status,content")
          .single();
    const { data: savedDraft, error: saveError } = draftSave;
    if (saveError || !savedDraft) {
      console.error("Draft save failed:", saveError?.code ?? "not_found_or_database_error");
      return NextResponse.json({ error: "The draft was generated but could not be saved." }, { status: 500 });
    }
    const previousBodies = (priorApproved ?? []).flatMap(({ content }) =>
      content && typeof content === "object" && "body" in content && typeof content.body === "string" ? [content.body] : [],
    );
    return NextResponse.json({
      id: savedDraft.id,
      status: savedDraft.status,
      ...savedDraft.content,
      similarityWarning: resemblesApprovedWork(content.body, previousBodies),
    });
  } catch (error) {
    if (error instanceof InvalidClaudeResponseError) {
      console.error("Claude returned invalid draft JSON.");
      return NextResponse.json({ error: "The draft service returned an invalid format. Please try again." }, { status: 502 });
    }
    console.error("Draft generation failed:", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "Draft generation failed. Check the server configuration and try again." }, { status: 502 });
  }
}
