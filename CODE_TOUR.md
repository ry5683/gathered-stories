# Code tour

This guide follows the app as it exists in the repository. The new-wedding form starts blank; no real questionnaire content is included.

## File map

- `app/page.tsx` — the four-step client UI, wedding/draft autosave, resume flow, validation messages, and same-origin fetch calls.
- `app/layout.tsx` — metadata, global CSS, and the early theme preference initializer.
- `app/globals.css` — explicit color tokens and responsive styles for both themes.
- `components/WeddingForm.tsx` — editable wedding facts and the local allowlisted paste/import box.
- `components/PhotoPicker.tsx` — 10–20 short image descriptions; it never receives image files.
- `components/DraftReview.tsx` — autosaved editable content, voice switch, rewrite, similarity warning, and confirmed approval.
- `components/ShowItPack.tsx` — maps the approved draft to ShowIt fields, Copy all, individual copy buttons, and the optional WordPress draft controls.
- `components/WeddingList.tsx` — resumable wedding summaries and manual post/inquiry status actions.
- `components/AuthPanel.tsx` — passwordless email sign-in and sign-out.
- `components/ThemeToggle.tsx` — local theme choice plus optional signed-in preference sync.
- `app/api/weddings/route.ts` — auth check and allowlisted wedding-field persistence.
- `app/api/generate-post/route.ts` — validates request, verifies wedding ownership through RLS, calls the Claude helper, validates the response, and saves draft status.
- `app/api/drafts/[id]/route.ts` — saves edits to a draft owned by the current user.
- `app/api/drafts/[id]/approve/route.ts` — changes only the draft status; it does not publish.
- `app/api/wordpress/` — verifies an authenticated connection, sends approved content as an unpublished WordPress draft, and stores manual publish/inquiry status.
- `app/api/preferences/theme/route.ts` — reads and writes a signed-in user's theme preference.
- `lib/claude.ts` — the server-only prompt builder, Anthropic SDK call, and output validation.
- `lib/showit.ts` — extracts headings and creates the copy-ready pack.
- `lib/draft-validation.ts` — distinguishes autosavable content from content complete enough to approve.
- `lib/wordpress.ts` — encrypts WordPress credentials and validates/pins public HTTPS destinations before making non-redirecting requests.
- `lib/supabase-browser.ts` and `lib/supabase-server.ts` — public browser client and cookie-backed server client.
- `lib/types.ts` — the shared data shapes; `lib/theme.ts` — the theme value names; `lib/motion.ts` — typed CSS animation indices.
- `supabase/schema.sql` and `supabase/migrations/20261030_v2_foundation.sql` — resumable state, integration tables, grants, and row-level security policies.

## One draft from click to copy

```text
Step 2: click "Write draft"
  → app/page.tsx autosaves only allowlisted structured fields to /api/weddings
  → app/api/weddings/route.ts checks the signed-in user and saves under that user ID
  → app/page.tsx POST /api/generate-post with wedding ID, 10–20 descriptions,
    favorite moment, selected voice, optional inspiration, and style cues
  → app/api/generate-post/route.ts checks auth, then reads the owned wedding via RLS
  → lib/claude.ts builds a small allowlisted prompt and calls Claude on the server
  → lib/claude.ts parses and validates the required JSON (including one alt text per photo)
  → route saves content with status "draft" in Supabase
  → Step 3 renders editable fields; autosave and rewrite remain draft-only
  → Approve calls /api/drafts/[id]/approve and changes the status to "approved"
  → Step 4 uses lib/showit.ts to format all copy-ready fields for ShowIt
  → optional WordPress delivery creates status=draft only; it never publishes
```

No request publishes content. WordPress credentials are AES-256-GCM encrypted with a server-only key, and outbound requests require a public HTTPS destination pinned to a validated IP. Supabase policies use `auth.uid()` for every user-owned row; integration tables are server-only.

## Plain-English glossary

- **API route:** Server code called over HTTP by the UI. Here, `generate-post` holds the AI call so no key enters browser code.
- **Server component / client component:** Next.js renders server components on the server by default. Files marked `"use client"` need browser state or events; the app's interactive steps are client components.
- **Environment variable:** A setting supplied outside source code. AI and WordPress integration keys are server-only secrets.
- **RLS:** Row Level Security. Supabase checks each query against the signed-in user's ID; it is the ownership boundary, not a UI filter.
- **JSON validation:** Checking an incoming/outgoing JSON value against an expected shape before using it. Invalid Claude JSON returns an error and is not saved.
- **Supabase:** The hosted auth and Postgres service used here. The app uses the anon key with user cookies and RLS, not a service-role key.
- **Zapier trigger:** A limited event-based handoff. This v1 does not implement a live Zapier receiver or claim a full HoneyBook connection.
- **Slug:** The URL-friendly lowercase, hyphen-separated version of a post title.
- **Meta description:** A short search-result summary attached to a page.
- **Alt text:** A concise description of a photo for screen readers and accessibility.
- **Theme toggle:** The header control for light/dark mode. First visit uses device preference; afterward localStorage wins, and an authenticated preference can sync through Supabase.

## Reading a component

Start with its props (the values passed in), then its local state, then event handlers. For example, `PhotoPicker` receives `photos` and `onChange`; each textarea updates one description and calls the parent callback. `app/page.tsx` owns that state and sends it only when the user requests a draft. A state update causes React to render the component again with the new value.

## Reading the Claude prompt

`lib/claude.ts` keeps the instruction separate from the JSON-serialized user facts. The user payload is allowlisted to venue, city, date, edit style, palette, music preferences, photo descriptions, and favorite moment. Timeline times and dress code remain in the wedding form/database but are not sent to Claude. The returned object must match the validated schema, and its `altTexts` count must equal the supplied photo count. Extra prose or malformed JSON fails validation, returns a clear API error, and is not shown as a draft.

## Theme system

`app/globals.css` is the source of all component color tokens under `:root[data-theme="light"]` and `:root[data-theme="dark"]`. `app/layout.tsx` reads localStorage before paint and consults the device preference only when no saved choice exists. `ThemeToggle` updates the document and localStorage immediately and, if signed in, syncs the value to `user_preferences`. Its temporary `theme-transitioning` class enables the crossfade.

## Motion, glass surfaces, and step bar

The page and each newly selected step enter with short staggered animations. `lib/motion.ts` supplies typed CSS custom properties for those animation indices. The step navigation sticks near the top while scrolling on desktop and becomes a fixed, safe-area-aware bottom bar on mobile; page padding prevents it from covering content. Translucent sage surfaces, soft highlights, and restrained blur give cards and controls a glass finish without relying on blur support for legibility. The stylesheet disables motion and smooth scrolling when the operating system requests reduced motion.
