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
```

## Current Scope

- Static Vite + TypeScript frontend.
- One bundled artifact in `src/collection.ts`: `黑神话：悟空`.
- The user-provided `public/artifacts/blackMyth.png`, wired into its cover and detail gallery.
- Supabase-backed artifact management for creating, querying, editing, deleting, and uploading cover/detail images through Postgres RPC.
- Built-in artifacts can be edited through cloud override rows keyed by `source_artifact_id`; the original TypeScript entries remain as recoverable defaults and are not duplicated in the gallery.
- Site entry is gated by an access screen. Visitors can click `游客进入` to view the museum; admin users sign in with the custom Supabase-backed admin account table.
- Guest access is read-only; add/edit/delete controls appear only after a custom admin account in `public.museum_admin_accounts` is verified through Supabase RPC.
- Browser-local managed artifacts remain as a read-only fallback when Supabase is unavailable or the schema has not been applied.
- Local GSAP motion system in `src/museum-motion.ts` for ambient background, ordered home/featured/collection route entrances, pre-staged scroll reveal, filter refresh, and detail dialog animation.
- Adaptive Canvas archive-dust atmosphere in `src/museum-canvas.ts`; it pauses when hidden and renders a static low-contrast frame for reduced-motion users.
- Academia/Classical visual system based on dark wood, parchment, brass, crimson wax seals, arch-top covers, and sepia-to-color image treatment.
- No custom Node backend is required. Production deployment remains GitHub Pages.

## Supabase Persistence

The app uses `@supabase/supabase-js` from the browser with a publishable key. Public reads are allowed by RLS; writes are routed through SECURITY DEFINER RPC functions and require a short-lived admin session token. Admin usernames and encrypted password hashes live in `public.museum_admin_accounts`; the frontend never reads password hashes.

Environment variables:

```bash
VITE_SUPABASE_URL=https://wjhktoqihszgdkxbanxu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The publishable key is safe to expose in a static frontend, but database access must be protected by Row Level Security. Never put a Supabase secret key or legacy `service_role` key in this project.

One-time Supabase setup:

1. Run `supabase/migrations/20260706000000_museum_artifact_persistence.sql` in the Supabase SQL Editor or through the Supabase CLI.
2. Run `supabase/migrations/20260706010000_museum_admin_role_lookup.sql` for compatibility with earlier deployments.
3. Run `supabase/migrations/20260707010000_museum_admin_password_accounts.sql`.
4. Run `supabase/migrations/20260710020000_museum_sample_artifact_overrides.sql`.
5. Run `supabase/migrations/20260711010000_remove_legacy_sample_artifacts.sql`.
6. Create or update the admin account in Supabase SQL Editor. Replace `<admin-password>` locally before running; do not commit the filled SQL.

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

The entry screen must be passed before the museum is visible. The `游客进入` path is remembered in the current browser and can view the museum only. The `藏品管理` section supports creating, searching, editing, and deleting user-managed artifacts only for verified admins. In the custom admin flow, uploaded images are stored in `public.artifacts` as data URLs alongside artifact rows.

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
| `src/artifact-store.ts` | Supabase artifact query, admin-login RPC helpers, artifact CRUD RPC, and browser-local fallback |
| `src/main.ts` | Entry gate, access state, rendering, filters, counts, management behavior, and detail dialog |
| `src/museum-motion.ts` | GSAP + ScrollTrigger motion timelines |
| `src/museum-canvas.ts` | Responsive, reduced-motion-aware archive-dust Canvas background |
| `src/styles.css` | Academia/Classical visual system and responsive layout |
| `public/artifacts/` | User-provided `blackMyth.png` used by the remaining bundled artifact |
| `docs/supabase-persistence.md` | Supabase setup, admin, verification, and failure-mode runbook |
| `supabase/migrations/` | Postgres tables, RLS policies, custom admin account/session RPC, built-in artifact overrides, and Storage compatibility policies |
| `scripts/validate-site.mjs` | Dependency-free structural validation |
| `.github/workflows/deploy-pages.yml` | GitHub Pages deployment workflow |
| `docs/superpowers/specs/2026-07-02-personal-digital-museum-design.md` | Design spec |
| `docs/superpowers/specs/2026-07-02-museum-motion-system-design.md` | Motion design spec |
| `docs/superpowers/plans/2026-07-02-museum-motion-system.md` | Motion implementation plan |

## Verification

`npm run lint` checks the project structure, collection categories, required design-system signatures, interaction hooks, responsive CSS, local PNG asset fields, local asset existence, and the GSAP motion module. `npm run build` runs lint, TypeScript checking, and Vite production build.
