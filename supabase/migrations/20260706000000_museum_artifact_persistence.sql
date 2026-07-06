create extension if not exists pgcrypto;

create table if not exists public.museum_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_museum_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.museum_admins
    where user_id = auth.uid()
  );
$$;

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null check (category in ('games', 'landscapes', 'personal-works')),
  category_label text not null,
  volume text not null,
  year text not null,
  medium text not null,
  rarity text not null,
  featured boolean not null default false,
  symbol text not null,
  cover_alt text not null,
  cover_image text not null default '',
  cover_storage_path text,
  gallery_images jsonb not null default '[]'::jsonb,
  palette jsonb not null,
  summary text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_artifacts_updated_at on public.artifacts;
create trigger set_artifacts_updated_at
before update on public.artifacts
for each row
execute function public.set_updated_at();

alter table public.museum_admins enable row level security;
alter table public.artifacts enable row level security;

revoke all on public.museum_admins from anon, authenticated;
grant select on public.artifacts to anon, authenticated;
grant insert, update, delete on public.artifacts to authenticated;

drop policy if exists "museum admins can read themselves" on public.museum_admins;
create policy "museum admins can read themselves"
on public.museum_admins
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "public can read artifacts" on public.artifacts;
create policy "public can read artifacts"
on public.artifacts
for select
to anon, authenticated
using (true);

drop policy if exists "museum admins can insert artifacts" on public.artifacts;
create policy "museum admins can insert artifacts"
on public.artifacts
for insert
to authenticated
with check (owner_id = auth.uid() and public.is_museum_admin());

drop policy if exists "museum admins can update own artifacts" on public.artifacts;
create policy "museum admins can update own artifacts"
on public.artifacts
for update
to authenticated
using (owner_id = auth.uid() and public.is_museum_admin())
with check (owner_id = auth.uid() and public.is_museum_admin());

drop policy if exists "museum admins can delete own artifacts" on public.artifacts;
create policy "museum admins can delete own artifacts"
on public.artifacts
for delete
to authenticated
using (owner_id = auth.uid() and public.is_museum_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artifact-images',
  'artifact-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read artifact images" on storage.objects;
create policy "public can read artifact images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'artifact-images');

drop policy if exists "museum admins can upload artifact images" on storage.objects;
create policy "museum admins can upload artifact images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'artifact-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_museum_admin()
);

drop policy if exists "museum admins can update artifact images" on storage.objects;
create policy "museum admins can update artifact images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'artifact-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_museum_admin()
)
with check (
  bucket_id = 'artifact-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_museum_admin()
);

drop policy if exists "museum admins can delete artifact images" on storage.objects;
create policy "museum admins can delete artifact images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'artifact-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_museum_admin()
);
