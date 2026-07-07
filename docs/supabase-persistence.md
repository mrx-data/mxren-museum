# Supabase Persistence Runbook

mxren-museum remains a static GitHub Pages site. Supabase provides the runtime persistence layer for managed artifacts:

- Auth: the full site is hidden behind an entry gate; visitors enter with one click, while admins sign in with Supabase email/password for write operations.
- Postgres: `public.artifacts` stores artifact metadata.
- Storage: `artifact-images` stores uploaded cover and gallery images.
- RLS: public reads are allowed; writes require a signed-in user listed in `public.museum_admins`.
- Access roles: `locked` hides the museum, `guest` is read-only, and `admin` is granted only after the signed-in Supabase Auth user is found in `public.museum_admins`.

## One-Time Setup

1. Open the Supabase SQL Editor for `https://wjhktoqihszgdkxbanxu.supabase.co`.
2. Run `supabase/migrations/20260706000000_museum_artifact_persistence.sql`.
3. Run `supabase/migrations/20260706010000_museum_admin_role_lookup.sql`.
4. Create or invite the admin user in Supabase Auth.
5. Copy the admin user's UUID.
6. Run:

```sql
insert into public.museum_admins (user_id)
values ('<admin-user-uuid>')
on conflict (user_id) do nothing;
```

7. In the app, open the site, choose `管理员登录` on the entry gate, sign in with that Supabase Auth account, then open `#manage` and create a test artifact.

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
- Auth check: non-signed-in users cannot create, update, delete, or upload managed artifacts.
- Role check: signed-in users missing from `public.museum_admins` remain read-only.
- Admin check: signed-in users listed in `public.museum_admins` can create, edit, delete, and upload images.

## Failure Modes

- Missing table or policy: the app falls back to `browser-local storage`.
- Missing guest access key: visitors return to the entry gate until they choose `游客进入` again.
- Missing admin role lookup grant: sign-in succeeds, but the app cannot verify admin access and stays read-only.
- Missing admin row: sign-in succeeds, but the app remains read-only and writes fail through RLS.
- Storage policy mismatch: artifact row may save, but image upload fails before insert/update completes.
- GitHub Pages deployment does not need a server change; the browser bundle talks to Supabase directly.
