// WHAT: Fills v2 draft fields when an older saved draft is reopened.
// WHY: The additive migration preserves existing drafts instead of forcing users to regenerate.
import type { DraftContent, PhotoDescription } from "@/lib/types";

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizeDraftContent(value: unknown, photos: PhotoDescription[]): DraftContent {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const altTexts = strings(record.altTexts);
  const photoDescriptions = photos.map((photo) => photo.description);
  const photoCaptions = strings(record.photoCaptions);
  const photoFileNames = strings(record.photoFileNames);
  const rawFormats = record.extraFormats && typeof record.extraFormats === "object" && !Array.isArray(record.extraFormats)
    ? record.extraFormats as Record<string, unknown>
    : {};
  const extraFormats: DraftContent["extraFormats"] = {
    ...(typeof rawFormats.pinterest === "string" ? { pinterest: rawFormats.pinterest } : {}),
    ...(typeof rawFormats.emailSneakPeek === "string" ? { emailSneakPeek: rawFormats.emailSneakPeek } : {}),
  };

  return {
    title: typeof record.title === "string" ? record.title : "",
    slug: typeof record.slug === "string" ? record.slug : "",
    metaDescription: typeof record.metaDescription === "string" ? record.metaDescription : "",
    body: typeof record.body === "string" ? record.body : "",
    altTexts,
    reelsScript: typeof record.reelsScript === "string" ? record.reelsScript : "",
    caption: typeof record.caption === "string" ? record.caption : "",
    hashtags: typeof record.hashtags === "string" ? record.hashtags : "",
    photoFileNames: photos.map((_, index) => photoFileNames[index] ?? `photo-${index + 1}`),
    photoCaptions: photos.map((_, index) => photoCaptions[index] ?? photoDescriptions[index] ?? altTexts[index] ?? ""),
    extraCaptions: strings(record.extraCaptions),
    extraFormats,
  };
}
