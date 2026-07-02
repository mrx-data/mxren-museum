# Museum Motion System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local GSAP-backed motion layer to `mxren-museum` that creates slow, smooth, high-end background, operation, and artifact display motion.

**Architecture:** Keep rendering and behavior in `src/main.ts`, and isolate all GSAP timelines in `src/museum-motion.ts`. Use stable `data-motion-*` hooks in markup and generated DOM so animations are durable. Keep CSS responsible for visual states, ambient layers, hover polish, and reduced-motion fallbacks.

**Tech Stack:** Vite 8.1.3, TypeScript, CSS, native `<dialog>`, npm `gsap` with `ScrollTrigger`, existing dependency-free `scripts/validate-site.mjs`.

## Global Constraints

- The dependency must be bundled locally by Vite; no CDN or external runtime scripts are allowed.
- This pass does not add backend, login, upload, routing, database, real user assets, or production deployment.
- It does not port React Bits components directly.
- Fully respect `prefers-reduced-motion: reduce`; skip GSAP timelines and leave content visible.
- Do not animate font size, layout dimensions, or grid tracks.
- Keep mobile motion lighter: no pointer-reactive lighting and no parallax below 760px.
- Preserve native dialog close behavior with button, backdrop click, and `Escape`.

---

## File Structure

- Modify `package.json` and `package-lock.json`: add local `gsap` dependency through npm.
- Modify `index.html`: add motion root, ambient layer, hero/section/title/image hooks, and dialog hook.
- Modify `src/main.ts`: add generated motion hooks to cards, filters, images, ledger fields, and dialog; call the motion module after render/filter/dialog operations.
- Create `src/museum-motion.ts`: own GSAP setup, reduced-motion checks, opening timeline, scroll timelines, filter refresh handling, and dialog animation.
- Modify `src/styles.css`: add ambient layer, motion initial states, hover sweep, tactile controls, reduced-motion visibility, and mobile performance limits.
- Modify `scripts/validate-site.mjs`: enforce GSAP dependency, motion module, motion hooks, and reduced-motion guard.
- Update `README.md`, `AGENTS.md`, and KB pages after implementation.

---

### Task 1: Add Motion Validation And Dependency Gate

**Files:**
- Modify: `scripts/validate-site.mjs`
- Modify later by npm: `package.json`
- Modify later by npm: `package-lock.json`

**Interfaces:**
- Consumes: Existing `read()`, `exists()`, and `assert()` helpers in `scripts/validate-site.mjs`.
- Produces: Structural validation requirements for Task 2 and Task 3.

- [ ] **Step 1: Write the failing validation**

Add validation requirements:

```js
const motion = exists("src/museum-motion.ts") ? read("src/museum-motion.ts") : "";

assert(pkg.dependencies?.gsap || pkg.devDependencies?.gsap, "Missing local GSAP dependency");
assert(exists("src/museum-motion.ts"), "Missing museum motion module");
assert(main.includes("initMuseumMotion"), "Missing museum motion initialization");
assert(main.includes("refreshMuseumScrollAnimations"), "Missing collection motion refresh");
assert(main.includes("animateArtifactDialog"), "Missing dialog opening animation hook");
assert(main.includes("animateArtifactDialogClose"), "Missing dialog close animation hook");
[
  "data-motion-root",
  "data-motion-ambient",
  "data-motion-hero",
  "data-motion-title",
  "data-motion-section",
  "data-motion-item",
  "data-motion-image",
  "data-motion-filter",
  "data-motion-dialog",
  "data-motion-ledger"
].forEach((hook) => {
  assert(`${html}\n${main}`.includes(hook), `Missing motion hook: ${hook}`);
});
[
  "gsap",
  "ScrollTrigger",
  "prefers-reduced-motion",
  "initMuseumMotion",
  "refreshMuseumScrollAnimations",
  "animateArtifactDialog",
  "animateArtifactDialogClose"
].forEach((pattern) => {
  assert(motion.includes(pattern), `Missing motion module pattern: ${pattern}`);
});
assert(css.includes(".museum-atmosphere"), "Missing ambient motion layer styling");
assert(css.includes(".motion-reveal"), "Missing motion reveal styling");
```

- [ ] **Step 2: Run validation to verify it fails**

Run: `npm run lint`

Expected: FAIL with `Missing local GSAP dependency` or `Missing museum motion module`.

- [ ] **Step 3: Install local GSAP**

Run: `npm install gsap`

Expected: `package.json` gains `dependencies.gsap`; `package-lock.json` updates.

- [ ] **Step 4: Re-run validation**

Run: `npm run lint`

Expected: still FAIL, now on missing motion hooks/module. This confirms the gate is checking implementation requirements, not just dependency presence.

---

### Task 2: Add Stable Markup Hooks And Visual Motion States

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Data-hook names enforced by Task 1.
- Produces: Static DOM/CSS hooks used by `src/museum-motion.ts`.

- [ ] **Step 1: Add static HTML hooks**

Use these exact hook patterns:

```html
<body data-motion-root>
  <div class="paper-texture" aria-hidden="true"></div>
  <div class="vignette" aria-hidden="true"></div>
  <div class="museum-atmosphere" data-motion-ambient aria-hidden="true"></div>
```

Add `data-motion-hero` to the hero section, `data-motion-title` to major headings, `data-motion-section` to major sections, `data-motion-image` to the cabinet plate, and `data-motion-dialog` to the dialog.

- [ ] **Step 2: Add CSS motion states**

Add these named classes and attributes to `src/styles.css`:

```css
.museum-atmosphere {
  position: fixed;
  inset: 0;
  z-index: -4;
  pointer-events: none;
  opacity: 0.82;
  background:
    radial-gradient(circle at var(--museum-light-x, 18%) var(--museum-light-y, 20%), rgba(201, 169, 98, 0.18), transparent 20rem),
    radial-gradient(circle at 78% 72%, rgba(139, 38, 53, 0.1), transparent 18rem);
}

.motion-reveal {
  will-change: transform, opacity, clip-path, filter;
}

.artifact-cover::before,
.dialog-cover::before,
.cabinet-plate::before {
  position: absolute;
  inset: 0;
  z-index: 1;
  content: "";
  pointer-events: none;
  background: linear-gradient(115deg, transparent 0%, rgba(232, 223, 212, 0.18) 48%, transparent 62%);
  transform: translateX(-120%);
  transition: transform 1100ms cubic-bezier(0.19, 1, 0.22, 1);
}

.artifact-button:hover .artifact-cover::before,
.cabinet-plate:hover::before {
  transform: translateX(120%);
}
```

- [ ] **Step 3: Preserve reduced-motion visibility**

Inside the existing reduced-motion media query, add:

```css
.motion-reveal,
[data-motion-item],
[data-motion-image],
[data-motion-title] {
  opacity: 1 !important;
  transform: none !important;
  clip-path: none !important;
  filter: none !important;
}

.museum-atmosphere {
  opacity: 0.28;
}
```

- [ ] **Step 4: Run validation**

Run: `npm run lint`

Expected: still FAIL until Task 3 creates `src/museum-motion.ts` and main integration.

---

### Task 3: Implement GSAP Motion Module And Main Integration

**Files:**
- Create: `src/museum-motion.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces:
  - `initMuseumMotion(): void`
  - `refreshMuseumScrollAnimations(): void`
  - `animateArtifactDialog(dialog: HTMLDialogElement): void`
  - `animateArtifactDialogClose(dialog: HTMLDialogElement, onComplete?: () => void): void`
- Consumes: `data-motion-*` hooks in static and generated DOM.

- [ ] **Step 1: Create the motion module**

Implement `src/museum-motion.ts` with:

```ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let scrollTriggers: ScrollTrigger[] = [];

function shouldReduceMotion() {
  return reduceMotion.matches;
}

export function initMuseumMotion() {
  document.documentElement.classList.add("motion-ready");
  if (shouldReduceMotion()) return;
  // opening, ambient, hover loops, scroll setup
}

export function refreshMuseumScrollAnimations() {
  if (shouldReduceMotion()) return;
  scrollTriggers.forEach((trigger) => trigger.kill());
  scrollTriggers = [];
  // section and item timelines
}

export function animateArtifactDialog(dialog: HTMLDialogElement) {
  if (shouldReduceMotion()) return;
  // cover, ledger, gallery reveal
}

export function animateArtifactDialogClose(dialog: HTMLDialogElement, onComplete = () => undefined) {
  if (shouldReduceMotion()) {
    onComplete();
    return;
  }
  gsap.to(dialog, { opacity: 0, y: 12, duration: 0.22, ease: "power2.out", onComplete });
}
```

- [ ] **Step 2: Add generated hooks in `src/main.ts`**

Cards:

```ts
article.dataset.motionItem = variant;
cover.dataset.motionImage = "";
button.dataset.motionItem = "artifact-button";
```

Filters:

```ts
button.dataset.motionFilter = category.id;
```

Dialog:

```ts
cover.dataset.motionImage = "";
plate.dataset.motionItem = "dialog-gallery";
plate.dataset.motionImage = "";
copy.querySelectorAll(".artifact-ledger div").forEach((item) => {
  item.setAttribute("data-motion-ledger", "");
});
```

- [ ] **Step 3: Wire module calls in `src/main.ts`**

Import:

```ts
import {
  animateArtifactDialog,
  animateArtifactDialogClose,
  initMuseumMotion,
  refreshMuseumScrollAnimations
} from "./museum-motion";
```

Call `refreshMuseumScrollAnimations()` after `renderCollection()`, call `animateArtifactDialog(dialog)` after `dialog.showModal()`, and route close through `animateArtifactDialogClose(dialog, () => dialog.close())`.

- [ ] **Step 4: Run validation and typecheck**

Run:

```bash
npm run lint
npm run typecheck
```

Expected: both pass.

---

### Task 4: Verify, Document, And Write Back

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `wiki/projects/mxren-museum/测试与验收.md`
- Modify: `wiki/sources/mxren-museum 代码仓项目概览.md`
- Modify: `sources/code/codebase-index.md`
- Modify: `log.md`

**Interfaces:**
- Consumes: Completed implementation from Tasks 1-3.
- Produces: Fresh verification evidence and KB write-back.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

Expected: all exit 0.

- [ ] **Step 2: Run browser smoke test**

Start dev server:

```bash
npm run dev -- --port 4173 --host 127.0.0.1
```

Verify:

- No Vite overlay.
- H1 `私人数字藏馆` remains visible after opening motion.
- One section heading and one artifact card reach visible animated end state.
- Filtering refreshes collection cards and leaves them visible.
- Detail dialog opens, images load, ledger/gallery are visible.
- `Escape` closes dialog.
- 390px viewport has no horizontal overflow.
- Reduced-motion leaves important content visible and usable.

- [ ] **Step 3: Update docs and KB**

Document:

- GSAP local dependency.
- `src/museum-motion.ts` scope.
- Motion verification commands.
- Reduced-motion and mobile limits.

- [ ] **Step 4: Run KB validation**

Run: `ruby /private/tmp/kb_validate_mxren_init.rb`

Expected: frontmatter errors 0, old key hits 0, missing links 0, ambiguous generic links 0, missing AGENTS sections 0.
