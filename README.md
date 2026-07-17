# mxren-museum

mxren-museum is a Vite + TypeScript frontend for a personal digital museum. It presents digital artifacts such as games, landscapes, and personal works as a classical private archive with covers, metadata, descriptions, filters, detail views, and Supabase-backed managed artifacts.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run preview
npm run migrate:artifact-images -- --dry-run
```

## Current Scope

- Static Vite + TypeScript frontend.
- One bundled artifact in `src/collection.ts`: `黑神话：悟空`.
- The user-provided `public/artifacts/blackMyth.png`, wired into its cover and detail gallery.
- Supabase-backed artifact management with Postgres metadata and CDN-served images in the public `artifact-images` Storage bucket.
- Built-in artifacts can be edited through cloud override rows keyed by `source_artifact_id`; the original TypeScript entries remain as recoverable defaults and are not duplicated in the gallery.
- Site entry is gated by an access screen. Visitors can click `游客进入` to view the museum; admin users sign in with the custom Supabase-backed admin account table.
- Guest access is read-only; add/edit/delete controls appear only after a custom admin account in `public.museum_admin_accounts` is verified through Supabase RPC.
- Artifacts support `draft`, `published`, and `unlisted` visibility. Drafts are admin-only, published artifacts enter public listings, and unlisted artifacts are available only through their stable link.
- Artifacts support normalized tags and an optional exact date. The collection combines keyword, category, tag, and year filters with catalog/date/update/title sorting.
- Admin deletion is recoverable: ordinary deletion moves an artifact to the trash, where it can be restored or permanently purged after a second confirmation.
- Admins can export a versioned JSON archive containing artifact, category, exhibition, and trash metadata without image binaries, credentials, or session tokens.
- Curated exhibitions are stored independently from artifacts and support draft/published visibility plus an ordered artifact sequence. Public routes are `#exhibitions` and `#exhibition/{id}`.
- Artifact dialogs use GitHub Pages-compatible `#artifact/{id}` deep links with copy-link and native share actions; refreshing a deep link restores the same detail view after entry.
- Browser-local managed artifacts remain as a read-only fallback when Supabase is unavailable or the schema has not been applied.
- Local GSAP motion system in `src/museum-motion.ts` for ambient background, ordered home/featured/collection route entrances, pre-staged scroll reveal, filter refresh, and detail dialog animation.
- Adaptive Canvas archive-dust atmosphere in `src/museum-canvas.ts`; it pauses when hidden and renders a static low-contrast frame for reduced-motion users.
- Academia/Classical visual system based on dark wood, parchment, brass, typography, brass curator marks, arch-top framing, gradient light, and sepia-to-color interaction; category symbols are not rendered over uploaded covers.
- No custom Node backend is required. Production deployment remains GitHub Pages.

## Supabase Persistence

The app uses `@supabase/supabase-js` from the browser with a publishable key. Public Storage images remain readable, while artifact metadata is read through visibility-aware SECURITY DEFINER RPC functions instead of direct anonymous table access. Metadata writes use admin-session RPC functions. Image writes use short-lived signed upload URLs issued by the `artifact-images` Edge Function after it verifies the same custom admin session.

Environment variables:

```bash
VITE_SUPABASE_URL=https://wjhktoqihszgdkxbanxu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The publishable key is safe to expose in a static frontend. A Service Role key is used only as an Edge Function runtime secret and as a local environment variable for the migration script; it must never enter the browser bundle, committed files, command output, or documentation.

One-time Supabase setup:

1. Run `supabase/migrations/20260706000000_museum_artifact_persistence.sql` in the Supabase SQL Editor or through the Supabase CLI.
2. Run `supabase/migrations/20260706010000_museum_admin_role_lookup.sql` for compatibility with earlier deployments.
3. Run `supabase/migrations/20260707010000_museum_admin_password_accounts.sql`.
4. Run `supabase/migrations/20260710020000_museum_sample_artifact_overrides.sql`.
5. Run `supabase/migrations/20260711010000_remove_legacy_sample_artifacts.sql`.
6. Run `supabase/migrations/20260713010000_artifact_storage_images.sql`.
7. Run `supabase/migrations/20260714010000_allow_jpeg_storage_variants.sql`.
8. Run `supabase/migrations/20260714020000_museum_categories.sql`.
9. Run `supabase/migrations/20260715010000_artifact_visibility_and_sharing.sql`.
10. Run `supabase/migrations/20260716010000_catalog_trash_and_exhibitions.sql`.
11. Run `supabase/migrations/20260717010000_import_history_and_bulk.sql` to enable transactional JSON restore, revision history, and batch artifact actions.
12. Deploy `artifact-images` with JWT verification disabled: `supabase functions deploy artifact-images --no-verify-jwt`.
13. Create or update the admin account in Supabase SQL Editor. Replace `<admin-password>` locally before running; do not commit the filled SQL.

Example admin account insert:

```sql
set search_path = public, extensions;

insert into public.museum_admin_accounts (username, password_hash, display_name, is_active)
values ('admin', crypt('<admin-password>', gen_salt('bf', 12)), '默认管理员', true)
on conflict (username) do update
set
  password_hash = excluded.password_hash,
  display_name = excluded.display_name,
  is_active = true,
  updated_at = now();
```

Do not store a filled admin password, `sb_secret_...`, or legacy `service_role` key in the frontend, docs, or knowledge base.

## Browser-Local Management

The entry screen must be passed before the museum is visible. The `游客进入` path is remembered in the current browser and can view the museum only. The `藏品管理` section supports creating, searching, editing, deleting, batch updates, revision restore, and validated JSON backup recovery only for verified admins. JSON restore performs client validation, a server dry run, an automatic pre-import backup, and one transactional write. Artifact and exhibition forms keep local drafts and guard navigation or refresh while unsaved. Exhibition editing includes search, drag/keyboard ordering, missing-reference warnings, and a live dossier preview. Image previews use temporary object URLs; uploads are optimized to WebP where supported, with an automatic JPEG fallback for browsers that cannot encode WebP, and sent directly to Supabase Storage. Public covers use responsive thumbnail/display sources with lazy loading and priority for the first visible image. Gallery files share one signed-upload request, upload as a batch, and roll back together on failure. Detail images open in a full-size keyboard-accessible lightbox. Postgres stores paths and text metadata, not new Base64 payloads.

If Supabase is not configured or the remote schema is unavailable, the app falls back to reading browser-local managed artifacts. This fallback is limited to the current browser profile and does not sync across devices, users, or browsers. New writes stay disabled until admin access can be verified through Supabase.

## Remote And Deployment

- GitHub repository: https://github.com/mrx-data/mxren-museum
- GitHub Pages site: https://mrx-data.github.io/mxren-museum/
- Deployment workflow: `.github/workflows/deploy-pages.yml`
- Deployment trigger: pushes to `main`
- GitHub Pages still serves static assets only; Supabase provides the runtime database, auth, and file storage layer.

## Project Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Semantic shell and museum sections |
| `src/collection.ts` | Shared artifact types and the single bundled `黑神话：悟空` artifact |
| `src/supabase-client.ts` | Supabase client and publishable-key configuration |
| `src/artifact-store.ts` | Supabase artifact query, tag/date normalization, sorting, admin-login RPC helpers, trash lifecycle, and browser-local fallback |
| `src/artifact-images.ts` | Browser image validation, WebP variants, signed uploads, public URLs, and cleanup |
| `src/exhibition-store.ts` | Public/admin exhibition reads, session-protected saves/deletes, and local read fallback |
| `src/museum-export.ts` | Versioned metadata-only JSON export and browser download helper |
| `src/main.ts` | Entry gate, catalog facets/sorting, exhibitions, trash/export management, and detail dialog |
| `src/museum-motion.ts` | GSAP + ScrollTrigger motion timelines |
| `src/museum-canvas.ts` | Responsive, reduced-motion-aware archive-dust Canvas background |
| `src/styles.css` | Academia/Classical visual system and responsive layout |
| `public/artifacts/` | User-provided `blackMyth.png` used by the remaining bundled artifact |
| `docs/supabase-persistence.md` | Supabase setup, admin, verification, and failure-mode runbook |
| `supabase/migrations/` | Postgres tables, RLS/RPC boundaries, custom admin sessions, catalog metadata, trash, exhibitions, and Storage policies |
| `supabase/functions/artifact-images/` | Custom-session verification and signed Storage upload/delete operations |
| `scripts/migrate-artifact-images.mjs` | Dry-run, migration, verification, and Base64 cleanup utility |
| `scripts/validate-site.mjs` | Dependency-free structural validation |
| `.github/workflows/deploy-pages.yml` | GitHub Pages deployment workflow |
| `docs/superpowers/specs/2026-07-02-personal-digital-museum-design.md` | Design spec |
| `docs/superpowers/specs/2026-07-02-museum-motion-system-design.md` | Motion design spec |
| `docs/superpowers/plans/2026-07-02-museum-motion-system.md` | Motion implementation plan |

## Verification

`npm run lint` checks the project structure, collection categories, required design-system signatures, interaction hooks, responsive CSS, local PNG asset fields, local asset existence, and the GSAP motion module. `npm run build` runs lint, TypeScript checking, and Vite production build.
