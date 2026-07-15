# Supabase Persistence Runbook

Production status (2026-07-15): migrations through `20260715010000_artifact_visibility_and_sharing.sql` are applied and pass remote schema lint. The `artifact-images` Edge Function is active with `verify_jwt = false`. Historical Base64 images have been migrated to Storage and cleared after a verified private backup.

mxren-museum remains a static GitHub Pages site. Supabase provides the runtime persistence layer for managed artifacts and custom admin login:

- Auth: the full site is hidden behind an entry gate; visitors enter with one click, while admins sign in with a username/password stored in `public.museum_admin_accounts`.
- Postgres: `public.artifacts` stores artifact metadata.
- Categories: `public.museum_categories` is publicly readable; admins add or rename categories through `save_museum_category`, which also updates existing artifact labels.
- Storage: the public `artifact-images` bucket stores immutable cover and gallery objects; the database stores their paths.
- Edge Function: `artifact-images` verifies the custom museum session before issuing signed upload URLs or deleting owned paths.
- Built-in overrides: `source_artifact_id` links a cloud row to a TypeScript sample artifact, allowing edits without duplicate gallery cards; deleting the override restores the built-in version.
- Bundled scope: `black-myth-wukong` is the only remaining sample ID; orphaned override rows for removed samples are excluded by the frontend and removed by the cleanup migration.
- Admin credentials: passwords are stored as `pgcrypto.crypt()` hashes; the frontend never reads the hash.
- Admin sessions: `public.museum_admin_sessions` stores hashed short-lived session tokens returned by `verify_museum_admin_login`.
- Visibility: `draft` is admin-only, `published` appears in public listings, and `unlisted` is omitted from listings but available through its stable deep link.
- RLS/RPC: direct anonymous reads from `public.artifacts` are revoked by the visibility migration. Public lists and single-artifact deep links use `load_museum_artifacts` and `load_museum_artifact`; writes use session-verified CRUD RPC functions.
- Access roles: `locked` hides the museum, `guest` is read-only, and `admin` is granted only after the admin session token is verified by `verify_museum_admin_session`.

## One-Time Setup

1. Open the Supabase SQL Editor for `https://wjhktoqihszgdkxbanxu.supabase.co`.
2. Run `supabase/migrations/20260706000000_museum_artifact_persistence.sql`.
3. Run `supabase/migrations/20260706010000_museum_admin_role_lookup.sql`.
4. Run `supabase/migrations/20260707010000_museum_admin_password_accounts.sql`.
5. Run `supabase/migrations/20260710020000_museum_sample_artifact_overrides.sql`.
6. Run `supabase/migrations/20260711010000_remove_legacy_sample_artifacts.sql`.
7. Run `supabase/migrations/20260713010000_artifact_storage_images.sql`.
8. Run `supabase/migrations/20260714010000_allow_jpeg_storage_variants.sql`.
9. Run `supabase/migrations/20260714020000_museum_categories.sql`.
10. Run `supabase/migrations/20260715010000_artifact_visibility_and_sharing.sql`.
11. Deploy the Edge Function: `supabase functions deploy artifact-images --no-verify-jwt`.
12. Create or update the admin account from SQL Editor. Replace `<admin-password>` locally before running; do not commit the filled SQL:

```sql
set search_path = public, extensions;

insert into public.museum_admin_accounts (username, password_hash, display_name, is_active)
values ('admin', crypt('<admin-password>', gen_salt('bf', 12)), '默认管理员', true)
on conflict (username) do update
set
  password_hash = excluded.password_hash,
  display_name = excluded.display_name,
  is_active = true,
  updated_at = now();
```

13. In the app, open the site, choose `管理员登录` on the entry gate, sign in with username `admin`, then open `#manage`, test all three visibility states, add or rename a category, edit `黑神话：悟空`, and create a test artifact.

## Environment

Local `.env.local` may override the browser-safe defaults:

```bash
VITE_SUPABASE_URL=https://wjhktoqihszgdkxbanxu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Do not use `sb_secret_...` or legacy `service_role` keys in this Vite app.

## Historical Base64 Migration

The migration utility reads secrets only from the current process environment. Do not place them in Vite-prefixed variables or commit them.

Create a dedicated `sb_secret_...` key in Supabase Settings > API Keys, then set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the current shell without writing them to a file. Do not use a key that has appeared in chat, logs, or source control.

```bash
npm run migrate:artifact-images -- --dry-run

# After a database backup:
npm run migrate:artifact-images -- --execute

# Only after production image verification:
npm run migrate:artifact-images -- --cleanup --backup-confirmed
```

`--execute` is idempotent and keeps legacy Base64 as a temporary fallback. `--cleanup` verifies every referenced Storage object before clearing legacy payloads. Never run cleanup without a verified database backup. The legacy `SUPABASE_SERVICE_ROLE_KEY` variable remains a temporary compatibility fallback but should not be used for new operations.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Browser check: after clearing `mxren-museum.access-mode.v1`, the entry gate is the only visible experience and the museum shell is inert.
- Browser check: choosing `游客进入` stores guest mode in the current browser and allows read-only access to the home page, collection, and detail dialog after refresh.
- Guest check: `#manage` shows read-only status and hides create/edit/delete/upload controls.
- Switch check: choosing `切换身份` clears guest mode and returns to the entry gate.
- Auth check: invalid username/password returns to the entry gate and exposes no management controls.
- Session check: deleting or expiring a row in `public.museum_admin_sessions` makes the stored browser admin session read-only again.
- Admin check: valid credentials can create, edit, delete, request signed uploads, and clean replaced objects; Postgres rows contain Storage paths rather than data URLs.
- Category check: the management select can add a category and rename the selected category; filters, counts, existing artifact labels, and refresh persistence stay in sync.
- Compatibility check: if Canvas cannot encode WebP, cover and gallery processing falls back to JPEG and stores `.jpg` paths accepted by the Bucket, Edge Function, and database validator.
- Built-in edit check: editing a sample artifact creates one row whose `source_artifact_id` matches the sample ID; the gallery keeps one card, and `恢复内置` deletes the override and restores the original content.
- Visibility check: guests cannot list or directly query drafts; unlisted artifacts stay out of home/featured/collection but open through `#artifact/{id}`; admins can preview all states.
- Deep-link check: opening a card updates the hash, refresh restores the dialog, copy-link uses the absolute site URL, and closing returns to the originating route.

## Failure Modes

- Missing table or policy: the app falls back to `browser-local storage`.
- Missing guest access key: visitors return to the entry gate until they choose `游客进入` again.
- Missing password-account migration: admin login fails because the `verify_museum_admin_login` RPC does not exist.
- Missing sample-override migration: built-in artifacts remain visible, but attempting to save an edit cannot create the required `source_artifact_id` override.
- Missing legacy-sample cleanup migration: removed bundled artifacts stay hidden in the frontend, but historical override rows remain in `public.artifacts` until the cleanup SQL is applied.
- Missing admin account row: admin login fails and the app remains locked/read-only.
- Expired admin session: the app clears the stored session and returns to guest read-only mode.
- GitHub Pages deployment does not need a server change; the browser bundle talks to Supabase directly.
- Missing Edge Function or Storage migration: metadata remains readable, but new image uploads fail without storing a partial artifact row.
- Missing category migration: built-in categories remain readable as a frontend fallback, but adding or renaming a category fails safely without changing artifact data.
- Missing visibility migration: the frontend temporarily falls back to legacy published reads, while remote deep links and visibility writes remain unavailable until the migration is applied.
