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
- Local sample collection data in `src/collection.ts`.
- Generated local PNG artifact assets in `public/artifacts`, wired into cover cards and detail gallery strips.
- Supabase-backed artifact management for creating, querying, editing, deleting, and uploading cover/detail images through Postgres + Storage.
- Site entry is gated by an access screen. Visitors can click `游客进入` to view the museum; admin users sign in with Supabase Auth.
- Guest access is read-only; add/edit/delete controls appear only after an admin Supabase account is verified through `public.museum_admins`.
- Browser-local managed artifacts remain as a read-only fallback when Supabase is unavailable or the schema has not been applied.
- Local GSAP motion system in `src/museum-motion.ts` for ambient background, opening, scroll reveal, filter refresh, and detail dialog animation.
- Academia/Classical visual system based on dark wood, parchment, brass, crimson wax seals, arch-top covers, and sepia-to-color image treatment.
- No custom Node backend is required. Production deployment remains GitHub Pages.

## Supabase Persistence

The app uses `@supabase/supabase-js` from the browser with a publishable key. Public reads are allowed by RLS; writes require a signed-in Supabase user who is also listed in `public.museum_admins`. A signed-in user missing from `museum_admins` stays in read-only visitor mode.

Environment variables:

```bash
VITE_SUPABASE_URL=https://wjhktoqihszgdkxbanxu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The publishable key is safe to expose in a static frontend, but database access must be protected by Row Level Security. Never put a Supabase secret key or legacy `service_role` key in this project.

One-time Supabase setup:

1. Run `supabase/migrations/20260706000000_museum_artifact_persistence.sql` in the Supabase SQL Editor or through the Supabase CLI.
2. Run `supabase/migrations/20260706010000_museum_admin_role_lookup.sql`.
3. Create or invite the admin user in Supabase Auth from the Dashboard.
4. Insert that user ID into `public.museum_admins`.
5. Confirm the `artifact-images` Storage bucket exists and is public-readable.

Example admin role insert:

```sql
insert into public.museum_admins (user_id)
values ('<admin-user-uuid>')
on conflict (user_id) do nothing;
```

Admin accounts are created in the Supabase Dashboard, not in this repository. Do not store an admin password, `sb_secret_...`, or legacy `service_role` key in the frontend, docs, or knowledge base.

## Browser-Local Management

The entry screen must be passed before the museum is visible. The `游客进入` path is remembered in the current browser and can view the museum only. The `藏品管理` section supports creating, searching, editing, and deleting user-managed artifacts only for verified admins. When Supabase is available, uploaded images go to the `artifact-images` bucket and artifact rows go to `public.artifacts`.

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
| `src/collection.ts` | Typed sample artifact data |
| `src/supabase-client.ts` | Supabase client and publishable-key configuration |
| `src/artifact-store.ts` | Supabase artifact CRUD, auth helpers, Storage upload, query, and browser-local fallback |
| `src/main.ts` | Entry gate, access state, rendering, filters, counts, management behavior, and detail dialog |
| `src/museum-motion.ts` | GSAP + ScrollTrigger motion timelines |
| `src/styles.css` | Academia/Classical visual system and responsive layout |
| `public/artifacts/` | Generated local PNG placeholder covers and detail images |
| `docs/supabase-persistence.md` | Supabase setup, admin, verification, and failure-mode runbook |
| `supabase/migrations/` | Postgres tables, RLS policies, and Storage bucket policies |
| `scripts/validate-site.mjs` | Dependency-free structural validation |
| `.github/workflows/deploy-pages.yml` | GitHub Pages deployment workflow |
| `docs/superpowers/specs/2026-07-02-personal-digital-museum-design.md` | Design spec |
| `docs/superpowers/specs/2026-07-02-museum-motion-system-design.md` | Motion design spec |
| `docs/superpowers/plans/2026-07-02-museum-motion-system.md` | Motion implementation plan |

## Verification

`npm run lint` checks the project structure, collection categories, required design-system signatures, interaction hooks, responsive CSS, local PNG asset fields, local asset existence, and the GSAP motion module. `npm run build` runs lint, TypeScript checking, and Vite production build.
