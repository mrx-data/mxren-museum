# Supabase Persistence Runbook

mxren-museum remains a static GitHub Pages site. Supabase provides the runtime persistence layer for managed artifacts and custom admin login:

- Auth: the full site is hidden behind an entry gate; visitors enter with one click, while admins sign in with a username/password stored in `public.museum_admin_accounts`.
- Postgres: `public.artifacts` stores artifact metadata.
- Built-in overrides: `source_artifact_id` links a cloud row to a TypeScript sample artifact, allowing edits without duplicate gallery cards; deleting the override restores the built-in version.
- Admin credentials: passwords are stored as `pgcrypto.crypt()` hashes; the frontend never reads the hash.
- Admin sessions: `public.museum_admin_sessions` stores hashed short-lived session tokens returned by `verify_museum_admin_login`.
- RLS/RPC: public reads are allowed; writes go through `create_museum_artifact`, `update_museum_artifact`, and `delete_museum_artifact` RPC functions after session verification.
- Access roles: `locked` hides the museum, `guest` is read-only, and `admin` is granted only after the admin session token is verified by `verify_museum_admin_session`.

## One-Time Setup

1. Open the Supabase SQL Editor for `https://wjhktoqihszgdkxbanxu.supabase.co`.
2. Run `supabase/migrations/20260706000000_museum_artifact_persistence.sql`.
3. Run `supabase/migrations/20260706010000_museum_admin_role_lookup.sql`.
4. Run `supabase/migrations/20260707010000_museum_admin_password_accounts.sql`.
5. Run `supabase/migrations/20260710020000_museum_sample_artifact_overrides.sql`.
6. Create or update the admin account from SQL Editor. Replace `<admin-password>` locally before running; do not commit the filled SQL:

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

7. In the app, open the site, choose `管理员登录` on the entry gate, sign in with username `admin`, then open `#manage`, edit one built-in artifact, and create a test artifact.

## Environment

Local `.env.local` may override the browser-safe defaults:

```bash
VITE_SUPABASE_URL=https://wjhktoqihszgdkxbanxu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Do not use `sb_secret_...` or legacy `service_role` keys in this Vite app.

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
- Admin check: valid `public.museum_admin_accounts` credentials can create, edit, delete, and upload images through database RPC.
- Built-in edit check: editing a sample artifact creates one row whose `source_artifact_id` matches the sample ID; the gallery keeps one card, and `恢复内置` deletes the override and restores the original content.

## Failure Modes

- Missing table or policy: the app falls back to `browser-local storage`.
- Missing guest access key: visitors return to the entry gate until they choose `游客进入` again.
- Missing password-account migration: admin login fails because the `verify_museum_admin_login` RPC does not exist.
- Missing sample-override migration: built-in artifacts remain visible, but attempting to save an edit cannot create the required `source_artifact_id` override.
- Missing admin account row: admin login fails and the app remains locked/read-only.
- Expired admin session: the app clears the stored session and returns to guest read-only mode.
- GitHub Pages deployment does not need a server change; the browser bundle talks to Supabase directly.
