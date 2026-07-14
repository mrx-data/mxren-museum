import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function exists(relativePath) {
  try {
    return statSync(join(root, relativePath)).isFile();
  } catch {
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

[
  "package.json",
  "index.html",
  "src/collection.ts",
  "src/main.ts",
  "src/supabase-client.ts",
  "src/styles.css",
  "README.md",
  "AGENTS.md",
  ".gitignore",
  ".env.example",
  ".github/workflows/deploy-pages.yml",
  "docs/supabase-persistence.md",
  "supabase/migrations/20260706000000_museum_artifact_persistence.sql",
  "supabase/migrations/20260706010000_museum_admin_role_lookup.sql",
  "supabase/migrations/20260707010000_museum_admin_password_accounts.sql",
  "supabase/migrations/20260710020000_museum_sample_artifact_overrides.sql",
  "supabase/migrations/20260711010000_remove_legacy_sample_artifacts.sql",
  "supabase/migrations/20260713010000_artifact_storage_images.sql",
  "supabase/migrations/20260714010000_allow_jpeg_storage_variants.sql",
  "supabase/functions/artifact-images/index.ts",
  "supabase/config.toml",
  "src/artifact-images.ts",
  "scripts/migrate-artifact-images.mjs",
  "docs/superpowers/specs/2026-07-02-personal-digital-museum-design.md"
].forEach((file) => {
  assert(exists(file), `Missing required file: ${file}`);
});

const pkg = JSON.parse(read("package.json"));
const html = read("index.html");
const collection = read("src/collection.ts");
const main = read("src/main.ts");
const css = read("src/styles.css");
const readme = read("README.md");
const motion = exists("src/museum-motion.ts") ? read("src/museum-motion.ts") : "";
const artifactStore = exists("src/artifact-store.ts") ? read("src/artifact-store.ts") : "";
const supabaseClient = read("src/supabase-client.ts");
const gitignore = exists(".gitignore") ? read(".gitignore") : "";
const deployWorkflow = exists(".github/workflows/deploy-pages.yml") ? read(".github/workflows/deploy-pages.yml") : "";
const viteConfig = read("vite.config.ts");
const envExample = read(".env.example");
const supabaseMigration = read("supabase/migrations/20260706000000_museum_artifact_persistence.sql");
const supabaseRoleMigration = read("supabase/migrations/20260706010000_museum_admin_role_lookup.sql");
const supabasePasswordMigration = read("supabase/migrations/20260707010000_museum_admin_password_accounts.sql");
const supabaseOverrideMigration = read("supabase/migrations/20260710020000_museum_sample_artifact_overrides.sql");
const removeLegacySamplesMigration = read("supabase/migrations/20260711010000_remove_legacy_sample_artifacts.sql");
const storageImagesMigration = read("supabase/migrations/20260713010000_artifact_storage_images.sql");
const jpegStorageMigration = read("supabase/migrations/20260714010000_allow_jpeg_storage_variants.sql");
const artifactImages = read("src/artifact-images.ts");
const storageFunction = read("supabase/functions/artifact-images/index.ts");
const supabaseRunbook = read("docs/supabase-persistence.md");

["dev", "preview", "lint", "typecheck", "build"].forEach((script) => {
  assert(pkg.scripts?.[script], `Missing package script: ${script}`);
});

assert(pkg.dependencies?.gsap || pkg.devDependencies?.gsap, "Missing local GSAP dependency");

["#1C1714", "#251E19", "#E8DFD4", "#C9A962", "#8B2635", "#4A3F35"].forEach((token) => {
  assert(css.includes(token), `Missing Academia color token: ${token}`);
});

[
  "paper-texture",
  "vignette",
  "corner-flourish",
  "ornate-divider",
  "drop-cap",
  "prefers-reduced-motion",
  ":focus-visible"
].forEach((pattern) => {
  assert(css.includes(pattern), `Missing required visual/accessibility pattern: ${pattern}`);
});

assert(!`${main}\n${css}`.includes("cover-symbol"), "Category symbols must not be rendered over cover images");
assert(!`${main}\n${css}\n${html}`.includes("wax-seal") && !html.includes("蜡封"), "Wax-seal styling and copy must stay removed");
["curator-mark", "curator-mark-monogram", "curator-mark-label", "arch-top", "sepia-reveal", "artifact-cover::after", "stage-card::after"].forEach((pattern) => {
  assert(`${main}\n${css}`.includes(pattern), `Missing restored cover treatment: ${pattern}`);
});
assert(html.includes("被馆藏印记收录") && html.includes("列入精选馆藏"), "Missing curator-mark interface copy");

["Volume I", "Volume II", "Volume III", "Volume IV", "Volume V"].forEach((label) => {
  assert(html.includes(label), `Missing Roman volume label: ${label}`);
});

assert(html.includes("<header"), "Missing semantic header");
assert(html.includes("<nav"), "Missing semantic nav");
assert(html.includes("<main"), "Missing semantic main");
assert(html.includes("<dialog"), "Missing artifact detail dialog");
assert(html.includes('id="image-lightbox"'), "Missing detail image lightbox");
assert(html.includes('id="artifact-save-button"'), "Missing artifact save feedback button");
assert(html.includes('id="artifact-save-error"'), "Missing artifact save error dialog");
assert(html.includes("id=\"app\""), "Missing app mount point");
assert(html.includes("id=\"access-gate\""), "Missing access gate");
assert(html.includes("id=\"gate-guest-access\""), "Missing gate guest access control");
assert(html.includes("id=\"gate-admin-toggle\""), "Missing gate admin toggle");
assert(html.includes("id=\"gate-auth-form\""), "Missing gate admin login form");
assert(html.includes("游客进入"), "Missing guest entry label");
assert(html.includes("管理员登录"), "Missing admin login label");
assert(html.includes("data-access-role=\"locked\""), "Missing default locked access role");
assert(html.includes("Cormorant+Garamond"), "Missing Cormorant Garamond font link");
assert(html.includes("Crimson+Pro"), "Missing Crimson Pro font link");
assert(html.includes("Cinzel"), "Missing Cinzel font link");

const itemCount = (collection.match(/\btitle: "/g) || []).length;
assert(itemCount === 1, `Expected exactly 1 built-in artifact, found ${itemCount}`);
assert(collection.includes('id: "black-myth-wukong"'), "Black Myth: Wukong must remain as the built-in artifact");
assert(collection.includes('title: "黑神话：悟空"'), "Missing Black Myth: Wukong built-in artifact");

[
  "games",
  "landscapes",
  "personal-works"
].forEach((category) => {
  assert(collection.includes(`id: "${category}"`), `Missing artifact category option: ${category}`);
});

[
  "renderCollection",
  "renderFilters",
  "openArtifactDialog",
  "closeArtifactDialog",
  "openImageLightbox",
  "closeImageLightbox",
  "moveImageLightbox",
  "dialog-image-strip",
  "canManageArtifacts",
  "requireManageAccess",
  "isRemoteAdmin",
  "ACCESS_MODE_STORAGE_KEY",
  "handleGateGuestAccess",
  "handleGateAdminSubmit",
  "handleSwitchIdentity"
].forEach((functionName) => {
  assert(main.includes(functionName), `Missing interaction function: ${functionName}`);
});

assert(css.includes("dialog-image-strip"), "Missing dialog image strip styling");
assert(css.includes(".image-zoom-trigger"), "Missing detail image zoom trigger styling");
assert(css.includes(".image-lightbox-figure img"), "Missing full-size lightbox image styling");
assert(css.includes('grid-template-areas: "previous lightbox-image next"'), "Lightbox image must keep its center grid area");
assert(css.includes("grid-area: lightbox-image"), "Lightbox figure must not collapse into a hidden navigation column");
assert(css.includes('.artifact-save-button[data-saving="true"]'), "Missing artifact save pending styling");
assert(css.includes(".save-error-dialog"), "Missing themed artifact save error styling");
assert(css.includes(".access-gate"), "Missing access gate styling");
assert(css.includes('body[data-access-role="locked"]'), "Missing locked access styling");
assert(css.includes(".manager-readonly"), "Missing read-only manager badge styling");
assert(css.includes(".artifact-form[hidden]"), "Missing hidden management form styling");

assert(main.includes("addEventListener(\"click\""), "Missing click interaction wiring");
assert(main.includes("Escape"), "Missing Escape key dialog handling");
assert(main.includes("showModal"), "Missing native dialog modal behavior");

assert(!css.includes("letter-spacing: -"), "Negative letter spacing is not allowed");
assert(!css.includes("vw,"), "Viewport-width font scaling is not allowed");

const combined = `${html}\n${collection}\n${main}\n${css}\n${readme}`;
assert(!/\b(TODO|TBD|FIXME)\b/i.test(combined), "Placeholder text remains in project files");
const forbiddenDefaultPassword = ["123", "mengrenxu"].join("");
assert(!`${combined}\n${supabasePasswordMigration}`.includes(forbiddenDefaultPassword), "Default admin password must not be committed");

const coverCount = (collection.match(/\bcoverImage: "/g) || []).length;
const galleryCount = (collection.match(/\bgalleryImages: \[/g) || []).length;
const imagePaths = Array.from(collection.matchAll(/"(\/artifacts\/[^"]+\.png)"/g)).map((match) => match[1]);

assert(coverCount === itemCount, `Expected ${itemCount} coverImage fields, found ${coverCount}`);
assert(galleryCount === itemCount, `Expected ${itemCount} galleryImages fields, found ${galleryCount}`);
assert(imagePaths.length >= itemCount * 4, `Expected at least ${itemCount * 4} artifact image paths, found ${imagePaths.length}`);

imagePaths.forEach((imagePath) => {
  assert(exists(`public${imagePath}`), `Missing artifact image asset: public${imagePath}`);
});

assert(main.includes("createImageElement"), "Missing image element rendering helper");
assert(main.includes("resolveAssetSrc"), "Missing asset base path resolver");
assert(main.includes("BASE_URL"), "Image assets must respect Vite base URL for GitHub Pages");
assert(main.includes("artifact.coverImage"), "Artifact cover image is not rendered from data");
assert(main.includes("artifact.galleryImages"), "Artifact gallery images are not rendered from data");
assert(css.includes(".artifact-cover img"), "Missing artifact cover image styling");
assert(css.includes(".dialog-image-strip img"), "Missing dialog gallery image styling");

assert(exists("src/museum-motion.ts"), "Missing museum motion module");
assert(main.includes("initMuseumMotion"), "Missing museum motion initialization");
assert(main.includes("refreshMuseumScrollAnimations"), "Missing collection motion refresh");
assert(main.includes("animateArtifactDialog"), "Missing dialog opening animation hook");
assert(main.includes("animateArtifactDialogClose"), "Missing dialog close animation hook");

[
  "data-motion-root",
  "data-motion-ambient",
  "data-motion-light",
  "data-motion-light-secondary",
  "data-motion-pointer-light",
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
  "playMuseumEntry",
  "refreshMuseumScrollAnimations",
  "animateCollectionRefresh",
  "animateMuseumRoute",
  "animateArtifactDialog",
  "animateArtifactDialogClose",
  "gsap.quickTo",
  "visibilitychange",
  "clearProps"
].forEach((pattern) => {
  assert(motion.includes(pattern), `Missing motion module pattern: ${pattern}`);
});

assert(css.includes(".museum-atmosphere"), "Missing ambient motion layer styling");
assert(html.includes("data-museum-canvas"), "Missing museum dust canvas");
assert(exists("src/museum-canvas.ts"), "Missing museum canvas module");
assert(main.includes("initMuseumCanvas"), "Missing museum canvas initialization");
assert(css.includes(".museum-dust-canvas"), "Missing museum dust canvas styling");
assert(css.includes(".museum-pointer-light"), "Missing pointer light styling");
assert(css.includes(".motion-reveal"), "Missing motion reveal styling");
assert(motion.includes("animation: timeline"), "Scroll reveals must prepare their initial state before playback");
assert(motion.indexOf("refreshMuseumScrollAnimations();") < motion.lastIndexOf("playMuseumEntry();"), "Museum entry must start after scroll animation reset");
assert(main.includes("searchDebounceTimer"), "Missing collection search debounce");
assert(main.includes("fetchpriority"), "Missing high-priority hero image loading");

["node_modules", "dist", ".DS_Store"].forEach((pattern) => {
  assert(gitignore.includes(pattern), `Missing .gitignore pattern: ${pattern}`);
});

[
  "actions/deploy-pages@v4",
  "actions/upload-pages-artifact@v3",
  "npm ci",
  "npm run build",
  "branches: [main]"
].forEach((pattern) => {
  assert(deployWorkflow.includes(pattern), `Missing GitHub Pages workflow pattern: ${pattern}`);
});

assert(viteConfig.includes("GITHUB_ACTIONS"), "Missing GitHub Pages base environment switch");
assert(viteConfig.includes("/mxren-museum/"), "Missing GitHub Pages repository base path");

[
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY"
].forEach((pattern) => {
  assert(envExample.includes(pattern), `Missing Supabase env example: ${pattern}`);
  assert(supabaseClient.includes(pattern), `Missing Supabase client env: ${pattern}`);
});

[
  "createClient",
  "SUPABASE_ARTIFACT_BUCKET",
  "artifact-images",
  "sb_publishable_"
].forEach((pattern) => {
  assert(supabaseClient.includes(pattern), `Missing Supabase client pattern: ${pattern}`);
});

[
  "create table if not exists public.artifacts",
  "create table if not exists public.museum_admins",
  "enable row level security",
  "public can read artifacts",
  "museum admins can insert artifacts",
  "storage.buckets",
  "storage.objects"
].forEach((pattern) => {
  assert(supabaseMigration.includes(pattern), `Missing Supabase migration pattern: ${pattern}`);
});

[
  "grant select on table public.museum_admins to authenticated",
  "user_id = auth.uid()"
].forEach((pattern) => {
  assert(supabaseRoleMigration.includes(pattern), `Missing Supabase admin role migration pattern: ${pattern}`);
});

[
  "create table if not exists public.museum_admin_accounts",
  "password_hash text not null",
  "set search_path = public, extensions",
  "crypt(coalesce(input_password",
  "museum_admin_sessions",
  "verify_museum_admin_login",
  "verify_museum_admin_session",
  "create_museum_artifact",
  "update_museum_artifact",
  "delete_museum_artifact",
  "alter column owner_id drop not null",
  "grant execute on function public.verify_museum_admin_login"
].forEach((pattern) => {
  assert(supabasePasswordMigration.includes(pattern), `Missing Supabase password admin migration pattern: ${pattern}`);
});

[
  "public.museum_admin_accounts",
  "verify_museum_admin_login",
  "npm run build",
  "Do not use `sb_secret_...`"
].forEach((pattern) => {
  assert(supabaseRunbook.includes(pattern), `Missing Supabase runbook pattern: ${pattern}`);
});

assert(exists("src/artifact-store.ts"), "Missing local artifact store module");

[
  "mxren-museum.admin-session.v1",
  "mxren-museum.local-artifacts.v1",
  "loadManagedArtifacts",
  "loadRemoteArtifacts",
  "createRemoteArtifact",
  "updateRemoteArtifact",
  "deleteRemoteArtifact",
  "isRemoteAdmin",
  "signInRemoteUser",
  "verify_museum_admin_login",
  "storeAdminSession",
  "createLocalArtifact",
  "updateLocalArtifact",
  "deleteLocalArtifact",
  "queryArtifacts",
  "loadLocalArtifacts",
  "saveLocalArtifacts"
].forEach((pattern) => {
  assert(artifactStore.includes(pattern), `Missing artifact store pattern: ${pattern}`);
});

[
  'id="artifact-search"',
  'id="artifact-form"',
  'id="gate-auth-form"',
  'id="gate-auth-email"',
  'id="gate-auth-password"',
  'id="auth-sign-out"',
  'id="artifact-cover-upload"',
  'id="artifact-gallery-upload"',
  'id="artifact-manager-list"',
  'id="artifact-manager-status"',
  "修改已经入馆的藏品",
  "全部馆藏",
  'accept="image/jpeg,image/png,image/webp,image/gif"',
  "multiple"
].forEach((pattern) => {
  assert(html.includes(pattern), `Missing artifact management markup: ${pattern}`);
});

[
  'id="hero-stage-gallery"',
  'id="hero-stage-caption"',
  'id="hero-stage-controls"',
  'id="hero-stage-toggle"',
  'id="category-index"'
].forEach((pattern) => {
  assert(html.includes(pattern), `Missing poster gallery markup: ${pattern}`);
});

[
  "createImagePreviewUrl",
  "handleArtifactSubmit",
  "setArtifactSavingState",
  "showArtifactSaveError",
  "handleArtifactDelete",
  "handleArtifactEdit",
  "mergeArtifacts",
  "handleGateGuestAccess",
  "handleGateAdminSubmit",
  "handleSwitchIdentity",
  "hydrateManagedArtifacts",
  "createRemoteArtifact",
  "queryArtifacts",
  "loadLocalArtifacts",
  "URL.createObjectURL",
  "files.length > 3"
].forEach((pattern) => {
  assert(main.includes(pattern), `Missing artifact management script pattern: ${pattern}`);
});

[
  "uploadToSignedUrl",
  "uploadArtifactImages",
  "Promise.allSettled",
  "canvasBlob",
  "destination-over",
  "image/jpeg",
  "createSignedUploadUrl",
  "X-Museum-Session",
  "cover_thumbnail_storage_path",
  "Base64 cover images are no longer accepted"
].forEach((pattern) => {
  assert(`${artifactImages}\n${artifactStore}\n${storageFunction}\n${storageImagesMigration}\n${jpegStorageMigration}`.includes(pattern), `Missing Storage image pattern: ${pattern}`);
});

assert(jpegStorageMigration.includes("display\\.(webp|jpg|gif)"), "JPEG display paths are not accepted by the database");
assert(jpegStorageMigration.includes("thumbnail\\.(webp|jpg)"), "JPEG thumbnail paths are not accepted by the database");

assert(!main.includes("readAsDataURL"), "Managed image previews must not create Base64 data URLs");
assert(pkg.scripts?.["migrate:artifact-images"], "Missing artifact image migration command");

[
  "sourceArtifactId",
  "remoteId",
  "source_artifact_id",
  "palette: current?.palette",
  "symbol: current?.symbol",
  "请先应用内置藏品覆盖 migration"
].forEach((pattern) => {
  assert(artifactStore.includes(pattern), `Missing artifact override store pattern: ${pattern}`);
});

[
  "add column if not exists source_artifact_id text",
  "artifacts_source_artifact_id_unique",
  "on conflict (source_artifact_id) where source_artifact_id is not null",
  "create or replace function public.create_museum_artifact",
  "create or replace function public.update_museum_artifact"
].forEach((pattern) => {
  assert(supabaseOverrideMigration.includes(pattern), `Missing sample artifact override migration pattern: ${pattern}`);
});

[
  "delete from public.artifacts",
  "source_artifact_id is not null",
  "source_artifact_id <> 'black-myth-wukong'"
].forEach((pattern) => {
  assert(removeLegacySamplesMigration.includes(pattern), `Missing legacy sample cleanup migration pattern: ${pattern}`);
});

[
  "artifactNumber",
  "renderHeroStage",
  "moveHeroStage",
  "scheduleHeroStageAutoplay",
  "bindHeroStageEvents",
  "card.inert = !isFront",
  "renderCategoryIndex",
  "poster-card-topline",
  "category-ticket"
].forEach((pattern) => {
  assert(main.includes(pattern), `Missing poster gallery script pattern: ${pattern}`);
});

[
  "management-panel",
  "auth-panel",
  "auth-form",
  "artifact-form",
  "upload-preview",
  "manager-list",
  "status-line"
].forEach((pattern) => {
  assert(css.includes(pattern), `Missing artifact management styling: ${pattern}`);
});

[
  "hero-stage-card",
  "stage-rack",
  "stage-carousel-controls",
  "stage-carousel-meter",
  'data-stage-position="0"',
  "category-index",
  "category-ticket",
  "poster-work",
  "poster-specs"
].forEach((pattern) => {
  assert(css.includes(pattern), `Missing poster gallery styling: ${pattern}`);
});

assert(readme.includes("browser-local"), "README must document browser-local management storage");
assert(read("AGENTS.md").includes("browser-local"), "AGENTS must document browser-local management storage");

console.log(`mxren-museum validation passed (${itemCount} artifacts).`);
