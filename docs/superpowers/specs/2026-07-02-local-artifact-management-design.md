# Local Artifact Management Design

## Goal

Add first-class artifact management to `mxren-museum`: create artifacts, edit artifact descriptions, upload a cover image and detail images, delete artifacts, and query the collection without leaving the current static GitHub Pages architecture.

## Chosen Scope

This pass implements a browser-local management system. It does not add a backend, login, database, cloud storage, server upload endpoint, or external SDK.

Uploaded images are read in the browser and stored with the managed artifact data. The feature is persistent for the current browser profile, but it is not synchronized across devices. This keeps the live GitHub Pages deployment valid while making the museum immediately editable.

## User Experience

Add a new `Volume IV / 藏品管理` section after the collection index and before curator notes. The existing curator notes move to `Volume V`. The management section should feel like a curator's ledger, not a generic admin dashboard.

The section contains:

- A search field for title, summary, description, category label, year, medium, and rarity.
- A create/edit form for artifact metadata.
- A cover image upload control with local preview.
- Detail image upload controls supporting up to three images with labels.
- A management list showing user-managed artifacts with Edit and Delete actions.
- A small persistence note explaining that edits are stored in this browser.

The existing public collection remains the primary experience. Management controls augment it without replacing the current gallery.

## Functional Requirements

- Create a new artifact with title, category, year, medium, rarity, summary, detailed note, featured flag, cover image, and up to three detail images.
- Edit a user-managed artifact and preserve its stable id.
- Delete a user-managed artifact after an explicit confirmation step.
- Query artifacts by text across title, category label, year, medium, rarity, summary, and note.
- Combine query text with the existing category filter.
- Render user-managed artifacts in featured cards, the collection grid, counts, and detail dialog.
- Uploaded cover images render in artifact cards and detail dialogs.
- Uploaded detail images render in the dialog image strip.
- If a user does not upload a cover, use a generated local gradient plate with accessible alt text.
- If a user uploads fewer than three detail images, render the available images only.
- Preserve all existing sample artifacts.
- Persist only user-managed artifacts and user deletions/edits of user-managed artifacts in browser storage.
- Do not allow destructive changes to bundled sample artifacts in this pass; sample artifacts may be searched and opened, but edit/delete actions only appear for user-managed artifacts.

## Data Model

Use the existing `Artifact` shape as the render model. Add local management metadata in a separate type:

- `source: "sample" | "local"`
- `updatedAt: string`
- `description: string` maps to existing `note`

The storage module exposes render-ready artifacts so `src/main.ts` does not need to know whether an artifact came from bundled data or local storage.

## Storage Architecture

Create `src/artifact-store.ts` with pure functions and storage adapters:

- `loadLocalArtifacts(storage?: Storage): Artifact[]`
- `saveLocalArtifacts(artifacts: Artifact[], storage?: Storage): void`
- `createLocalArtifact(input: ArtifactFormInput, existing: Artifact[]): Artifact`
- `updateLocalArtifact(id: string, input: ArtifactFormInput, existing: Artifact[]): Artifact[]`
- `deleteLocalArtifact(id: string, existing: Artifact[]): Artifact[]`
- `queryArtifacts(artifacts: Artifact[], query: string, filter: "all" | ArtifactCategory): Artifact[]`

The module uses `localStorage` under key `mxren-museum.local-artifacts.v1`. Image payloads are stored as data URLs. If storage is unavailable or malformed, the app falls back to an empty local artifact list.

## Upload Handling

Use native file inputs. Only `image/*` files are accepted. The UI reads files with `FileReader.readAsDataURL`.

Constraints:

- Cover accepts one image.
- Detail images accept up to three images.
- Each stored uploaded image keeps `src`, `alt`, and `label`.
- Default labels are `细节`, `记忆`, and `图板`.
- The form previews chosen images before save.

## Visual Direction

The management section keeps the Academia/Classical system:

- Use parchment panels, brass borders, ledger labels, and restrained crimson warning states.
- Inputs are rectangular, not pill-shaped.
- Buttons use existing brass button language.
- Edit/Delete actions use compact controls with clear text labels.
- Form errors are direct and specific.
- Search results update the existing gallery rather than showing a separate results page.

Motion should be subtle:

- New local artifacts appear through the existing card reveal system.
- Form mode changes may use existing CSS transitions only.
- Reduced-motion behavior remains intact.

## Error Handling

- Missing title blocks save with `请输入藏品标题`.
- Missing category blocks save with `请选择藏品类别`.
- Invalid image read shows `图片读取失败，请换一张图片`.
- Storage write failure shows `浏览器存储空间不足，藏品未保存`.
- Delete confirmation text includes the artifact title.

## Accessibility

- All form controls have visible labels.
- Upload previews have alt text.
- Search has `aria-label`.
- Management status messages use `aria-live="polite"`.
- Edit/Delete buttons include artifact titles in their accessible labels.
- The native detail dialog remains unchanged as the accessible detail surface.

## Verification

Automated checks:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`

The structural validator must check for:

- `src/artifact-store.ts`
- local storage key `mxren-museum.local-artifacts.v1`
- `createLocalArtifact`, `updateLocalArtifact`, `deleteLocalArtifact`, `queryArtifacts`
- search input markup
- management form markup
- upload input markup with `accept="image/*"`
- edit/delete action wiring
- browser-local persistence copy in README/AGENTS

Browser checks:

- Page loads with the existing sample collection.
- Search for `夜行者` narrows the collection.
- Search and category filter combine correctly.
- Create a local artifact with title, description, cover image, and two detail images.
- The new artifact appears in the collection, count updates, cover loads, and detail dialog shows uploaded detail images.
- Edit the new artifact title and description; collection and dialog update.
- Delete the new artifact after confirmation; it disappears and count updates.
- Reload the page after creation/edit/delete to confirm local persistence.
- 390px mobile viewport has no horizontal overflow.

## Out Of Scope

- Cross-device sync.
- Authentication or owner-only authorization.
- Server-side image upload.
- Database schema.
- Cloud object storage.
- Editing or deleting bundled sample artifacts.
- Import/export backup flow.
