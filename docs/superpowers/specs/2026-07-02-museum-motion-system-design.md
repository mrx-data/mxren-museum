# Museum Motion System Design

## Goal

Upgrade `mxren-museum` with slow, smooth, high-end motion that feels like a private curator opening an archive at night. The motion should make the background, operations, and artifact display feel more alive without turning the museum into a flashy demo page.

## Chosen Direction

Use the "curatorial slow cinema" direction:

- Background motion is ambient and very slow.
- Interface operations feel tactile and brass-instrument precise.
- Artifact display uses stagger, reveal, and subtle depth.
- The detail dialog opens like a cabinet drawer or glass case, not like a generic modal.

The user selected the local GSAP route, so the implementation may add npm `gsap` and `ScrollTrigger`. The dependency must be bundled locally by Vite; no CDN or external runtime scripts are allowed.

## Reference Principles

React Bits is used as an inspiration source for polished animated UI ideas, not as a component source. This project is a Vite + TypeScript static frontend rather than React, so the motion language will be translated into local DOM, CSS, and GSAP patterns.

The previous `ui-template` motion experience is the stronger implementation reference:

- Treat high-end motion as a directed timeline, not a blanket fade-in rule.
- Separate opening, hero, section, image, and interaction rhythms.
- Keep GSAP scope explicit so it does not become a vague site-wide dependency.
- Respect `prefers-reduced-motion`.
- Prefer transform, opacity, clip-path, and short filter transitions over layout-changing animation.

## Motion Layers

### 1. Ambient Background

Add a `museum-atmosphere` layer near the root of the page. It should create a slow archival feeling using:

- drifting brass light,
- subtle paper-grain movement,
- a low-contrast vignette pulse,
- optional pointer-reactive cabinet light on desktop only.

This layer must stay behind content, never obscure text, and never create large repaint-heavy effects. It should be disabled or reduced under `prefers-reduced-motion: reduce`.

### 2. Opening And Hero

On first load, run a restrained opening timeline:

- brand sigil and nav settle in first,
- `Volume I` appears like an archival stamp,
- the H1 reveals in two or three line groups with a slow vertical mask,
- hero copy and actions fade/slide in after the title,
- the cabinet image plate reveals last with a soft glass-case wipe.

The opening must be brief enough to avoid making the page feel blocked. Target overall visible motion: about 1.8-2.4 seconds.

### 3. Scroll Exhibition

Use `ScrollTrigger` for section-level reveals:

- section headings enter first,
- dividers draw or brighten slowly,
- featured cards and collection cards stagger upward with low distance and long ease,
- image covers reveal with a subtle clip-path or scale settle,
- curator notes enter as ledger rows rather than generic cards.

Scroll motion should feel like walking through display rooms. It should not scrub every element continuously. Use triggered timelines for most content, with only very light parallax on wide desktop.

### 4. Operation Feedback

Keep operational motion small and precise:

- filter selection uses a brass underline or soft sweep that confirms the chosen category,
- card hover lifts by a few pixels and lets a restrained highlight move across the cover,
- button hover brightens brass and slightly deepens shadow,
- wax seals get a slow, nearly imperceptible breathing loop only when visible.

Interactions must stay responsive. No hover effect should delay clicks or change layout size.

### 5. Detail Display

When an artifact opens:

- backdrop fades with a small blur,
- dialog content rises and clarifies,
- cover image reveals first,
- ledger fields stagger in,
- gallery images reveal one by one,
- close action returns focus behavior to the existing dialog flow.

The existing native `<dialog>` behavior remains the accessibility foundation. GSAP may animate around it but must not replace it with a custom modal system.

## Architecture

Add a dedicated motion module:

- `src/museum-motion.ts`

The module exports:

- `initMuseumMotion()`
- `refreshMuseumScrollAnimations()`
- `animateArtifactDialog(dialog: HTMLDialogElement)`
- `animateArtifactDialogClose(dialog: HTMLDialogElement)`

`src/main.ts` remains responsible for rendering data and UI behavior. It calls the motion module after initial render, after filtering re-renders the collection grid, and after dialog content is inserted.

`src/styles.css` owns CSS classes, stable initial states, reduced-motion fallbacks, and non-JS hover transitions.

`scripts/validate-site.mjs` must check that the motion system exists, GSAP is declared, reduced-motion remains present, and key motion hooks are in the source.

## Data And Markup Hooks

Prefer stable data attributes over fragile selectors for motion:

- `data-motion-root`
- `data-motion-ambient`
- `data-motion-hero`
- `data-motion-title`
- `data-motion-section`
- `data-motion-item`
- `data-motion-image`
- `data-motion-filter`
- `data-motion-dialog`
- `data-motion-ledger`

These hooks should not change visible text or content semantics.

## Accessibility And Performance

- Fully respect `prefers-reduced-motion: reduce`; skip GSAP timelines and leave content visible.
- Do not animate font size, layout dimensions, or grid tracks.
- Keep mobile motion lighter: no pointer-reactive lighting and no parallax below 760px.
- Use `will-change` only on elements being actively animated, not globally.
- Avoid infinite loops except one low-cost wax seal or atmosphere loop.
- Keep keyboard focus states visible at all times.
- Preserve native dialog close behavior with button, backdrop click, and `Escape`.

## Verification

Automated checks:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`

Browser checks:

- Page loads without Vite overlay.
- H1 `私人数字藏馆` remains visible after opening motion.
- At least one section heading and one artifact card reach visible animated end state.
- Filtering refreshes collection cards and still leaves them visible.
- Detail dialog opens, cover/gallery images load, and ledger/gallery motion completes.
- `Escape` still closes the dialog.
- 390px viewport has no horizontal overflow.
- Reduced-motion mode leaves all important content visible and usable.

## Scope Boundaries

This pass does not add backend, login, upload, routing, database, real user assets, or production deployment. It does not port React Bits components directly. It only adds a local GSAP-backed motion layer for the existing static museum.
