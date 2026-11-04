# Re-entry notes

## 2026-11-03: Vendor credits pushed + build plan
- Built: vendor library, per-wedding vendor credits, Instagram collaborators (max 5), and the vendor share kit (7 commits, written Oct 30). Wrote `docs/plan.md`.
- Applied to Supabase: `supabase/migrations/20261031_vendors.sql` must be run in the SQL editor before the vendor screens work.
- Checks: `npm run typecheck` passes; `npm test` 11/11 pass.
- Learned from llenavidamedia.com: WordPress 6.9 blog (likely Showit-hosted); voice is "we" (Sean & Trinity) to "you", playful and offbeat. The current prompt's "her voice, warm, editorial" is wrong.
- Waiting on: Application Password test in their WordPress, writing and speaking samples, one real wedding to test with.
- Understand well enough to explain: (fill in)
- Still fuzzy: (fill in)
- Next step: Phase 1, chunk 1.1 (voice guide storage).

## 2026-11-03: Review fixes (PR #1 review by Copilot)
- Built: vendor saves are now one database transaction (`replace_wedding_vendors`, migration `20261103_vendor_save_fixes.sql`); a failed save changes nothing. Collaborator limit takes a per-wedding lock, so two saves at once can't reach 6.
- Vendor picker stays locked ("Loading…" / "Try again") until the wedding's saved vendors load, so it can't erase them. New vendors are added to the latest selection. Collaborators without a handle can be unchecked. Sign-out clears the post link and credit line.
- WordPress now receives HTML (`lib/markdown-html.ts`), not Markdown. Before this, every WordPress draft showed literal `##` and `**`.
- Vendor share messages use the public `?p=` link (`lib/post-links.ts`), not the WordPress editor link.
- Applied to Supabase: run `20261103_vendor_save_fixes.sql` in the SQL editor. Until then, saving vendors shows an error.
- Tested: `npm test` 19/19; typecheck and build pass; on a local Postgres, `vendors_rls_test.sql` 11/11 and `vendor_save_fixes_test.sql` 10/10; two simultaneous collaborator saves ended at exactly 5.
- Not fixed yet: a wedding's save/delivery/sent response can land on another wedding if you switch weddings mid-request (4 related Copilot findings). One shared fix later.
- Understand well enough to explain: (fill in: what a transaction is, and why "delete then insert" in two requests can lose data)
- Still fuzzy: (fill in)
- Next step: run the migration, then Phase 1 chunk 1.1.
