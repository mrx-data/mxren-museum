create extension if not exists pgcrypto;

alter table public.artifacts
alter column owner_id drop not null;

create table if not exists public.museum_admin_accounts (
  username text primary key check (username = lower(username) and username ~ '^[a-z0-9._-]{3,64}$'),
  password_hash text not null,
  display_name text not null default '管理员',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.museum_admin_sessions (
  token_hash text primary key,
  username text not null references public.museum_admin_accounts(username) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

drop trigger if exists set_museum_admin_accounts_updated_at on public.museum_admin_accounts;
create trigger set_museum_admin_accounts_updated_at
before update on public.museum_admin_accounts
for each row
execute function public.set_updated_at();

alter table public.museum_admin_accounts enable row level security;
alter table public.museum_admin_sessions enable row level security;

revoke all on public.museum_admin_accounts from anon, authenticated;
revoke all on public.museum_admin_sessions from anon, authenticated;

create or replace function public.museum_admin_session_username(input_session_token text)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select username
  from public.museum_admin_sessions
  where token_hash = encode(digest(coalesce(input_session_token, ''), 'sha256'), 'hex')
    and expires_at > now()
  limit 1;
$$;

create or replace function public.verify_museum_admin_session(input_session_token text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select public.museum_admin_session_username(input_session_token) is not null;
$$;

create or replace function public.verify_museum_admin_login(input_username text, input_password text)
returns table (
  username text,
  display_name text,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  admin_account public.museum_admin_accounts%rowtype;
  issued_token text;
  issued_expires_at timestamptz;
begin
  delete from public.museum_admin_sessions
  where museum_admin_sessions.expires_at <= now();

  select *
  into admin_account
  from public.museum_admin_accounts
  where museum_admin_accounts.username = lower(trim(input_username))
    and museum_admin_accounts.is_active
  limit 1;

  if not found then
    return;
  end if;

  if admin_account.password_hash <> crypt(coalesce(input_password, ''), admin_account.password_hash) then
    return;
  end if;

  issued_token := encode(gen_random_bytes(32), 'hex');
  issued_expires_at := now() + interval '12 hours';

  insert into public.museum_admin_sessions (token_hash, username, expires_at)
  values (encode(digest(issued_token, 'sha256'), 'hex'), admin_account.username, issued_expires_at);

  return query
  select admin_account.username, admin_account.display_name, issued_token, issued_expires_at;
end;
$$;

create or replace function public.clear_museum_admin_session(input_session_token text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from public.museum_admin_sessions
  where token_hash = encode(digest(coalesce(input_session_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.assert_museum_admin_session(input_session_token text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  session_username text;
begin
  session_username := public.museum_admin_session_username(input_session_token);
  if session_username is null then
    raise exception 'Invalid or expired museum admin session' using errcode = '28000';
  end if;
  return session_username;
end;
$$;

create or replace function public.create_museum_artifact(input_session_token text, artifact_row jsonb)
returns public.artifacts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inserted_artifact public.artifacts;
begin
  perform public.assert_museum_admin_session(input_session_token);

  insert into public.artifacts (
    id,
    owner_id,
    title,
    category,
    category_label,
    volume,
    year,
    medium,
    rarity,
    featured,
    symbol,
    cover_alt,
    cover_image,
    cover_storage_path,
    gallery_images,
    palette,
    summary,
    note
  )
  values (
    coalesce(nullif(artifact_row ->> 'id', '')::uuid, gen_random_uuid()),
    null,
    artifact_row ->> 'title',
    artifact_row ->> 'category',
    artifact_row ->> 'category_label',
    artifact_row ->> 'volume',
    artifact_row ->> 'year',
    artifact_row ->> 'medium',
    artifact_row ->> 'rarity',
    coalesce((artifact_row ->> 'featured')::boolean, false),
    artifact_row ->> 'symbol',
    artifact_row ->> 'cover_alt',
    coalesce(artifact_row ->> 'cover_image', ''),
    nullif(artifact_row ->> 'cover_storage_path', ''),
    coalesce(artifact_row -> 'gallery_images', '[]'::jsonb),
    coalesce(artifact_row -> 'palette', '{}'::jsonb),
    artifact_row ->> 'summary',
    coalesce(artifact_row ->> 'note', '')
  )
  returning * into inserted_artifact;

  return inserted_artifact;
end;
$$;

create or replace function public.update_museum_artifact(input_session_token text, artifact_id uuid, artifact_row jsonb)
returns public.artifacts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  updated_artifact public.artifacts;
begin
  perform public.assert_museum_admin_session(input_session_token);

  update public.artifacts
  set
    title = artifact_row ->> 'title',
    category = artifact_row ->> 'category',
    category_label = artifact_row ->> 'category_label',
    volume = artifact_row ->> 'volume',
    year = artifact_row ->> 'year',
    medium = artifact_row ->> 'medium',
    rarity = artifact_row ->> 'rarity',
    featured = coalesce((artifact_row ->> 'featured')::boolean, false),
    symbol = artifact_row ->> 'symbol',
    cover_alt = artifact_row ->> 'cover_alt',
    cover_image = coalesce(artifact_row ->> 'cover_image', ''),
    cover_storage_path = nullif(artifact_row ->> 'cover_storage_path', ''),
    gallery_images = coalesce(artifact_row -> 'gallery_images', '[]'::jsonb),
    palette = coalesce(artifact_row -> 'palette', '{}'::jsonb),
    summary = artifact_row ->> 'summary',
    note = coalesce(artifact_row ->> 'note', '')
  where id = artifact_id
  returning * into updated_artifact;

  if updated_artifact.id is null then
    raise exception 'Museum artifact not found' using errcode = 'P0002';
  end if;

  return updated_artifact;
end;
$$;

create or replace function public.delete_museum_artifact(input_session_token text, artifact_id uuid)
returns public.artifacts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  deleted_artifact public.artifacts;
begin
  perform public.assert_museum_admin_session(input_session_token);

  delete from public.artifacts
  where id = artifact_id
  returning * into deleted_artifact;

  if deleted_artifact.id is null then
    raise exception 'Museum artifact not found' using errcode = 'P0002';
  end if;

  return deleted_artifact;
end;
$$;

revoke all on function public.museum_admin_session_username(text) from public, anon, authenticated;
revoke all on function public.assert_museum_admin_session(text) from public, anon, authenticated;

grant execute on function public.verify_museum_admin_session(text) to anon, authenticated;
grant execute on function public.verify_museum_admin_login(text, text) to anon, authenticated;
grant execute on function public.clear_museum_admin_session(text) to anon, authenticated;
grant execute on function public.create_museum_artifact(text, jsonb) to anon, authenticated;
grant execute on function public.update_museum_artifact(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.delete_museum_artifact(text, uuid) to anon, authenticated;
