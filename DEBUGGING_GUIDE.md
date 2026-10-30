# Debugging guide

Use non-sensitive test details only. Never paste API keys, passwords, client names, family shot lists, planner contacts, or raw questionnaires into code, logs, or a help request.

## Start here by symptom

- **A button does nothing:** Open browser developer tools → Console, then Network. Check whether the expected same-origin request fired (`/api/weddings`, `/api/generate-post`, or `/api/drafts/...`), its status code, and its JSON error. A 401 means sign-in is missing or expired.
- **The draft is blank or broken:** Check the VS Code terminal during local development or Vercel function logs in deployment. The route logs a generic error category only. Confirm that Claude returned one JSON object with all required fields and one alt text per photo. Invalid JSON is rejected rather than displayed or saved.
- **"Unauthorized" or wedding not found:** Confirm the email link completed and the Supabase session is active. Check `supabase/schema.sql` is applied and RLS is enabled. The user's wedding and draft must be owned by the same `auth.uid()`.
- **ShowIt pack looks wrong:** Inspect `lib/showit.ts` and the draft values in Step 3. Headings are extracted from markdown heading lines; the rest of the body is copied unchanged.
- **Text is hard to read or theme does not persist:** Inspect the two CSS token blocks in `app/globals.css`. Confirm `data-theme` on the root element and `wedding-story-theme` in localStorage. Check the user preference in `user_preferences` only when signed in. All controls should use explicit theme tokens.
- **Theme sync fails:** Local device persistence remains available. Check Supabase Auth, the `user_preferences` table/policies, and the Network response for `/api/preferences/theme`.
- **Animations do not play:** Check the operating system's Reduce Motion setting; it intentionally disables transitions and animation. Verify the element has not been given a persistent animation fill mode that overrides its interactive styles.
- **Step bar scrolls away or covers content:** Above 760px it sticks near the top while scrolling; at widths up to 760px it is fixed to the bottom, above the safe-area inset. Check that no ancestor of `.step-nav` has a `transform`, which would change the containing block for fixed positioning, and confirm `.app-shell` retains its mobile bottom padding.
- **Glass panels look too opaque or blurry:** Blur is an enhancement only in browsers with `backdrop-filter` support. The theme-specific surface colors remain readable without it; check the `--glass-*` tokens in `app/globals.css` before changing opacity.
- **Paste/import doesn't fill a value:** The box expects a JSON object with recognized keys such as `venue`, `city`, `weddingDate`, `ceremonyTime`, `palette`, and `musicLoved`. It ignores unknown keys and clears itself after a successful import; it is not a full HoneyBook sync.
- **Copy button fails on mobile:** Clipboard access requires a secure context and browser permission. Select the field text and use the device's copy command as a fallback.
- **Wedding changes do not resume:** Confirm sign-in, Supabase setup, and that the v2 migration is applied. The header autosave status distinguishes unsynced work, saving, saved, and failed states.
- **WordPress connection fails:** Confirm `SUPABASE_SERVICE_ROLE_KEY`, a base64-encoded 32-byte `WORDPRESS_ENCRYPTION_KEY`, and the v2 migration. The site must use public HTTPS, resolve only to public IP addresses, and accept a WordPress application password.
- **A WordPress draft send reports an uncertain result:** A timed-out external request keeps a short delivery reservation to avoid duplicate posts. Check WordPress and the wedding list before trying again.

## Safe debugging steps

1. Reproduce the issue with safe, non-client test values.
2. Read the browser or server error literally; note its status code.
3. Find the named file in [`CODE_TOUR.md`](./CODE_TOUR.md).
4. Check the inputs and output shape at that boundary.
5. Fix one cause, then retry with safe test details in both themes.

Temporary `console.log` statements may include status codes or non-sensitive identifiers, but never log an API key, password, email, questionnaire blob, client name, or personal details. Remove temporary logs before committing. The app's server error logging intentionally records error categories/codes, not prompts or secrets.

## Isolated checks

- **API route:** Sign in with a Supabase test account, then use safe test details. Confirm the network request targets `/api/generate-post`; the browser should not call Anthropic directly.
- **UI:** Use a fictional draft object in local component work. Never use a real client's wedding data as a fixture.
- **RLS:** Use two separate Supabase test users. A wedding or draft created by one must not be readable or writable by the other.
- **Theme:** Toggle light/dark, reload, and confirm the explicit selection stays. Also test a first visit with the device dark preference and a first visit with device light preference.

## Common-bugs checklist

- Missing `.env.local` or incorrect variable names.
- Anthropic key incorrectly exposed with a `NEXT_PUBLIC_` prefix.
- Supabase schema or RLS policies not applied.
- User not signed in, or magic-link redirect URL not allowed in Supabase.
- Invalid JSON or the wrong number of alt texts from Claude.
- RLS correctly blocking a row owned by a different test account.
- HoneyBook/Zapier expectations exceeding this v1's manual/limited import path.
- Clipboard permission unavailable on a mobile browser.
- Theme preference not persisted locally or not synced for an authenticated user.
- A new component using inherited browser colors instead of explicit theme tokens.

## Asking for help

Include the error message, file name, approximate line, what you clicked, what you expected, and the response status code. Do not include API keys, passwords, real client data, or raw questionnaires.
