# mxren-museum Agent Notes

## Project Snapshot

- Project name: mxren-museum
- Code path: `/Users/echo/Documents/work_develop/mxren-museum`
- Current mode: static frontend application
- Product goal: a personal digital museum for collectible games, landscapes, and personal works
- Tech stack: Vite 8.1.3, TypeScript, HTML, CSS, GSAP 3.15.0, Node.js validation script
- Package manager: npm with `package-lock.json`
- Asset mode: generated local PNG placeholders under `public/artifacts`
- Local management mode: browser-local artifact CRUD/search/upload stored in the current browser profile
- GitHub repository: `https://github.com/mrx-data/mxren-museum`
- Production site: `https://mrx-data.github.io/mxren-museum/`
- Deployment mode: GitHub Pages through `.github/workflows/deploy-pages.yml`
- Echo Link KB project entry: `/Users/echo/Documents/obsidian-data/echo-link-kb/wiki/projects/mxren-museum/项目首页.md`
- Codebase index: `/Users/echo/Documents/obsidian-data/echo-link-kb/sources/code/codebase-index.md`

The current version is intentionally frontend-only. It uses local sample artifact data plus browser-local user-managed artifacts. It does not include a backend, login, server upload flow, database, or cloud storage. Production deployment is GitHub Pages.

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

No environment variables are required.

Rules:

- Never read, print, copy, or store real secret values from `.env*`, credentials, tokens, cookies, or API key files.
- If environment variables become necessary later, document variable names and purposes only.
- Keep any local `.env*` files out of the knowledge base.

## Important Implementation Details

- `index.html` contains the semantic shell, font links, major museum sections, and dialog container.
- `src/collection.ts` owns typed sample artifact data, cover image paths, and three detail gallery image paths per artifact. Replace or expand real collection entries here first.
- `src/artifact-store.ts` owns browser-local artifact CRUD, query, and persistence helpers. It stores uploaded image data URLs under `mxren-museum.local-artifacts.v1` in the current browser profile.
- `src/main.ts` renders featured artifacts, filters, collection cards, counts, local PNG cover images, browser-local managed artifacts, management form behavior, and the detail dialog gallery. It calls the motion module after initial render, filter refresh, and dialog operations.
- `src/museum-motion.ts` owns the local GSAP + ScrollTrigger motion system: ambient background, opening timeline, scroll reveal, filter refresh, wax-seal loop, desktop-light parallax, and dialog open/close animation.
- `src/styles.css` owns the Academia/Classical design system: dark mahogany, aged oak, parchment text, polished brass interactions, crimson wax seals, arch-top covers, sepia-to-color transitions, paper texture, vignette, ornate dividers, and responsive layout.
- `.github/workflows/deploy-pages.yml` runs `npm ci`, `npm run build`, uploads `dist`, and deploys to GitHub Pages.
- `public/artifacts/` contains 36 generated local PNG placeholder assets: 1 cover and 3 detail images for each of the 9 sample artifacts.
- `scripts/validate-site.mjs` is a dependency-free structural gate. It checks required local PNG fields, file existence, GSAP dependency, motion hooks, and the motion module; update it when new required UI patterns or commands are added.
- The current images are generated placeholders, not user-provided final素材. When real images are added, preserve alt text, arch-top treatment, and the sepia-to-color interaction.
- Motion must preserve `prefers-reduced-motion: reduce`, keep mobile motion light, and avoid replacing the native `<dialog>` accessibility behavior.

## Editing Guidelines

- Keep data, rendering, and styling separate.
- Prefer small, reviewable changes with clear verification evidence.
- Maintain the Academia/Classical design language unless the KB project pages record a new visual decision.
- Do not introduce backend services, additional external SDKs, upload flows, or storage without a technical decision first.
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
- All 9 collection artifacts render and their local cover PNGs load after scroll.
- Category filters update visible cards and `aria-pressed`.
- Artifact detail dialog opens and closes with Escape.
- Artifact detail dialog includes cover, ledger metadata, introduction, a three-image strip with loaded local PNGs, and visible motion-ledger items.
- 390px mobile viewport has no horizontal overflow.
- Production URL returns HTTP 200, and deployed JS/CSS/PNG assets return HTTP 200.
- Browser-local management: create an artifact with description, cover upload, and detail uploads; search it; edit it; delete it; reload and confirm expected current-browser persistence.

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
- Do not describe browser-local uploaded images as cloud uploads. They are data URLs stored in the current browser profile and do not sync across devices.
- Do not treat missing browser smoke tests as a complete UI verification pass.
- Do not overwrite user files or discard uncommitted changes.
