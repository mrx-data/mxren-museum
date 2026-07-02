# Personal Digital Museum Design

## Goal

Build the first frontend version of `mxren-museum`: a personal digital collection gallery for games, landscapes, and personal works. The page should feel like a private classical archive at night, using the provided Academia/Classical design system as the visual law.

## Scope

This version is a static frontend experience:

- No backend, login, database, upload flow, or real asset management.
- Local sample collection data only.
- A single page with collection browsing, category filtering, featured artifacts, and a detail modal with cover, image strip, ledger metadata, and introduction.
- Vite + TypeScript project structure with a reusable validation script.

## Design Direction

Subject: a private digital cabinet of curiosities.

Audience: the owner and invited viewers who want to browse a curated personal archive.

Single job: make the digital collection feel precious, browsable, and ready to grow.

### Tokens

- Deep Mahogany: `#1C1714`
- Aged Oak: `#251E19`
- Antique Parchment: `#E8DFD4`
- Worn Leather: `#3D332B`
- Faded Ink: `#9C8B7A`
- Polished Brass: `#C9A962`
- Library Crimson: `#8B2635`
- Wood Grain: `#4A3F35`

Typography follows the pasted design system:

- Display labels: `Cinzel`
- Headings: `Cormorant Garamond`
- Body copy: `Crimson Pro`

The implementation must avoid negative letter spacing and avoid scaling text by viewport width.

### Layout

```text
Header
  brand + section links

Volume I / Hero
  curator statement + primary actions
  featured arch-top cabinet preview

Volume II / Featured ledger
  three highlighted digital artifacts

Volume III / Collection index
  brass category filters
  responsive artifact grid
  detail modal with image, notes, metadata

Volume IV / Curator notes
  principles for future collection growth

Footer
```

### Signature Element

The memorable element is the `catalogue drawer`: each artifact cover is an arch-topped digital plate with sepia-to-color hover, brass corner flourishes, and metadata formatted like an archival ledger. Featured items receive a crimson wax seal.

## Functional Requirements

- Show at least nine sample artifacts across `games`, `landscapes`, and `personal works`.
- Render collection counts and category filters from data.
- Filter artifacts without reloading the page.
- Open a detail modal for every artifact.
- Show a three-image strip in the detail modal for every artifact: cover, detail, and memory.
- Close the modal with the close button, backdrop click, or `Escape`.
- Keep semantic structure with `header`, `nav`, `main`, `section`, `article`, `footer`, and `dialog`.
- Provide accessible labels for filter buttons, item buttons, and visual covers.
- Respect `prefers-reduced-motion`.
- Work on desktop and mobile without horizontal overflow.

## Visual Requirements

- Use the pasted Academia/Classical palette and material language.
- Include paper texture and vignette fixed overlays.
- Use Roman `Volume` labels for major sections.
- Use drop-cap introductory copy.
- Use ornate dividers with glyphs.
- Use arch-top covers and sepia-to-color transitions.
- Use brass for all interactive controls and focus states.
- Use crimson only for featured wax seals and rare emphasis.
- Keep cards at 4px radius, not pill-shaped.

## File Design

- `index.html`: document shell, root container, font preconnects, semantic metadata.
- `src/collection.ts`: artifact data and type definitions.
- `src/main.ts`: DOM rendering, filtering, modal behavior, count updates.
- `src/styles.css`: design tokens, layout, academia visual system, responsive rules.
- `scripts/validate-site.mjs`: structural quality gate for data, markup, CSS, scripts, and package scripts.
- `package.json`: Vite, TypeScript, lint/build/dev scripts.
- `README.md`: project purpose, commands, and current boundaries.

## Verification

Required commands after implementation:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Start `npm run dev` and inspect the page in a browser at local dev server URL.

If dependency installation cannot complete, record that explicitly and still run all dependency-free checks.
