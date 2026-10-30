import { z } from "zod";

export const editableDraftContentSchema = z.object({
  title: z.string().trim().max(180),
  slug: z.string().trim().max(180).regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/),
  metaDescription: z.string().trim().max(320),
  body: z.string().trim().max(20000),
  altTexts: z.array(z.string().trim().max(500)).min(10).max(20),
  reelsScript: z.string().trim().max(6000),
  caption: z.string().trim().max(2000),
  hashtags: z.string().trim().max(500),
  photoFileNames: z.array(z.string().trim().max(120).regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/)).min(10).max(20),
  photoCaptions: z.array(z.string().trim().max(500)).min(10).max(20),
  extraCaptions: z.array(z.string().trim().max(2000)).max(2),
  extraFormats: z.object({
    pinterest: z.string().trim().max(2000).optional(),
    emailSneakPeek: z.string().trim().max(2000).optional(),
  }),
});

export const approvableDraftContentSchema = z.object({
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  metaDescription: z.string().trim().min(1).max(320),
  body: z.string().trim().min(1).max(20000).refine((body) => /(^|\n)#{1,3}\s+\S+/.test(body)),
  altTexts: z.array(z.string().trim().min(1).max(500)).min(10).max(20),
  reelsScript: z.string().trim().min(1).max(6000),
  caption: z.string().trim().min(1).max(2000),
  hashtags: z.string().trim().min(1).max(500),
  photoFileNames: z.array(z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(10).max(20),
  photoCaptions: z.array(z.string().trim().min(1).max(500)).min(10).max(20),
  extraCaptions: z.array(z.string().trim().min(1).max(2000)).max(2),
  extraFormats: z.object({
    pinterest: z.string().trim().max(2000).optional(),
    emailSneakPeek: z.string().trim().max(2000).optional(),
  }),
}).superRefine((draft, context) => {
  for (const key of ["altTexts", "photoFileNames"] as const) {
    const values = draft[key].map((value) => value.toLocaleLowerCase());
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", path: [key], message: `${key} must be unique.` });
    }
  }
  const hashtagCount = draft.hashtags.split(/\s+/).filter((tag) => tag.startsWith("#")).length;
  if (hashtagCount < 5 || hashtagCount > 7) {
    context.addIssue({ code: "custom", path: ["hashtags"], message: "Include between 5 and 7 hashtags." });
  }
});
