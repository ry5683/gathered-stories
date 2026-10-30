// WHAT: Converts a validated editable draft into the individual fields copied into ShowIt.
// WHY: ShowIt publishing stays a deliberate, manual copy-and-paste action; this app never publishes.
import type { DraftContent, PhotoDescription } from "@/lib/types";

export function getHeadings(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#{1,3}\s+/.test(line))
    .map((line) => line.replace(/^#{1,3}\s+/, ""));
}

export function makeShowItPack(draft: DraftContent, photos: PhotoDescription[]) {
  return {
    title: draft.title,
    slug: draft.slug,
    metaDescription: draft.metaDescription,
    headings: getHeadings(draft.body),
    body: draft.body,
    socialCaption: draft.caption,
    hashtags: draft.hashtags,
    reelsScript: draft.reelsScript,
    photos: photos.map((photo, index) => ({
      fileName: draft.photoFileNames[index] ?? `photo-${index + 1}`,
      caption: draft.photoCaptions[index] ?? photo.description,
      altText: draft.altTexts[index] ?? "",
    })),
    extraCaptions: draft.extraCaptions,
    extraFormats: draft.extraFormats,
  };
}
