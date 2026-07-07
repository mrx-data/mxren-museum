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
  "arch-top",
  "sepia",
  "corner-flourish",
  "ornate-divider",
  "wax-seal",
  "drop-cap",
  "prefers-reduced-motion",
  ":focus-visible"
].forEach((pattern) => {
  assert(css.includes(pattern), `Missing required visual/accessibility pattern: ${pattern}`);
});

["Volume I", "Volume II", "Volume III", "Volume IV", "Volume V"].forEach((label) => {
  assert(html.includes(label), `Missing Roman volume label: ${label}`);
});

assert(html.includes("<header"), "Missing semantic header");
assert(html.includes("<nav"), "Missing semantic nav");
assert(html.includes("<main"), "Missing semantic main");
assert(html.includes("<dialog"), "Missing artifact detail dialog");
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
assert(itemCount >= 9, `Expected at least 9 artifacts, found ${itemCount}`);

[
  "games",
  "landscapes",
  "personal-works"
].forEach((category) => {
  assert(collection.includes(`category: "${category}"`), `Missing artifact category: ${category}`);
});

[
  "renderCollection",
  "renderFilters",
  "openArtifactDialog",
  "closeArtifactDialog",
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
  "public.museum_admins",
  "artifact-images",
  "npm run build",
  "Do not use `sb_secret_...`"
].forEach((pattern) => {
  assert(supabaseRunbook.includes(pattern), `Missing Supabase runbook pattern: ${pattern}`);
});

assert(exists("src/artifact-store.ts"), "Missing local artifact store module");

[
  "mxren-museum.local-artifacts.v1",
  "loadManagedArtifacts",
  "loadRemoteArtifacts",
  "createRemoteArtifact",
  "updateRemoteArtifact",
  "deleteRemoteArtifact",
  "isRemoteAdmin",
  "signInRemoteUser",
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
  'accept="image/*"',
  "multiple"
].forEach((pattern) => {
  assert(html.includes(pattern), `Missing artifact management markup: ${pattern}`);
});

[
  'id="hero-stage-gallery"',
  'id="hero-stage-caption"',
  'id="category-index"'
].forEach((pattern) => {
  assert(html.includes(pattern), `Missing poster gallery markup: ${pattern}`);
});

[
  "readImageFileAsDataUrl",
  "handleArtifactSubmit",
  "handleArtifactDelete",
  "handleArtifactEdit",
  "handleGateGuestAccess",
  "handleGateAdminSubmit",
  "handleSwitchIdentity",
  "hydrateManagedArtifacts",
  "createRemoteArtifact",
  "queryArtifacts",
  "loadLocalArtifacts",
  "Promise.all(files.map",
  ".slice(0, 3)"
].forEach((pattern) => {
  assert(main.includes(pattern), `Missing artifact management script pattern: ${pattern}`);
});

[
  "artifactNumber",
  "renderHeroStage",
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
