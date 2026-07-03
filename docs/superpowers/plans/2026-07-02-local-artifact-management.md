# Local Artifact Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser-local create, edit, delete, query, cover upload, and detail image upload support for `mxren-museum`.

**Architecture:** Keep the app as a Vite + TypeScript static site deployed to GitHub Pages. Add a focused `src/artifact-store.ts` module for local persistence and pure CRUD/query functions, then wire `src/main.ts` to render sample and local artifacts together. Add a `Volume IV / 藏品管理` section in `index.html`, move curator notes to `Volume V`, and style the management UI in `src/styles.css` using the existing Academia/Classical design language.

**Tech Stack:** Vite 8.1.3, TypeScript, browser `localStorage`, native `FileReader`, GSAP motion hooks already present, Node.js structural validator.

## Global Constraints

- Do not add backend, login, database, cloud storage, server upload endpoint, external SDK, or secret handling.
- Store uploaded images as browser-local data URLs.
- Preserve all bundled sample artifacts.
- Edit and delete actions apply only to user-managed local artifacts.
- Respect existing `prefers-reduced-motion` behavior and native `<dialog>` behavior.
- Keep `npm run lint`, `npm run typecheck`, `npm run build`, and `npm audit --audit-level=moderate` green.

---

### Task 1: Structural Gate For Management Feature

**Files:**
- Modify: `scripts/validate-site.mjs`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Test: `npm run lint`

**Interfaces:**
- Consumes: current validator helper functions `exists`, `read`, and `assert`.
- Produces: failing validator checks proving the next tasks must add management/storage/upload/search artifacts.

- [ ] **Step 1: Write failing validator checks**

Add required checks for:

```js
assert(exists("src/artifact-store.ts"), "Missing local artifact store module");
assert(html.includes("id=\"artifact-search\""), "Missing artifact search input");
assert(html.includes("id=\"artifact-form\""), "Missing artifact management form");
assert(html.includes("accept=\"image/*\""), "Missing image upload input");
assert(main.includes("readImageFileAsDataUrl"), "Missing image upload reader");
assert(main.includes("handleArtifactSubmit"), "Missing artifact submit handler");
assert(main.includes("handleArtifactDelete"), "Missing artifact delete handler");
assert(main.includes("handleArtifactEdit"), "Missing artifact edit handler");
assert(readme.includes("browser-local"), "README must document browser-local management storage");
assert(read("AGENTS.md").includes("browser-local"), "AGENTS must document browser-local management storage");
```

- [ ] **Step 2: Run red check**

Run: `npm run lint`

Expected: FAIL with `Missing local artifact store module`.

- [ ] **Step 3: Keep failure for Task 2**

Do not weaken or remove the checks. Task 2 starts making the first failures pass.

### Task 2: Local Artifact Store

**Files:**
- Create: `src/artifact-store.ts`
- Modify: `src/collection.ts`
- Test: `npm run lint`, `npm run typecheck`

**Interfaces:**
- Consumes: `Artifact`, `ArtifactCategory`, and `categories` from `src/collection.ts`.
- Produces:
  - `LOCAL_ARTIFACT_STORAGE_KEY`
  - `ArtifactFormInput`
  - `ManagedArtifact`
  - `loadLocalArtifacts(storage?: Storage): ManagedArtifact[]`
  - `saveLocalArtifacts(artifacts: ManagedArtifact[], storage?: Storage): void`
  - `createLocalArtifact(input: ArtifactFormInput, existing: Artifact[]): ManagedArtifact`
  - `updateLocalArtifact(id: string, input: ArtifactFormInput, existing: ManagedArtifact[]): ManagedArtifact[]`
  - `deleteLocalArtifact(id: string, existing: ManagedArtifact[]): ManagedArtifact[]`
  - `queryArtifacts(artifacts: Artifact[], query: string, filter: "all" | ArtifactCategory): Artifact[]`

- [ ] **Step 1: Add source metadata type**

Extend `Artifact` with optional local metadata:

```ts
source?: "sample" | "local";
updatedAt?: string;
```

- [ ] **Step 2: Implement store module**

Create `src/artifact-store.ts` with localStorage parsing, safe fallback on malformed data, slug creation from title, default palette, default symbol, category label lookup, CRUD functions, and text query.

- [ ] **Step 3: Run green checks for store**

Run: `npm run lint` and `npm run typecheck`.

Expected: validator progresses past `src/artifact-store.ts`; typecheck exits 0 after exports compile.

### Task 3: Management Markup

**Files:**
- Modify: `index.html`
- Test: `npm run lint`

**Interfaces:**
- Consumes: existing page sections and `Volume` structure.
- Produces: DOM targets used by `src/main.ts`.

- [ ] **Step 1: Add navigation and section**

Add `藏品管理` to the main nav and insert `section#manage` between collection and notes. Include these stable ids:

```html
id="artifact-search"
id="artifact-form"
id="artifact-form-title"
id="artifact-form-category"
id="artifact-form-year"
id="artifact-form-medium"
id="artifact-form-rarity"
id="artifact-form-summary"
id="artifact-form-note"
id="artifact-form-featured"
id="artifact-cover-upload"
id="artifact-gallery-upload"
id="artifact-cover-preview"
id="artifact-gallery-preview"
id="artifact-manager-list"
id="artifact-manager-status"
```

- [ ] **Step 2: Run markup gate**

Run: `npm run lint`.

Expected: validator now fails on missing main handlers or README/AGENTS copy, not missing markup.

### Task 4: CRUD And Query Wiring

**Files:**
- Modify: `src/main.ts`
- Test: `npm run lint`, `npm run typecheck`

**Interfaces:**
- Consumes: exports from `src/artifact-store.ts` and markup ids from Task 3.
- Produces:
  - `readImageFileAsDataUrl(file: File): Promise<string>`
  - `handleArtifactSubmit(event: SubmitEvent): Promise<void>`
  - `handleArtifactEdit(id: string): void`
  - `handleArtifactDelete(id: string): void`

- [ ] **Step 1: Replace static artifact reads with combined state**

Use `sampleArtifacts` plus `localArtifacts` to compute `allArtifacts`. Counts, featured cards, filters, collection grid, search, and dialog use `allArtifacts`.

- [ ] **Step 2: Wire search**

`artifact-search` updates `searchQuery`, then calls `renderCollection()` and `refreshMuseumScrollAnimations()`.

- [ ] **Step 3: Wire create/edit form**

Submit reads form fields and uploaded previews, calls `createLocalArtifact` or `updateLocalArtifact`, saves local artifacts, resets form, and re-renders.

- [ ] **Step 4: Wire delete**

Delete asks for confirmation with the artifact title, calls `deleteLocalArtifact`, saves, and re-renders.

- [ ] **Step 5: Run green checks**

Run: `npm run lint` and `npm run typecheck`.

Expected: both pass.

### Task 5: Management Styling

**Files:**
- Modify: `src/styles.css`
- Test: `npm run lint`, `npm run typecheck`, `npm run build`

**Interfaces:**
- Consumes: classes/ids from Task 3.
- Produces: polished responsive UI for management controls.

- [ ] **Step 1: Add management section styles**

Add styles for `.management-panel`, `.artifact-form`, `.form-grid`, `.upload-preview`, `.manager-list`, `.manager-row`, `.manager-actions`, `.status-line`, and search input states.

- [ ] **Step 2: Preserve mobile fit**

Use fixed responsive constraints, avoid viewport-width font scaling, avoid negative letter spacing, and keep button text fitting.

- [ ] **Step 3: Run build**

Run: `npm run build`.

Expected: build succeeds and generated assets contain the new UI.

### Task 6: Documentation And Browser Verification

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: Echo Link KB project pages listed in `AGENTS.md`
- Test: local browser smoke test

**Interfaces:**
- Consumes: implemented local management behavior.
- Produces: documented scope, persistence boundary, and validation evidence.

- [ ] **Step 1: Document browser-local behavior**

README and AGENTS must say edits/uploads persist only in the current browser and do not sync across devices.

- [ ] **Step 2: Run full command verification**

Run:

```bash
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

- [ ] **Step 3: Browser smoke test**

Start dev server, then verify:

- Existing sample collection loads.
- Search narrows results.
- Category filter combines with search.
- Create a local artifact with title, description, cover image, and detail images.
- New artifact appears in collection and dialog.
- Edit title/description and see updates.
- Delete after confirmation and see count/results update.
- Reload and confirm persistence behavior.
- 390px viewport has no horizontal overflow.

- [ ] **Step 4: Commit**

Commit code, docs, and KB write-back with message:

```bash
git commit -m "Add browser-local artifact management"
```
