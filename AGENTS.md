# mxren-museum Agent Notes

## Project Snapshot

- Project name: mxren-museum
- Code path: `/Users/echo/Documents/work_develop/mxren-museum`
- Current mode: static frontend application with full-site entry gate and Supabase persistence
- Product goal: a personal digital museum for collectible games, landscapes, and personal works
- Tech stack: Vite 8.1.3, TypeScript, HTML, CSS, GSAP 3.15.0, Node.js validation script
- Package manager: npm with `package-lock.json`
- Asset mode: one user-provided `public/artifacts/blackMyth.png`; no generated placeholder set remains
- Remote management mode: custom Supabase admin account table + Postgres RPC for user-managed artifacts
- Local fallback mode: browser-local managed artifacts can be read from the current browser profile if Supabase is unavailable; new writes stay disabled unless Supabase admin access is verified
- GitHub repository: `https://github.com/mrx-data/mxren-museum`
- Production site: `https://mrx-data.github.io/mxren-museum/`
- Deployment mode: GitHub Pages through `.github/workflows/deploy-pages.yml`
- Echo Link KB project entry: `/Users/echo/Documents/obsidian-data/echo-link-kb/wiki/projects/mxren-museum/项目首页.md`
- Codebase index: `/Users/echo/Documents/obsidian-data/echo-link-kb/sources/code/codebase-index.md`

The current version is still served as a static frontend, but the museum is hidden behind a full-site entry gate before any content is visible. Visitors enter with the `游客进入` button and stay read-only in the current browser; admins sign in with the custom `public.museum_admin_accounts` username/password table and only receive add/edit/delete access after a database RPC returns a valid short-lived admin session token. It keeps `黑神话：悟空` as the only bundled artifact and combines it with Supabase-managed artifacts, with browser-local read fallback. It does not include a custom Node backend or server-side secret handling. Production deployment is GitHub Pages.

## Commands

| Purpose | Command | Notes |
| --- | --- | --- |
| Install | `npm install` | Installs Vite and TypeScript dev dependencies |
| Dev server | `npm run dev` | Starts Vite at `http://127.0.0.1:4173/` by default |
| Preview | `npm run preview` | Previews the production build at `http://127.0.0.1:4174/` |
| Lint / structure gate | `npm run lint` | Runs `scripts/validate-site.mjs` |
| Typecheck | `npm run typecheck` | Runs `tsc --noEmit` |
| Build | `npm run build` | Runs lint, typecheck, and Vite production build |
| Dependency audit | `npm audit --audit-level=moderate` | Checks moderate-or-higher dependency vulnerabilities |
| Deploy | `git push origin main` | Triggers GitHub Pages workflow after local checks pass |

## Environment Variables

Supabase browser client variables:

| Variable | Purpose | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL | Public frontend value |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | Public frontend key; never replace with a secret key |

Rules:

- Never read, print, copy, or store real secret values from `.env*`, credentials, tokens, cookies, or API key files.
- Supabase publishable keys can be bundled in static frontend code, but all writes must be protected by RLS.
- Never use a Supabase secret key or legacy `service_role` key in browser code, docs, examples, or GitHub Pages.
- Keep any local `.env*` files out of the knowledge base.

## Important Implementation Details

- `index.html` contains the entry gate, semantic shell, font links, major museum sections, management panel, and dialog container.
- `src/collection.ts` owns shared artifact types and the single bundled `黑神话：悟空` entry. New collection content should normally be created through Supabase management rather than added as bundled samples.
- `src/supabase-client.ts` owns Supabase client configuration. It reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, with the current project URL/publishable key as browser-safe defaults.
- `src/artifact-store.ts` owns Supabase artifact queries, custom admin login/session helpers, artifact CRUD RPC calls, query helpers, and the browser-local fallback under `mxren-museum.local-artifacts.v1`.
- `src/main.ts` renders the entry gate, hero poster stage, featured artifacts, category index, filters, collection cards, counts, local PNG cover images, managed artifacts from Supabase or local fallback, locked/guest/admin access state, management form behavior, and the detail dialog gallery. It calls the motion module after initial render, filter refresh, and dialog operations.
- `src/museum-motion.ts` owns the local GSAP + ScrollTrigger motion system: ambient background, ordered route entrance, opening timeline, scroll reveal, filter refresh, brass curator-mark breathing loop, desktop-light parallax, and dialog open/close animation. Home/featured/collection transitions must establish their initial hidden state before paint, then reveal heading copy, controls, and cards in that order. Scroll-triggered sections must also be pre-staged before entering the viewport, never hidden from an already-visible state.
- `src/museum-canvas.ts` owns the responsive archive-dust Canvas background. Keep its particle count capped, pause it while the document is hidden, and preserve the static reduced-motion fallback.
- `src/styles.css` owns the Academia/Classical design system: dark mahogany, aged oak, parchment text, polished brass interactions, paper texture, vignette, ornate dividers, brass curator marks, arch-top framing, gradient light, sepia interaction, and responsive layout. Red wax/star seals and category symbols must remain absent from uploaded covers.
- The poster exhibition mode is intentional: preserve `#hero-stage-gallery`, `#category-index`, numbered poster cards, and the `No.xxx / 细赏` browsing language unless a new design decision replaces it.
- `.github/workflows/deploy-pages.yml` runs `npm ci`, `npm run build`, uploads `dist`, and deploys to GitHub Pages.
- `supabase/migrations/20260706000000_museum_artifact_persistence.sql` creates `public.artifacts`, `public.museum_admins`, RLS policies, the public-readable `artifact-images` bucket, and Storage object policies. Apply it in Supabase before expecting cloud writes.
- `supabase/migrations/20260706010000_museum_admin_role_lookup.sql` grants authenticated users the RLS-limited ability to check whether their own user ID exists in `public.museum_admins`.
- `supabase/migrations/20260707010000_museum_admin_password_accounts.sql` creates `public.museum_admin_accounts`, hashed admin sessions, password-login RPC, and artifact CRUD RPC for the current custom admin flow.
- `supabase/migrations/20260710020000_museum_sample_artifact_overrides.sql` adds unique `source_artifact_id` overrides so admins can edit built-in artifacts without duplicating cards; deleting an override restores the TypeScript default.
- `supabase/migrations/20260711010000_remove_legacy_sample_artifacts.sql` deletes cloud override rows for removed sample IDs while preserving `black-myth-wukong`.
- To allow writes, create an admin row in `public.museum_admin_accounts` from Supabase SQL Editor after setting `search_path = public, extensions`, then use `crypt('<admin-password>', gen_salt('bf', 12))`. Do not commit filled password SQL, `sb_secret_...`, or legacy `service_role` keys. Public reads are allowed; writes go through admin-session RPC.
- `public/artifacts/` contains only the user-provided `blackMyth.png`; the generated placeholder assets for the removed samples were deleted.
- `scripts/validate-site.mjs` is a dependency-free structural gate. It checks required local PNG fields, file existence, GSAP dependency, motion hooks, and the motion module; update it when new required UI patterns or commands are added.
- `blackMyth.png` is the current bundled final asset. When managed images are added, preserve alt text and the shared curator-mark/arch/light/sepia treatment, but do not render red wax/star seals or category symbols over the image.
- Motion must preserve `prefers-reduced-motion: reduce`, keep mobile motion light, avoid route-transition flash/jump, and avoid replacing the native `<dialog>` accessibility behavior.

## Editing Guidelines

- Keep data, rendering, and styling separate.
- Prefer small, reviewable changes with clear verification evidence.
- Maintain the Academia/Classical design language unless the KB project pages record a new visual decision.
- Do not introduce additional backend services, external SDKs, upload flows, or storage without a technical decision first. Supabase is the accepted persistence layer for this project.
- Add concise comments only where they clarify non-obvious behavior.
- Preserve user-created files and local changes. Do not overwrite existing content without reading and merging.

## Verification

Before claiming work is complete, run the relevant commands and record evidence.

Default full verification:

```bash
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

For frontend/UI changes, also start the dev server and do a browser smoke test:

```bash
npm run dev -- --port 4173
```

Minimum browser checks:

- Page loads at `http://127.0.0.1:4173/`.
- No Vite error overlay.
- H1 `私人数字藏馆` renders.
- `document.documentElement` has `motion-ready`, and `[data-motion-ambient]` exists.
- Section/card scroll reveal reaches a visible end state.
- All static collection artifacts render and their local cover PNGs load after scroll.
- Entry gate path: clear `mxren-museum.access-mode.v1`, open the site, confirm only the gate is visible and the museum shell is inert.
- Guest path: choose `游客进入`, confirm the app stays read-only after refresh and no create/edit/delete controls are exposed.
- Switch identity path: choose `切换身份` or admin sign-out, confirm the gate returns and guest local state is cleared.
- Supabase fallback: when the remote schema is unavailable, the app keeps rendering managed data in read-only mode and reports that cloud access is unavailable.
- Supabase invalid-admin path: log in with an unknown username or wrong password, confirm the app stays locked/read-only and no create/edit/delete controls are exposed.
- Supabase admin path: after applying all migrations and inserting a `museum_admin_accounts` row, log in as that account, create/edit/delete a managed artifact, edit one built-in artifact into a `source_artifact_id` override, and confirm the gallery still shows one card for that ID.
- Category filters update visible cards and `aria-pressed`.
- Artifact detail dialog opens and closes with Escape.
- Artifact detail dialog includes cover, ledger metadata, introduction, a three-image strip with loaded local PNGs, and visible motion-ledger items.
- 390px mobile viewport has no horizontal overflow.
- Production URL returns HTTP 200, and deployed JS/CSS/PNG assets return HTTP 200.
- Browser-local fallback: when Supabase is unavailable, confirm previously stored browser-local managed artifacts can still render, but new writes remain disabled for guests/non-admin users.

## Knowledge Write-Back

Write important project knowledge back to Echo Link KB:

- Product scope and requirements: `/Users/echo/Documents/obsidian-data/echo-link-kb/wiki/projects/mxren-museum/需求说明.md`
- Technical architecture and tradeoffs: `/Users/echo/Documents/obsidian-data/echo-link-kb/wiki/projects/mxren-museum/技术方案.md`
- Task status and milestones: `/Users/echo/Documents/obsidian-data/echo-link-kb/wiki/projects/mxren-museum/任务拆解.md`
- Architecture decisions: `/Users/echo/Documents/obsidian-data/echo-link-kb/wiki/projects/mxren-museum/决策记录.md`
- Validation commands, results, and gaps: `/Users/echo/Documents/obsidian-data/echo-link-kb/wiki/projects/mxren-museum/测试与验收.md`
- Bugs, lessons, and reusable patterns: `/Users/echo/Documents/obsidian-data/echo-link-kb/wiki/projects/mxren-museum/复盘.md`
- Repository command/path changes: `/Users/echo/Documents/obsidian-data/echo-link-kb/sources/code/codebase-index.md`
- Source summary: `/Users/echo/Documents/obsidian-data/echo-link-kb/wiki/sources/mxren-museum 代码仓项目概览.md`

When a command, stack choice, directory structure, or safety boundary changes, update both this file and the KB.

## Do Not

- Do not read or expose real secrets from `.env*`, credential files, tokens, cookies, or API key stores.
- Do not run production deploys, database migrations, seed scripts, or destructive git commands unless the user explicitly asks.
- Do not initialize external services, cloud resources, CI, or remote repositories without confirmation.
- Do not add backend, upload, account, database, or storage features without first updating the requirements and technical solution.
- Do not describe browser-local uploaded images as cloud uploads. They are data URLs stored in the current browser profile and do not sync across devices. The current UI does not allow new browser-local writes unless a future technical decision changes the admin fallback policy.
- Do not treat missing browser smoke tests as a complete UI verification pass.
- Do not overwrite user files or discard uncommitted changes.
