# Gathered Stories

A four-step, draft-only workspace for turning wedding details and photo notes into a venue blog post, a short-form video script, and a ShowIt copy pack.

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` on your own machine and fill in the values there. Never paste secrets into chat or put them in committed files.
4. Create a Supabase project. For a new project, run [`supabase/schema.sql`](./supabase/schema.sql). For an existing installation, apply the additive migration [`supabase/migrations/20261030_v2_foundation.sql`](./supabase/migrations/20261030_v2_foundation.sql) after your current schema.
5. In Supabase Auth, enable email sign-in and set the local callback URL (for example `http://localhost:3000`) in the allowed redirect URLs.
6. Put the Supabase project URL and anon key in `.env.local`. Add an Anthropic API key there for actual server-side draft generation. To enable WordPress draft delivery, add the Supabase service-role key and a 32-byte encryption key encoded as base64 (generate one locally with `openssl rand -base64 32`).
7. Start the app with `npm run dev`, then open `http://localhost:3000`.

AI and integration credentials are read only by server-side code and are never exposed as `NEXT_PUBLIC_` variables. The browser sends the allowed wedding fields, photo descriptions, and favorite moment to the same-origin API. It does not upload photo files or send the raw pasted questionnaire.

## Use the workflow

The Wedding step starts blank. Sign in with the email link to autosave and resume weddings. Add descriptions for 10–20 photos and a favorite moment, then click **Write draft**. Claude returns validated JSON, which is saved as a draft. Edit or regenerate it before confirming the approval checkbox and choosing **Approve draft**. Approval only marks the draft; the final step provides a **Copy all** option and individual fields for manual ShowIt entry.

The Claude request includes only venue, city, date, style, palette, music preferences, photo descriptions, the photographer's favorite moment, and optional inspiration. Times and dress code remain available in the form but are not sent to the model. Email addresses and phone numbers in free-text are rejected before the AI call; do not include names or other personal details in free-text fields. If enabled, prior approved work is reduced locally to aggregate style cues; the original draft text is never sent as an example.

HoneyBook has no public API. The paste/import control reads only recognized JSON or labeled fields in the browser, discards unrecognized fields, then clears the pasted input. It is not a HoneyBook sync. Optional WordPress delivery verifies a public HTTPS site, uses encrypted application-password storage, and always creates a WordPress draft; it never publishes automatically. The app does not fetch WordPress posts or leads. Marking a post live and recording an inquiry are manual summary actions. Zapier event triggers and Aisle Planner imports are future/limited entry paths, not full integrations. Stripe is not wired up; there are no live payments.

## Environment variables

| Variable | Where used | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Server only | Required for Claude draft generation. Never add a `NEXT_PUBLIC_` prefix. |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server | Public anon key; database access is guarded by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Enables access to server-only WordPress integration tables. Never expose it to the browser. |
| `WORDPRESS_ENCRYPTION_KEY` | Server only | Base64-encoded 32-byte AES-256-GCM key used to encrypt WordPress application passwords. Back it up securely; rotating it requires reconnecting WordPress. |

For Vercel, add the same variables under **Project Settings → Environment Variables**. Put the Anthropic key in the server environment only. Add the deployed site URL to Supabase Auth's allowed redirect URLs, then deploy using the standard Next.js Vercel preset.

## Useful commands

- `npm run dev` — local development server
- `npm run typecheck` — TypeScript validation
- `npm run build` — production build

For a map of the code and data flow, see [`CODE_TOUR.md`](./CODE_TOUR.md). For symptom-based troubleshooting, see [`DEBUGGING_GUIDE.md`](./DEBUGGING_GUIDE.md).
