// WHAT: Shared, non-secret shapes used by the browser UI and server routes.
// WHY: A single vocabulary keeps the four steps and their API payloads aligned.

export type Wedding = {
  id?: string;
  venue: string;
  city: string;
  weddingDate: string;
  ceremonyTime: string;
  receptionTime: string;
  dressCode: string;
  palette: string;
  editStyle: string;
  musicLoved: string;
  musicRejected: string;
  photos: PhotoDescription[];
  favoriteMoment: string;
  optionalInspiration: string;
  currentStep: number;
  voice: "delicate" | "active";
  useVoiceExamples: boolean;
};

export type PhotoDescription = {
  id: string;
  description: string;
};

export type GeneratedDraft = {
  id: string;
  status: "draft" | "approved";
  title: string;
  slug: string;
  metaDescription: string;
  body: string;
  altTexts: string[];
  reelsScript: string;
  caption: string;
  hashtags: string;
  photoFileNames: string[];
  photoCaptions: string[];
  extraCaptions: string[];
  extraFormats: {
    pinterest?: string;
    emailSneakPeek?: string;
  };
  similarityWarning?: boolean;
};

export type DraftContent = Omit<GeneratedDraft, "id" | "status" | "similarityWarning">;

export type WeddingSummary = {
  wedding: Wedding;
  draft: GeneratedDraft | null;
  status: "Draft" | "Approved" | "Sent";
  wordpressPostRecordId: string | null;
  wordpressDraftUrl: string | null;
  isPublished: boolean;
  inquiryCount: number;
};
