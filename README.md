# mxren-museum

mxren-museum is a first-version static frontend for a personal digital museum. It presents digital artifacts such as games, landscapes, and personal works as a classical private archive with covers, metadata, descriptions, filters, and detail views.

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
- Browser-local artifact management for creating, querying, editing, deleting, and uploading cover/detail images in the current browser.
- Local GSAP motion system in `src/museum-motion.ts` for ambient background, opening, scroll reveal, filter refresh, and detail dialog animation.
- Academia/Classical visual system based on dark wood, parchment, brass, crimson wax seals, arch-top covers, and sepia-to-color image treatment.
- No backend, login, server upload flow, database, or secret handling. Production deployment is GitHub Pages.

## Browser-Local Management

The `藏品管理` section supports creating, searching, editing, and deleting user-managed artifacts. Cover images and detail images are uploaded with native browser file inputs, read as local data URLs, and persisted with the artifact data in browser-local storage.

This browser-local storage is limited to the current browser profile. It does not sync across devices, users, or browsers.

## Remote And Deployment

- GitHub repository: https://github.com/mrx-data/mxren-museum
- GitHub Pages site: https://mrx-data.github.io/mxren-museum/
- Deployment workflow: `.github/workflows/deploy-pages.yml`
- Deployment trigger: pushes to `main`

## Project Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Semantic shell and museum sections |
| `src/collection.ts` | Typed sample artifact data |
| `src/artifact-store.ts` | Browser-local artifact CRUD, query, and persistence helpers |
| `src/main.ts` | Rendering, filters, counts, and detail dialog |
| `src/museum-motion.ts` | GSAP + ScrollTrigger motion timelines |
| `src/styles.css` | Academia/Classical visual system and responsive layout |
| `public/artifacts/` | Generated local PNG placeholder covers and detail images |
| `scripts/validate-site.mjs` | Dependency-free structural validation |
| `.github/workflows/deploy-pages.yml` | GitHub Pages deployment workflow |
| `docs/superpowers/specs/2026-07-02-personal-digital-museum-design.md` | Design spec |
| `docs/superpowers/specs/2026-07-02-museum-motion-system-design.md` | Motion design spec |
| `docs/superpowers/plans/2026-07-02-museum-motion-system.md` | Motion implementation plan |

## Verification

`npm run lint` checks the project structure, collection categories, required design-system signatures, interaction hooks, responsive CSS, local PNG asset fields, local asset existence, and the GSAP motion module. `npm run build` runs lint, TypeScript checking, and Vite production build.
