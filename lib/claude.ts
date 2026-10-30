// WHAT: Builds a privacy-limited prompt, calls Claude on the server, and validates its JSON.
// WHY: Keeping the key and prompt server-side prevents browser exposure and limits AI inputs
// to the approved wedding facts, photo descriptions, and the photographer's own moment.
import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { DraftContent, PhotoDescription, Wedding } from "@/lib/types";

const draftSchema = z.object({
  title: z.string().min(1).max(180),
  slug: z.string().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  metaDescription: z.string().min(1).max(320),
  body: z.string().min(1).max(20000).refine((body) => /(^|\n)#{1,3}\s+\S+/.test(body)),
  altTexts: z.array(z.string().min(1).max(500)).min(10).max(20),
  reelsScript: z.string().min(1).max(6000),
  caption: z.string().min(1).max(2000),
  hashtags: z.string().min(1).max(500),
  photoFileNames: z.array(z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(10).max(20),
  photoCaptions: z.array(z.string().min(1).max(500)).min(10).max(20),
  extraCaptions: z.array(z.string().min(1).max(2000)).max(2),
  extraFormats: z.object({
    pinterest: z.string().max(2000).optional(),
    emailSneakPeek: z.string().max(2000).optional(),
  }),
}).strict();

export class InvalidClaudeResponseError extends Error {
  constructor() {
    super("Claude returned a response that did not match the required draft format.");
    this.name = "InvalidClaudeResponseError";
  }
}

export async function generateWeddingDraft(input: {
  wedding: Pick<Wedding, "venue" | "city" | "weddingDate" | "editStyle" | "palette" | "musicLoved" | "musicRejected">;
  photos: PhotoDescription[];
  favoriteMoment: string;
  voice: "delicate" | "active";
  optionalInspiration?: string;
  voiceExamples?: string[];
}): Promise<DraftContent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic is not configured on the server.");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 6500,
    system:
      "You are writing a venue blog post for a wedding photographer/videographer. Write in her voice: warm, editorial, not salesy. Use only the facts given — do not invent a couple story, venue details, or quotes. Venue and city must appear in the title and throughout. When voice examples are supplied, use their broad tone only; do not copy facts, names, or sentences. Return JSON only.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          weddingFacts: {
            venue: input.wedding.venue,
            city: input.wedding.city,
            date: input.wedding.weddingDate,
            palette: input.wedding.palette,
            editStyle: input.wedding.editStyle,
            musicLoved: input.wedding.musicLoved,
            musicRejected: input.wedding.musicRejected,
          },
          photoDescriptions: input.photos.map((photo) => photo.description),
          photographerFavoriteMoment: input.favoriteMoment,
          voice: input.voice === "delicate" ? "delicate and romantic" : "fun and active",
          optionalInspiration: input.optionalInspiration?.slice(0, 500) ?? "",
          approvedWorkVoiceExamples: input.voiceExamples?.slice(0, 2) ?? [],
          requiredShape: {
            title: "string",
            slug: "lowercase-hyphenated-string",
            metaDescription: "string",
            body: "string with clear headings",
            altTexts: ["one unique, photo-specific string per photo description, in the same order"],
            reelsScript: "30-45 second string with a hook, movement cues, favorite-moment payoff, and inquiry CTA",
            caption: "one best social caption using the favorite moment",
            hashtags: "5-7 specific hashtags for venue, city, and style",
            photoFileNames: ["one unique lowercase-hyphenated venue-city-moment filename per photo, no extension"],
            photoCaptions: ["one short generated caption per photo, in the same order"],
            extraCaptions: ["two optional alternatives: storytelling and venue-tagging"],
            extraFormats: {
              pinterest: "short Pinterest pin description",
              emailSneakPeek: "short email sneak-peek to the couple",
            },
          },
          constraints: [
            "Do not add names, people, venue facts, weather, quotes, or events that are not in the supplied facts.",
            "Leave out missing facts instead of guessing.",
            "Return exactly one alt text for each supplied photo description.",
            "Make every alt text unique, concrete, and distinct from the title; describe only what the supplied photo note supports.",
            "Return one unique lower-case hyphenated filename and one short caption for each supplied photo note.",
            "Use 5-7 specific hashtags without promising search rankings.",
            "Describe music by mood only; never claim a copyrighted track is trending.",
            "Return both optional captions and formats, but they will only be shown when the user asks.",
            "Use the venue and city in the title and naturally in the body.",
            "Return a single JSON object only; do not wrap it in markdown fences.",
          ],
        }),
      },
    ],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  try {
    const parsed: unknown = JSON.parse(rawText);
    const draft = draftSchema.parse(parsed);
    if (
      draft.altTexts.length !== input.photos.length ||
      draft.photoFileNames.length !== input.photos.length ||
      draft.photoCaptions.length !== input.photos.length
    ) throw new InvalidClaudeResponseError();
    const uniqueValues = (values: string[]) => new Set(values.map((value) => value.trim().toLocaleLowerCase())).size === values.length;
    if (!uniqueValues(draft.altTexts) || !uniqueValues(draft.photoFileNames)) throw new InvalidClaudeResponseError();
    const hashtagCount = draft.hashtags.split(/\s+/).filter((tag) => tag.startsWith("#")).length;
    if (hashtagCount < 5 || hashtagCount > 7) throw new InvalidClaudeResponseError();
    const title = draft.title.toLocaleLowerCase();
    const body = draft.body.toLocaleLowerCase();
    if (
      !title.includes(input.wedding.venue.toLocaleLowerCase()) ||
      !title.includes(input.wedding.city.toLocaleLowerCase()) ||
      !body.includes(input.wedding.venue.toLocaleLowerCase()) ||
      !body.includes(input.wedding.city.toLocaleLowerCase())
    ) {
      throw new InvalidClaudeResponseError();
    }
    return draft;
  } catch {
    throw new InvalidClaudeResponseError();
  }
}
