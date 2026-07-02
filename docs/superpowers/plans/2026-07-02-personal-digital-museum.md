# Personal Digital Museum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-version static frontend for `mxren-museum`, a personal digital collection gallery for games, landscapes, and personal works.

**Architecture:** Use a Vite + TypeScript single-page app. Keep collection data separate from rendering logic, and use a dependency-free validation script as the project quality gate.

**Tech Stack:** HTML, CSS, TypeScript, Vite, Node.js validation script.

## Global Constraints

- No backend, database, login, upload flow, or production deployment.
- No real secrets, `.env*` reads, tokens, cookies, or credential handling.
- Use the pasted Academia/Classical design system.
- Use brass for all interactive elements and focus states.
- Respect `prefers-reduced-motion`.
- Do not claim completion without fresh verification output.

---

## File Structure

- `package.json`: project scripts and dev dependencies.
- `index.html`: semantic document shell.
- `src/collection.ts`: typed artifact data.
- `src/main.ts`: render, filter, count, and modal interactions.
- `src/styles.css`: visual system, layout, responsive behavior.
- `scripts/validate-site.mjs`: automated structural validation.
- `README.md`: local project guide.
- `docs/superpowers/specs/2026-07-02-personal-digital-museum-design.md`: approved design.

## Task 1: Validation Gate

**Files:**
- Create: `scripts/validate-site.mjs`
- Create: `package.json`

**Interfaces:**
- Produces: `npm run lint`, which fails until required project files and design tokens exist.

- [ ] Write `scripts/validate-site.mjs` to assert package scripts, app files, collection categories, Academia tokens, arch covers, wax seals, modal behavior hooks, responsive CSS, and absence of placeholders.
- [ ] Create `package.json` with `lint`, `typecheck`, `build`, `dev`, and `preview` scripts.
- [ ] Run `npm run lint`.
- [ ] Expected result before production files: fail because `index.html` and `src/*` are missing.

## Task 2: Static App Structure

**Files:**
- Create: `index.html`
- Create: `src/collection.ts`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `README.md`

**Interfaces:**
- Consumes: validation rules from Task 1.
- Produces: a single-page gallery with filters, artifact cards, and detail modal.

- [ ] Add semantic HTML shell and root container.
- [ ] Add at least nine typed sample artifacts across games, landscapes, and personal works.
- [ ] Implement data-driven rendering, category filters, counts, and modal open/close behavior.
- [ ] Implement Academia/Classical CSS tokens, overlays, arch covers, sepia transitions, Roman volume labels, ornate dividers, drop caps, brass focus states, and responsive rules.
- [ ] Run `npm run lint`.
- [ ] Expected result: pass.

## Task 3: Typecheck And Build

**Files:**
- Create: `tsconfig.json`
- Create: `vite.config.ts`

**Interfaces:**
- Consumes: `src/main.ts` and `src/collection.ts`.
- Produces: `npm run typecheck` and `npm run build`.

- [ ] Add strict TypeScript config.
- [ ] Add minimal Vite config.
- [ ] Install dependencies if needed.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Expected result: both pass with exit code 0.

## Task 4: Browser Verification And Write-Back

**Files:**
- Modify: `AGENTS.md`
- Modify KB pages under `/Users/echo/Documents/obsidian-data/echo-link-kb/wiki/projects/mxren-museum/`
- Modify: `/Users/echo/Documents/obsidian-data/echo-link-kb/sources/code/codebase-index.md`

**Interfaces:**
- Consumes: finished app and command results.
- Produces: updated project knowledge and final verification record.

- [ ] Start `npm run dev`.
- [ ] Inspect desktop and mobile viewport behavior.
- [ ] Confirm filter buttons and detail modal work.
- [ ] Update `AGENTS.md` with real commands and project structure.
- [ ] Update KB demand, solution, task, test, retro, and codebase index pages.
- [ ] Record verification evidence and any remaining gaps.

## Self-Review

- The plan covers static frontend, visual system, data, interactions, validation, build, browser check, and KB write-back.
- There are no `TBD`, `TODO`, or unspecified implementation placeholders.
- Task interfaces match the file design in the spec.
