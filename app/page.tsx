// WHAT: Owns the four-step wedding-to-ShowIt user flow and calls the app's same-origin APIs.
// WHY: UI state stays client-side, while auth, Claude, validation, and persistence stay server-side.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AuthPanel } from "@/components/AuthPanel";
import { DraftReview } from "@/components/DraftReview";
import { PhotoPicker } from "@/components/PhotoPicker";
import { ShowItPack } from "@/components/ShowItPack";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VendorLibrary } from "@/components/VendorLibrary";
import { VendorPicker } from "@/components/VendorPicker";
import { VendorShareKit, type PostLinkInfo } from "@/components/VendorShareKit";
import type { VendorDraft } from "@/components/VendorFields";
import { WeddingForm } from "@/components/WeddingForm";
import { WeddingList } from "@/components/WeddingList";
import { cssVar } from "@/lib/motion";
import type { DraftContent, GeneratedDraft, LibraryVendor, PhotoDescription, Vendor, Wedding, WeddingSummary, WeddingVendor } from "@/lib/types";

const blankPhotos = (): PhotoDescription[] => Array.from({ length: 10 }, (_, index) => ({
  id: `photo-note-${index + 1}`,
  description: "",
}));
const initialWedding: Wedding = {
  venue: "",
  city: "",
  weddingDate: "",
  ceremonyTime: "",
  receptionTime: "",
  dressCode: "",
  palette: "",
  editStyle: "",
  musicLoved: "",
  musicRejected: "",
  photos: blankPhotos(),
  favoriteMoment: "",
  optionalInspiration: "",
  currentStep: 0,
  voice: "delicate",
  useVoiceExamples: true,
};

const steps = ["Wedding", "Photos + moment", "Review draft", "ShowIt pack"];

async function requestJson<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return result as T;
}

export default function HomePage() {
  const [step, setStep] = useState(0);
  const [wedding, setWedding] = useState(initialWedding);
  const [photos, setPhotos] = useState(blankPhotos());
  const [favoriteMoment, setFavoriteMoment] = useState("");
  const [optionalInspiration, setOptionalInspiration] = useState("");
  const [voice, setVoice] = useState<"delicate" | "active">(initialWedding.voice);
  const [useVoiceExamples, setUseVoiceExamples] = useState(initialWedding.useVoiceExamples);
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [weddingList, setWeddingList] = useState<WeddingSummary[]>([]);
  const [weeklyInquiries, setWeeklyInquiries] = useState(0);
  const [integrationsEnabled, setIntegrationsEnabled] = useState(false);
  const [showWeddingList, setShowWeddingList] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("");
  const [draftAutosavePending, setDraftAutosavePending] = useState(false);
  const [vendorLibrary, setVendorLibrary] = useState<LibraryVendor[]>([]);
  const [weddingVendors, setWeddingVendors] = useState<WeddingVendor[]>([]);
  const [vendorSaveStatus, setVendorSaveStatus] = useState("");
  const [showVendorLibrary, setShowVendorLibrary] = useState(false);
  const [reviewVendorsOpen, setReviewVendorsOpen] = useState(false);
  const [postLink, setPostLink] = useState<PostLinkInfo>({ wordpressUrl: null, isPublished: false, postUrl: null });
  const [profile, setProfile] = useState({ photographerName: "", photographerInstagram: "" });
  const vendorSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const vendorSaveVersionRef = useRef(0);
  const vendorLoadVersionRef = useRef(0);
  const authStateRef = useRef(false);
  const workAreaRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef(step);
  const weddingIdRef = useRef<string | undefined>(initialWedding.id);
  const hasLocalChangesRef = useRef(false);
  const weddingSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const draftSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const weddingChangeVersionRef = useRef(0);
  const draftEditVersionRef = useRef(0);
  const draftAutosaveTimerRef = useRef<number | undefined>(undefined);

  const loadWeddingList = useCallback(async () => {
    try {
      const result = await requestJson<{ weddings: WeddingSummary[]; integrationsEnabled: boolean; weeklyInquiries: number }>("/api/weddings", undefined, "GET");
      setWeddingList(result.weddings);
      setIntegrationsEnabled(result.integrationsEnabled);
      setWeeklyInquiries(result.weeklyInquiries);
      if (result.weddings.length > 0 && !hasLocalChangesRef.current) setShowWeddingList(true);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Saved weddings could not be loaded.");
      return false;
    }
  }, []);

  // Vendors and the photographer's credit line load once per sign-in; the library is shared by every wedding.
  const loadVendorLibrary = useCallback(async () => {
    try {
      const result = await requestJson<{ vendors: LibraryVendor[] }>("/api/vendors", undefined, "GET");
      setVendorLibrary(result.vendors);
    } catch {
      // Vendors are optional; the picker shows an empty library and the error surfaces on the first save.
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const result = await requestJson<{ photographerName: string | null; photographerInstagram: string | null }>("/api/preferences/profile", undefined, "GET");
      setProfile({ photographerName: result.photographerName ?? "", photographerInstagram: result.photographerInstagram ?? "" });
    } catch {
      // Optional; used only in vendor share messages.
    }
  }, []);

  const loadWeddingVendors = useCallback(async (weddingId: string | undefined) => {
    const version = ++vendorLoadVersionRef.current;
    vendorSaveVersionRef.current += 1;
    setWeddingVendors([]);
    setVendorSaveStatus("");
    if (!weddingId) return;
    try {
      const result = await requestJson<{ vendors: WeddingVendor[] }>(`/api/weddings/${weddingId}/vendors`, undefined, "GET");
      if (version === vendorLoadVersionRef.current) setWeddingVendors(result.vendors);
    } catch {
      if (version === vendorLoadVersionRef.current) setVendorSaveStatus("This wedding's vendors could not be loaded.");
    }
  }, []);

  const handleAuthChange = useCallback((isAuthenticated: boolean) => {
    const wasAuthenticated = authStateRef.current;
    authStateRef.current = isAuthenticated;
    setAuthenticated(isAuthenticated);
    if (isAuthenticated) {
      void loadWeddingList();
      void loadVendorLibrary();
      void loadProfile();
    } else {
      setWeddingList([]);
      setVendorLibrary([]);
      setWeddingVendors([]);
      setShowVendorLibrary(false);
      setShowWeddingList(false);
      if (wasAuthenticated) {
        weddingIdRef.current = undefined;
        hasLocalChangesRef.current = false;
        setHasLocalChanges(false);
        setWedding({ ...initialWedding, photos: blankPhotos() });
        setPhotos(blankPhotos());
        setFavoriteMoment("");
        setOptionalInspiration("");
        setVoice(initialWedding.voice);
        setUseVoiceExamples(initialWedding.useVoiceExamples);
        setDraft(null);
        setDraftAutosavePending(false);
        setStep(0);
        setAutoSaveStatus("");
        setError("");
        setNotice("Signed out. The current wedding workspace was cleared from this browser.");
      }
    }
  }, [loadProfile, loadVendorLibrary, loadWeddingList]);

  const markChanged = useCallback(() => {
    weddingChangeVersionRef.current += 1;
    hasLocalChangesRef.current = true;
    setHasLocalChanges(true);
    setAutoSaveStatus(authenticated ? "Unsaved changes" : "Sign in to sync your work.");
  }, [authenticated]);

  const weddingSnapshot = useCallback((): Wedding => ({
    ...wedding,
    photos,
    favoriteMoment,
    optionalInspiration,
    currentStep: step,
    voice,
    useVoiceExamples,
  }), [wedding, photos, favoriteMoment, optionalInspiration, step, voice, useVoiceExamples]);

  const saveWeddingSnapshot = useCallback(async (): Promise<string> => {
    const snapshot = weddingSnapshot();
    const version = weddingChangeVersionRef.current;
    const savePromise = weddingSaveQueueRef.current.catch(() => undefined).then(() =>
      requestJson<{ id: string }>("/api/weddings", {
        ...snapshot,
        ...(weddingIdRef.current ? { id: weddingIdRef.current } : {}),
      }),
    );
    weddingSaveQueueRef.current = savePromise.then(() => undefined, () => undefined);
    const saved = await savePromise;
    weddingIdRef.current = saved.id;
    setWedding((current) => ({ ...current, id: saved.id }));
    if (version === weddingChangeVersionRef.current) {
      hasLocalChangesRef.current = false;
      setHasLocalChanges(false);
      setAutoSaveStatus("Saved");
    }
    return saved.id;
  }, [weddingSnapshot]);

  useEffect(() => {
    if (previousStep.current !== step) {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      workAreaRef.current?.scrollIntoView({ behavior, block: "start" });
      previousStep.current = step;
    }
  }, [step]);

  useEffect(() => {
    if (error || notice) {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      alertsRef.current?.scrollIntoView({ behavior, block: "nearest" });
    }
  }, [error, notice]);

  useEffect(() => {
    if (!hasLocalChanges || showWeddingList) return;
    if (!authenticated) {
      setAutoSaveStatus("Sign in to sync your work.");
      return;
    }
    const snapshot = weddingSnapshot();
    const version = weddingChangeVersionRef.current;
    const timer = window.setTimeout(() => {
      setAutoSaveStatus("Saving…");
      const savePromise = weddingSaveQueueRef.current.catch(() => undefined).then(() =>
        requestJson<{ id: string }>("/api/weddings", {
          ...snapshot,
          ...(weddingIdRef.current ? { id: weddingIdRef.current } : {}),
        }),
      );
      weddingSaveQueueRef.current = savePromise.then(() => undefined, () => undefined);
      void savePromise.then((saved) => {
        weddingIdRef.current = saved.id;
        setWedding((current) => ({ ...current, id: saved.id }));
        if (version === weddingChangeVersionRef.current) {
          hasLocalChangesRef.current = false;
          setHasLocalChanges(false);
          setAutoSaveStatus("Saved");
        }
      }).catch((caught: unknown) => {
        setAutoSaveStatus("Save failed");
        setError(caught instanceof Error ? caught.message : "Wedding changes could not be saved.");
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [authenticated, hasLocalChanges, showWeddingList, weddingSnapshot]);

  useEffect(() => {
    if (!authenticated || !draftAutosavePending || !draft || draft.status !== "draft") return;
    const version = draftEditVersionRef.current;
    const content = asContent(draft);
    const timer = window.setTimeout(() => {
      draftAutosaveTimerRef.current = undefined;
      setAutoSaveStatus("Saving…");
      draftSaveQueueRef.current = draftSaveQueueRef.current.catch(() => undefined).then(async () => {
        await requestJson<GeneratedDraft>(`/api/drafts/${draft.id}`, content, "PATCH");
        if (version === draftEditVersionRef.current) {
          setDraftAutosavePending(false);
          setAutoSaveStatus("Saved");
        }
      }).catch((caught: unknown) => {
        setAutoSaveStatus("Save failed");
        setError(caught instanceof Error ? caught.message : "Draft edits could not be saved.");
        if (version === draftEditVersionRef.current) setDraftAutosavePending(false);
      });
    }, 700);
    draftAutosaveTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (draftAutosaveTimerRef.current === timer) draftAutosaveTimerRef.current = undefined;
    };
  }, [authenticated, draft, draftAutosavePending]);

  // WHAT: Saves safe structured fields, then requests a real server-generated draft.
  // WHY: Claude is called only after the user acts, and the browser never receives an API key.
  async function writeDraft() {
    setError("");
    setNotice("");
    if (!wedding.venue.trim() || !wedding.city.trim() || !wedding.weddingDate.trim()) {
      setError("Add the venue, city, and date before continuing.");
      return;
    }
    if (!favoriteMoment.trim()) {
      setError("Add the one moment only you can describe before writing.");
      return;
    }
    if (photos.some((photo) => !photo.description.trim())) {
      setError("Add a short description for each of the 10–20 photos.");
      return;
    }
    if (!authenticated) {
      setError("Sign in to save and generate this draft.");
      return;
    }
    setBusy(true);
    try {
      const savedWeddingId = await saveWeddingSnapshot();
      const generated = await requestJson<GeneratedDraft>("/api/generate-post", {
        weddingId: savedWeddingId,
        photos,
        favoriteMoment: favoriteMoment.trim(),
        voice,
        optionalInspiration: optionalInspiration.trim(),
        useVoiceExamples,
      });
      setDraft(generated);
      setDraftAutosavePending(false);
      setStep(2);
      setWedding((current) => ({ ...current, currentStep: 2 }));
      markChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Draft generation failed.");
    } finally {
      setBusy(false);
    }
  }

  function asContent(current: GeneratedDraft): DraftContent {
    const { id: _id, status: _status, similarityWarning: _similarityWarning, ...content } = current;
    return content;
  }

  // WHAT: Persists edits and keeps the draft's workflow status unchanged.
  // WHY: Approval is a separate explicit action and does not publish the text.
  async function saveDraft(): Promise<boolean> {
    if (!draft || !authenticated) return false;
    if (draftAutosaveTimerRef.current !== undefined) {
      window.clearTimeout(draftAutosaveTimerRef.current);
      draftAutosaveTimerRef.current = undefined;
    }
    draftEditVersionRef.current += 1;
    setDraftAutosavePending(false);
    setBusy(true);
    setError("");
    try {
      await draftSaveQueueRef.current;
      const saved = await requestJson<GeneratedDraft>(`/api/drafts/${draft.id}`, asContent(draft), "PATCH");
      setDraft({ ...saved, similarityWarning: draft.similarityWarning });
      setNotice("Draft edits saved.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Draft could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // WHAT: Reuses the current draft row when the photographer changes the voice.
  // WHY: The selected tone affects Claude output while preserving a single editable draft.
  async function regenerateDraft() {
    if (!draft || !weddingIdRef.current || !authenticated) return;
    if (draftAutosaveTimerRef.current !== undefined) {
      window.clearTimeout(draftAutosaveTimerRef.current);
      draftAutosaveTimerRef.current = undefined;
    }
    draftEditVersionRef.current += 1;
    setDraftAutosavePending(false);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await draftSaveQueueRef.current;
      const generated = await requestJson<GeneratedDraft>("/api/generate-post", {
        weddingId: weddingIdRef.current,
        draftId: draft.id,
        photos,
        favoriteMoment: favoriteMoment.trim(),
        voice,
        optionalInspiration: optionalInspiration.trim(),
        useVoiceExamples,
      });
      setDraft(generated);
      setDraftAutosavePending(false);
      setNotice("Draft rewritten in the selected voice.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Draft could not be rewritten.");
    } finally {
      setBusy(false);
    }
  }

  // WHAT: Saves the latest edits, then marks the draft approved.
  // WHY: ShowIt remains a manual copy step; approval has no publishing side effect.
  async function approveDraft() {
    if (!draft || !authenticated || !(await saveDraft())) return;
    setBusy(true);
    setError("");
    try {
      const approved = await requestJson<{ status: "approved" }>(`/api/drafts/${draft.id}/approve`);
      setDraft({ ...draft, status: approved.status });
      setStep(3);
      setWedding((current) => ({ ...current, currentStep: 3 }));
      markChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Draft could not be approved.");
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(content: DraftContent) {
    if (!draft) return;
    setDraft({ ...draft, ...content });
    draftEditVersionRef.current += 1;
    setDraftAutosavePending(true);
    setAutoSaveStatus(authenticated ? "Unsaved changes" : "Sign in to sync your work.");
  }

  function goToStep(nextStep: number) {
    setStep(nextStep);
    setWedding((current) => ({ ...current, currentStep: nextStep }));
    markChanged();
  }

  async function continueToPhotos() {
    if (!wedding.venue.trim() || !wedding.city.trim() || !wedding.weddingDate.trim()) {
      setError("Add the venue, city, and date before continuing.");
      return;
    }
    setError("");
    if (authenticated) {
      try {
        await saveWeddingSnapshot();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Wedding details could not be saved.");
        return;
      }
    } else {
      setNotice("Sign in to sync your work and generate a draft.");
    }
    goToStep(1);
  }

  function changeWedding(next: Wedding) {
    setWedding(next);
    markChanged();
  }

  function changePhotos(next: PhotoDescription[]) {
    setPhotos(next);
    markChanged();
  }

  function changeFavoriteMoment(next: string) {
    setFavoriteMoment(next);
    markChanged();
  }

  function changeInspiration(next: string) {
    setOptionalInspiration(next);
    markChanged();
  }

  function changeVoice(next: "delicate" | "active") {
    setVoice(next);
    markChanged();
  }

  function changeUseVoiceExamples(next: boolean) {
    setUseVoiceExamples(next);
    markChanged();
  }

  function startNewWedding() {
    weddingIdRef.current = undefined;
    hasLocalChangesRef.current = false;
    setHasLocalChanges(false);
    setWedding({ ...initialWedding, photos: blankPhotos() });
    setPhotos(blankPhotos());
    setFavoriteMoment("");
    setOptionalInspiration("");
    setVoice(initialWedding.voice);
    setUseVoiceExamples(initialWedding.useVoiceExamples);
    setDraft(null);
    setDraftAutosavePending(false);
    setStep(0);
    setError("");
    setNotice("");
    setAutoSaveStatus("");
    setShowWeddingList(false);
    setShowVendorLibrary(false);
    setReviewVendorsOpen(false);
    setPostLink({ wordpressUrl: null, isPublished: false, postUrl: null });
    void loadWeddingVendors(undefined);
  }

  function resumeWedding(item: WeddingSummary) {
    weddingIdRef.current = item.wedding.id;
    hasLocalChangesRef.current = false;
    setHasLocalChanges(false);
    setWedding(item.wedding);
    setPhotos(item.wedding.photos.length ? item.wedding.photos : blankPhotos());
    setFavoriteMoment(item.wedding.favoriteMoment);
    setOptionalInspiration(item.wedding.optionalInspiration);
    setVoice(item.wedding.voice);
    setUseVoiceExamples(item.wedding.useVoiceExamples);
    setDraft(item.draft);
    setDraftAutosavePending(false);
    const resumeStep = item.draft ? item.draft.status === "approved" ? 3 : 2 : item.wedding.currentStep;
    setStep(resumeStep);
    setError("");
    setNotice("");
    setShowWeddingList(false);
    setShowVendorLibrary(false);
    setReviewVendorsOpen(false);
    setPostLink({ wordpressUrl: item.wordpressDraftUrl, isPublished: item.isPublished, postUrl: item.postUrl });
    void loadWeddingVendors(item.wedding.id);
  }

  // The vendor set saves as a whole, in order, after the wedding itself has an id.
  function changeWeddingVendors(next: WeddingVendor[]) {
    setWeddingVendors(next);
    const version = ++vendorSaveVersionRef.current;
    setVendorSaveStatus("Saving vendors…");
    const run = vendorSaveQueueRef.current.catch(() => undefined).then(async () => {
      if (version !== vendorSaveVersionRef.current) return;
      const weddingId = weddingIdRef.current ?? await saveWeddingSnapshot();
      const saved = await requestJson<{ vendors: WeddingVendor[] }>(`/api/weddings/${weddingId}/vendors`, {
        vendors: next.map((item) => ({ vendorId: item.vendor.id, isCollaborator: item.isCollaborator })),
      }, "PUT");
      if (version === vendorSaveVersionRef.current) {
        setWeddingVendors(saved.vendors);
        setVendorSaveStatus("Vendors saved");
      }
    });
    vendorSaveQueueRef.current = run.catch((caught) => {
      if (version === vendorSaveVersionRef.current) setVendorSaveStatus(caught instanceof Error ? caught.message : "Vendors could not be saved.");
    });
  }

  function vendorPayload(draft: VendorDraft) {
    return {
      businessName: draft.businessName.trim(),
      role: draft.role,
      roleLabel: draft.roleLabel.trim() || null,
      website: draft.website.trim() || null,
      instagramHandle: draft.instagramHandle.trim().replace(/^@/, "") || null,
    };
  }

  async function createVendor(draft: VendorDraft): Promise<Vendor> {
    const result = await requestJson<{ vendor: LibraryVendor }>("/api/vendors", vendorPayload(draft));
    setVendorLibrary((current) => [...current, result.vendor].sort((a, b) => a.businessName.localeCompare(b.businessName)));
    return result.vendor;
  }

  async function updateVendor(id: string, draft: VendorDraft) {
    const result = await requestJson<{ vendor: Vendor }>(`/api/vendors/${id}`, vendorPayload(draft), "PATCH");
    setVendorLibrary((current) => current.map((vendor) => (vendor.id === id ? { ...result.vendor, weddingCount: vendor.weddingCount } : vendor)));
    setWeddingVendors((current) => current.map((item) => (item.vendor.id === id ? { ...item, vendor: result.vendor } : item)));
  }

  async function deleteVendor(id: string, confirmed: boolean): Promise<{ needsConfirm: number } | null> {
    const response = await fetch(`/api/vendors/${id}${confirmed ? "?confirm=1" : ""}`, { method: "DELETE", cache: "no-store" });
    const result: unknown = await response.json();
    if (response.status === 409 && result && typeof result === "object" && "weddingCount" in result && typeof result.weddingCount === "number") {
      return { needsConfirm: result.weddingCount };
    }
    if (!response.ok) {
      throw new Error(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "The vendor could not be deleted.");
    }
    setVendorLibrary((current) => current.filter((vendor) => vendor.id !== id));
    setWeddingVendors((current) => current.filter((item) => item.vendor.id !== id));
    return null;
  }

  async function saveProfile(next: { photographerName: string; photographerInstagram: string }) {
    const result = await requestJson<{ photographerName: string | null; photographerInstagram: string | null }>("/api/preferences/profile", {
      photographerName: next.photographerName,
      photographerInstagram: next.photographerInstagram,
      currentTheme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    }, "PUT");
    setProfile({ photographerName: result.photographerName ?? "", photographerInstagram: result.photographerInstagram ?? "" });
  }

  async function savePostUrl(url: string) {
    const weddingId = weddingIdRef.current ?? await saveWeddingSnapshot();
    const result = await requestJson<{ postUrl: string | null }>(`/api/weddings/${weddingId}/post-url`, { postUrl: url || null }, "PUT");
    setPostLink((current) => ({ ...current, postUrl: result.postUrl }));
    setWeddingList((current) => current.map((item) => (item.wedding.id === weddingId ? { ...item, postUrl: result.postUrl } : item)));
  }

  async function markVendorSent(vendorId: string, sent: boolean) {
    const weddingId = weddingIdRef.current;
    if (!weddingId) return;
    const result = await requestJson<{ sharedAt: string | null }>(`/api/weddings/${weddingId}/vendors/${vendorId}/shared`, sent ? {} : undefined, sent ? "POST" : "DELETE");
    setWeddingVendors((current) => current.map((item) => (item.vendor.id === vendorId ? { ...item, sharedAt: result.sharedAt } : item)));
    setWeddingList((current) => current.map((item) => (item.wedding.id === weddingId
      ? { ...item, vendorsSentCount: Math.max(0, item.vendorsSentCount + (sent ? 1 : -1)) }
      : item)));
  }

  function openVendorLibrary() {
    void loadVendorLibrary();
    setShowVendorLibrary(true);
  }

  async function markAsPublished(postRecordId: string) {
    setError("");
    try {
      await requestJson(`/api/wordpress/posts/${postRecordId}/publish`, {});
      await loadWeddingList();
      setNotice("Marked live in WordPress.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The post could not be updated.");
    }
  }

  async function recordInquiry(postRecordId: string) {
    setError("");
    try {
      await requestJson(`/api/wordpress/posts/${postRecordId}/inquiries`, {});
      await loadWeddingList();
      setNotice("Inquiry recorded.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The inquiry could not be recorded.");
    }
  }

  async function openWeddingList() {
    setError("");
    if (hasLocalChangesRef.current) {
      try {
        await saveWeddingSnapshot();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Wedding changes could not be saved.");
        return;
      }
    }
    if (draftAutosavePending && draft && !(await saveDraft())) return;
    if (await loadWeddingList()) setShowWeddingList(true);
  }


  const vendorPicker = (
    <VendorPicker
      authenticated={authenticated}
      library={vendorLibrary}
      selected={weddingVendors}
      saveStatus={vendorSaveStatus}
      onChange={changeWeddingVendors}
      onCreateVendor={createVendor}
      onOpenLibrary={openVendorLibrary}
    />
  );
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Gathered Stories home">
          <span className="brand-mark" aria-hidden="true">
            <Image className="brand-icon-light" src="/icons/gathered-stories-light.png" alt="" width={768} height={768} unoptimized />
            <Image className="brand-icon-dark" src="/icons/gathered-stories-dark.png" alt="" width={768} height={768} unoptimized />
          </span>
          <span>gathered stories</span>
        </a>
        <div className="header-actions">
          <AuthPanel onAuthChange={handleAuthChange} />
          {authenticated && weddingList.length > 0 && !showWeddingList && <button className="button button-secondary" type="button" onClick={openWeddingList}>My weddings</button>}
          <ThemeToggle />
          <details className="help-popover">
            <summary aria-label="Help">?</summary>
            <div className="tooltip-content">Only selected wedding facts, photo descriptions, your favorite moment, and optional inspiration are sent for drafting. Prior approved work is reduced to style cues. Leave names and contact details out of free text, and review before using any text.</div>
          </details>
        </div>
      </header>

      <section className="intro">
        <p className="eyebrow">A quiet studio for your next story</p>
        <h1>From wedding day to <em>venue story.</em></h1>
        <p className="intro-copy">Start with the details you already have. Shape a thoughtful draft in your voice, then carry it into ShowIt when you are ready.</p>
        <div className="flourish" aria-hidden="true">
          <span className="flourish-mark">
            <Image className="brand-icon-light" src="/icons/gathered-stories-light.png" alt="" width={768} height={768} unoptimized />
            <Image className="brand-icon-dark" src="/icons/gathered-stories-dark.png" alt="" width={768} height={768} unoptimized />
          </span>
        </div>
      </section>

      {!showWeddingList && <nav className="step-nav" aria-label="Wedding story steps" style={cssVar("--step-index", step)}>
        {steps.map((label, index) => (
          <button className={`step-tab ${step === index ? "active" : ""} ${step > index ? "complete" : ""}`} type="button" key={label} onClick={() => {
            if (index === step) return;
            if (index === 1 && step === 0) void continueToPhotos();
            else if (index <= step && (index < 2 || draft)) goToStep(index);
          }} aria-current={step === index ? "step" : undefined} disabled={index > step || (index >= 2 && !draft)}>
            <span className="step-number">{index + 1}</span>{label}
          </button>
        ))}
      </nav>}

      <div className="work-area" ref={workAreaRef}>
        {showVendorLibrary && authenticated ? (
          <VendorLibrary
            vendors={vendorLibrary}
            onSave={updateVendor}
            onDelete={deleteVendor}
            onClose={() => setShowVendorLibrary(false)}
            profile={profile}
            onSaveProfile={saveProfile}
          />
        ) : showWeddingList && authenticated ? (
          <WeddingList
            weddings={weddingList}
            weeklyInquiries={weeklyInquiries}
            integrationsEnabled={integrationsEnabled}
            onResume={resumeWedding}
            onNew={startNewWedding}
            onOpenVendors={openVendorLibrary}
            onInquiry={recordInquiry}
            onMarkPublished={markAsPublished}
          />
        ) : (
        <div className="step-view" key={step}>
        {step === 0 && (
          <>
            <WeddingForm wedding={wedding} onChange={changeWedding} />
            {vendorPicker}
            <div className="step-actions">
              <span className="microcopy">{autoSaveStatus || "Your information stays private to your account when saved."}</span>
              <button className="button button-primary" type="button" onClick={continueToPhotos}>Continue to photos <span className="btn-arrow" aria-hidden="true">→</span></button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <PhotoPicker photos={photos} onChange={changePhotos} />
            <section className="panel moment-panel">
              <label className="field">
                <span className="eyebrow">Only you can write this</span>
                <span className="moment-title">What was your favorite moment from the day?</span>
                <textarea rows={3} maxLength={1000} value={favoriteMoment} onChange={(event) => changeFavoriteMoment(event.target.value)} placeholder="One line is enough. A small moment, exactly as you remember it. Please leave out names and contact details." />
              </label>
            </section>
            <section className="panel moment-panel">
              <label className="field">
                <span className="field-label">Optional inspiration</span>
                <span className="muted-copy">A detail, phrase, or creative direction. Leave out names and contact details.</span>
                <textarea rows={3} maxLength={500} value={optionalInspiration} onChange={(event) => changeInspiration(event.target.value)} />
              </label>
              <label className="field voice-choice">
                <span className="field-label">Writing voice</span>
                <select value={voice} onChange={(event) => changeVoice(event.target.value as "delicate" | "active")}>
                  <option value="delicate">Delicate / romantic</option>
                  <option value="active">Fun / active</option>
                </select>
              </label>
              <label className="check-row">
                <input type="checkbox" checked={useVoiceExamples} onChange={(event) => changeUseVoiceExamples(event.target.checked)} />
                <span>Use privacy-safe style cues calculated from my previously approved drafts.</span>
              </label>
            </section>
            <div className="step-actions">
              <span className="microcopy">{autoSaveStatus}</span>
              <button className="button button-secondary" type="button" onClick={() => goToStep(0)}><span className="btn-arrow" aria-hidden="true">←</span> Back</button>
              <button className="button button-primary" type="button" onClick={writeDraft} disabled={busy} aria-busy={busy}>{busy ? "Writing your draft…" : "Write draft"} <span className="btn-arrow" aria-hidden="true">→</span></button>
            </div>
          </>
        )}

        {step === 2 && draft && (
          <>
            <DraftReview draft={asContent(draft)} approved={draft.status === "approved"} busy={busy} voice={voice} similarityWarning={draft.similarityWarning ?? false} saveStatus={autoSaveStatus} onChange={updateDraft} onVoiceChange={changeVoice} onRegenerate={regenerateDraft} onApprove={approveDraft} vendors={weddingVendors} onEditVendors={() => setReviewVendorsOpen((open) => !open)} />
            {reviewVendorsOpen && vendorPicker}
            <div className="step-actions">
              <button className="button button-secondary" type="button" onClick={() => goToStep(1)}><span className="btn-arrow" aria-hidden="true">←</span> Back to photo notes</button>
              <span className="microcopy">Nothing is published from this app.</span>
            </div>
          </>
        )}

        {step === 3 && draft?.status === "approved" && (
          <>
            <ShowItPack draft={asContent(draft)} photos={photos} draftId={draft.id} integrationsEnabled={integrationsEnabled} vendors={weddingVendors} onWordPressDelivered={(draftUrl) => setPostLink((current) => ({ ...current, wordpressUrl: draftUrl, isPublished: false }))}>
              <VendorShareKit
                vendors={weddingVendors}
                venue={wedding.venue}
                weddingDate={wedding.weddingDate}
                link={postLink}
                profile={profile}
                onSavePostUrl={savePostUrl}
                onMarkSent={markVendorSent}
                onEditProfile={openVendorLibrary}
                onEditVendors={() => setReviewVendorsOpen((open) => !open)}
              />
              {reviewVendorsOpen && <div className="share-kit-picker">{vendorPicker}</div>}
            </ShowItPack>
            <div className="step-actions">
              <button className="button button-secondary" type="button" onClick={() => goToStep(2)}><span className="btn-arrow" aria-hidden="true">←</span> Back to approved draft</button>
              <span className="microcopy">Copy and paste each field into ShowIt when ready.</span>
            </div>
          </>
        )}

        </div>
        )}
        {(error || notice) && <div className="alerts" ref={alertsRef}>
          {error && <p className="alert-error" role="alert">{error}</p>}
          {notice && <p className="alert-success" role="status">{notice}</p>}
        </div>}
      </div>

      <footer className="footer-note">
        <span className="footer-sign">
          <span className="brand-mark" aria-hidden="true">
            <Image className="brand-icon-light" src="/icons/gathered-stories-light.png" alt="" width={768} height={768} unoptimized />
            <Image className="brand-icon-dark" src="/icons/gathered-stories-dark.png" alt="" width={768} height={768} unoptimized />
          </span>
          made for stories worth remembering.
        </span>
        <span>Draft-only · no auto-publishing · no raw photo uploads</span>
      </footer>
    </main>
  );
}
