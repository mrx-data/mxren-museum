alter table public.artifacts
add column if not exists tags text[] not null default '{}'::text[],
add column if not exists artifact_date date,
add column if not exists deleted_at timestamptz;

alter table public.artifacts
drop constraint if exists artifacts_tags_count_check;

alter table public.artifacts
add constraint artifacts_tags_count_check
check (cardinality(tags) <= 12);

create index if not exists artifacts_tags_idx on public.artifacts using gin (tags);
create index if not exists artifacts_artifact_date_idx on public.artifacts (artifact_date desc nulls last);
create index if not exists artifacts_deleted_at_idx on public.artifacts (deleted_at) where deleted_at is not null;

create table if not exists public.museum_exhibitions (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  title text not null check (char_length(trim(title)) between 1 and 80),
  summary text not null default '' check (char_length(summary) <= 280),
  note text not null default '' check (char_length(note) <= 4000),
  visibility text not null default 'draft' check (visibility in ('draft', 'published', 'unlisted')),
  artifact_ids jsonb not null default '[]'::jsonb check (
    jsonb_typeof(artifact_ids) = 'array'
    and jsonb_array_length(artifact_ids) <= 50
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_museum_exhibitions_updated_at on public.museum_exhibitions;
create trigger set_museum_exhibitions_updated_at
before update on public.museum_exhibitions
for each row execute function public.set_updated_at();

alter table public.museum_exhibitions enable row level security;
revoke all on public.museum_exhibitions from anon, authenticated;

create or replace function public.load_museum_artifacts(input_session_token text default null)
returns setof public.artifacts
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  has_admin_session boolean := public.museum_admin_session_username(input_session_token) is not null;
begin
  return query
  select artifact.*
  from public.artifacts artifact
  where artifact.deleted_at is null
    and (has_admin_session or artifact.visibility = 'published')
  order by artifact.created_at asc;
end;
$$;

create or replace function public.load_museum_artifact(
  input_artifact_id text,
  input_session_token text default null
)
returns setof public.artifacts
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  normalized_id text := trim(input_artifact_id);
  has_admin_session boolean := public.museum_admin_session_username(input_session_token) is not null;
begin
  return query
  select artifact.*
  from public.artifacts artifact
  where artifact.deleted_at is null
    and (
      artifact.id::text = normalized_id
      or artifact.source_artifact_id = normalized_id
    )
    and (
      has_admin_session
      or artifact.visibility in ('published', 'unlisted')
    )
  limit 1;
end;
$$;

create or replace function public.load_museum_hidden_source_artifact_ids()
returns table (source_artifact_id text)
language sql
stable
security definer
set search_path = public
as $$
  select artifact.source_artifact_id
  from public.artifacts artifact
  where artifact.source_artifact_id is not null
    and artifact.deleted_at is null
    and artifact.visibility <> 'published';
$$;

create or replace function public.load_museum_trash(input_session_token text)
returns setof public.artifacts
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  perform public.assert_museum_admin_session(input_session_token);
  return query
  select artifact.*
  from public.artifacts artifact
  where artifact.deleted_at is not null
  order by artifact.deleted_at desc;
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
  target_id uuid := coalesce(nullif(artifact_row ->> 'id', '')::uuid, gen_random_uuid());
  normalized_tags text[];
begin
  perform public.assert_museum_admin_session(input_session_token);
  perform public.validate_museum_artifact_images(target_id, artifact_row, false);

  select coalesce(array_agg(tag order by first_seen), '{}'::text[])
  into normalized_tags
  from (
    select min(ordinality) as first_seen, trim(value) as tag
    from jsonb_array_elements_text(coalesce(artifact_row -> 'tags', '[]'::jsonb)) with ordinality
    where char_length(trim(value)) between 1 and 24
    group by lower(trim(value)), trim(value)
    order by min(ordinality)
    limit 12
  ) normalized;

  insert into public.artifacts (
    id, source_artifact_id, owner_id, title, category, category_label, tags, artifact_date,
    volume, year, medium, rarity, featured, visibility, symbol, cover_alt, cover_image,
    cover_storage_path, cover_thumbnail_storage_path, gallery_images, palette, summary, note,
    deleted_at
  ) values (
    target_id,
    nullif(artifact_row ->> 'source_artifact_id', ''),
    null,
    artifact_row ->> 'title',
    artifact_row ->> 'category',
    artifact_row ->> 'category_label',
    normalized_tags,
    nullif(artifact_row ->> 'artifact_date', '')::date,
    artifact_row ->> 'volume',
    artifact_row ->> 'year',
    artifact_row ->> 'medium',
    artifact_row ->> 'rarity',
    coalesce((artifact_row ->> 'featured')::boolean, false),
    coalesce(nullif(artifact_row ->> 'visibility', ''), 'draft'),
    artifact_row ->> 'symbol',
    artifact_row ->> 'cover_alt',
    coalesce(artifact_row ->> 'cover_image', ''),
    nullif(artifact_row ->> 'cover_storage_path', ''),
    nullif(artifact_row ->> 'cover_thumbnail_storage_path', ''),
    coalesce(artifact_row -> 'gallery_images', '[]'::jsonb),
    coalesce(artifact_row -> 'palette', '{}'::jsonb),
    artifact_row ->> 'summary',
    coalesce(artifact_row ->> 'note', ''),
    null
  )
  on conflict (source_artifact_id) where source_artifact_id is not null
  do update set
    title = excluded.title,
    category = excluded.category,
    category_label = excluded.category_label,
    tags = excluded.tags,
    artifact_date = excluded.artifact_date,
    volume = excluded.volume,
    year = excluded.year,
    medium = excluded.medium,
    rarity = excluded.rarity,
    featured = excluded.featured,
    visibility = excluded.visibility,
    symbol = excluded.symbol,
    cover_alt = excluded.cover_alt,
    cover_image = excluded.cover_image,
    cover_storage_path = excluded.cover_storage_path,
    cover_thumbnail_storage_path = excluded.cover_thumbnail_storage_path,
    gallery_images = excluded.gallery_images,
    palette = excluded.palette,
    summary = excluded.summary,
    note = excluded.note,
    deleted_at = null
  returning * into inserted_artifact;

  return inserted_artifact;
end;
$$;

create or replace function public.update_museum_artifact(
  input_session_token text,
  artifact_id uuid,
  artifact_row jsonb
)
returns public.artifacts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  updated_artifact public.artifacts;
  current_artifact public.artifacts;
  legacy_values_unchanged boolean;
  normalized_tags text[];
begin
  perform public.assert_museum_admin_session(input_session_token);

  select * into current_artifact from public.artifacts where id = artifact_id and deleted_at is null;
  if current_artifact.id is null then
    raise exception 'Museum artifact not found' using errcode = 'P0002';
  end if;

  legacy_values_unchanged :=
    (
      coalesce(artifact_row ->> 'cover_image', '') !~* '^data:image/'
      or artifact_row ->> 'cover_image' = current_artifact.cover_image
    )
    and (
      not exists (
        select 1
        from jsonb_array_elements(coalesce(artifact_row -> 'gallery_images', '[]'::jsonb)) image
        where coalesce(image ->> 'src', '') ~* '^data:image/'
      )
      or coalesce(artifact_row -> 'gallery_images', '[]'::jsonb) = current_artifact.gallery_images
    );
  perform public.validate_museum_artifact_images(artifact_id, artifact_row, legacy_values_unchanged);

  select coalesce(array_agg(tag order by first_seen), '{}'::text[])
  into normalized_tags
  from (
    select min(ordinality) as first_seen, trim(value) as tag
    from jsonb_array_elements_text(coalesce(artifact_row -> 'tags', '[]'::jsonb)) with ordinality
    where char_length(trim(value)) between 1 and 24
    group by lower(trim(value)), trim(value)
    order by min(ordinality)
    limit 12
  ) normalized;

  update public.artifacts
  set
    source_artifact_id = coalesce(nullif(artifact_row ->> 'source_artifact_id', ''), source_artifact_id),
    title = artifact_row ->> 'title',
    category = artifact_row ->> 'category',
    category_label = artifact_row ->> 'category_label',
    tags = normalized_tags,
    artifact_date = nullif(artifact_row ->> 'artifact_date', '')::date,
    volume = artifact_row ->> 'volume',
    year = artifact_row ->> 'year',
    medium = artifact_row ->> 'medium',
    rarity = artifact_row ->> 'rarity',
    featured = coalesce((artifact_row ->> 'featured')::boolean, false),
    visibility = coalesce(nullif(artifact_row ->> 'visibility', ''), visibility),
    symbol = artifact_row ->> 'symbol',
    cover_alt = artifact_row ->> 'cover_alt',
    cover_image = coalesce(artifact_row ->> 'cover_image', ''),
    cover_storage_path = nullif(artifact_row ->> 'cover_storage_path', ''),
    cover_thumbnail_storage_path = nullif(artifact_row ->> 'cover_thumbnail_storage_path', ''),
    gallery_images = coalesce(artifact_row -> 'gallery_images', '[]'::jsonb),
    palette = coalesce(artifact_row -> 'palette', '{}'::jsonb),
    summary = artifact_row ->> 'summary',
    note = coalesce(artifact_row ->> 'note', '')
  where id = artifact_id
    and deleted_at is null
  returning * into updated_artifact;

  if updated_artifact.id is null then
    raise exception 'Museum artifact not found' using errcode = 'P0002';
  end if;
  return updated_artifact;
end;
$$;

create or replace function public.trash_museum_artifact(input_session_token text, artifact_id uuid)
returns public.artifacts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  trashed_artifact public.artifacts;
begin
  perform public.assert_museum_admin_session(input_session_token);
  update public.artifacts set deleted_at = now()
  where id = artifact_id and deleted_at is null
  returning * into trashed_artifact;
  if trashed_artifact.id is null then
    raise exception 'Museum artifact not found' using errcode = 'P0002';
  end if;
  return trashed_artifact;
end;
$$;

create or replace function public.delete_museum_artifact(input_session_token text, artifact_id uuid)
returns public.artifacts
language sql
security definer
set search_path = public, extensions
as $$
  select public.trash_museum_artifact(input_session_token, artifact_id);
$$;

create or replace function public.restore_museum_artifact(input_session_token text, artifact_id uuid)
returns public.artifacts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  restored_artifact public.artifacts;
begin
  perform public.assert_museum_admin_session(input_session_token);
  update public.artifacts set deleted_at = null
  where id = artifact_id and deleted_at is not null
  returning * into restored_artifact;
  if restored_artifact.id is null then
    raise exception 'Museum artifact not found' using errcode = 'P0002';
  end if;
  return restored_artifact;
end;
$$;

create or replace function public.purge_museum_artifact(input_session_token text, artifact_id uuid)
returns public.artifacts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  purged_artifact public.artifacts;
begin
  perform public.assert_museum_admin_session(input_session_token);
  delete from public.artifacts
  where id = artifact_id and deleted_at is not null
  returning * into purged_artifact;
  if purged_artifact.id is null then
    raise exception 'Museum artifact not found' using errcode = 'P0002';
  end if;
  return purged_artifact;
end;
$$;

create or replace function public.load_museum_exhibitions(input_session_token text default null)
returns setof public.museum_exhibitions
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  has_admin_session boolean := public.museum_admin_session_username(input_session_token) is not null;
begin
  return query
  select exhibition.*
  from public.museum_exhibitions exhibition
  where has_admin_session or exhibition.visibility = 'published'
  order by exhibition.created_at asc;
end;
$$;

create or replace function public.load_museum_exhibition(
  input_exhibition_id text,
  input_session_token text default null
)
returns setof public.museum_exhibitions
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  has_admin_session boolean := public.museum_admin_session_username(input_session_token) is not null;
begin
  return query
  select exhibition.*
  from public.museum_exhibitions exhibition
  where exhibition.id = trim(input_exhibition_id)
    and (has_admin_session or exhibition.visibility in ('published', 'unlisted'))
  limit 1;
end;
$$;

create or replace function public.save_museum_exhibition(
  input_session_token text,
  exhibition_row jsonb
)
returns public.museum_exhibitions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_id text := lower(trim(exhibition_row ->> 'id'));
  normalized_title text := trim(exhibition_row ->> 'title');
  normalized_visibility text := coalesce(nullif(exhibition_row ->> 'visibility', ''), 'draft');
  normalized_artifact_ids jsonb := coalesce(exhibition_row -> 'artifact_ids', '[]'::jsonb);
  saved_exhibition public.museum_exhibitions;
begin
  perform public.assert_museum_admin_session(input_session_token);
  if normalized_id !~ '^[a-z0-9][a-z0-9-]{2,63}$' then
    raise exception '专题标识需为 3 至 64 位小写字母、数字或连字符' using errcode = '22023';
  end if;
  if char_length(normalized_title) < 1 or char_length(normalized_title) > 80 then
    raise exception '专题标题需为 1 至 80 个字符' using errcode = '22023';
  end if;
  if normalized_visibility not in ('draft', 'published', 'unlisted') then
    raise exception '专题陈列状态无效' using errcode = '22023';
  end if;
  if jsonb_typeof(normalized_artifact_ids) <> 'array'
    or jsonb_array_length(normalized_artifact_ids) < 1
    or jsonb_array_length(normalized_artifact_ids) > 50
    or exists (
      select 1 from jsonb_array_elements(normalized_artifact_ids) item
      where jsonb_typeof(item) <> 'string' or char_length(trim(item #>> '{}')) = 0
    ) then
    raise exception '专题需包含 1 至 50 个有效藏品标识' using errcode = '22023';
  end if;

  insert into public.museum_exhibitions (id, title, summary, note, visibility, artifact_ids)
  values (
    normalized_id,
    normalized_title,
    left(coalesce(exhibition_row ->> 'summary', ''), 280),
    left(coalesce(exhibition_row ->> 'note', ''), 4000),
    normalized_visibility,
    normalized_artifact_ids
  )
  on conflict (id) do update set
    title = excluded.title,
    summary = excluded.summary,
    note = excluded.note,
    visibility = excluded.visibility,
    artifact_ids = excluded.artifact_ids
  returning * into saved_exhibition;
  return saved_exhibition;
end;
$$;

create or replace function public.delete_museum_exhibition(
  input_session_token text,
  input_exhibition_id text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.assert_museum_admin_session(input_session_token);
  delete from public.museum_exhibitions where id = trim(input_exhibition_id);
  if not found then
    raise exception 'Museum exhibition not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.load_museum_trash(text) from public;
revoke all on function public.trash_museum_artifact(text, uuid) from public;
revoke all on function public.restore_museum_artifact(text, uuid) from public;
revoke all on function public.purge_museum_artifact(text, uuid) from public;
revoke all on function public.load_museum_exhibitions(text) from public;
revoke all on function public.load_museum_exhibition(text, text) from public;
revoke all on function public.save_museum_exhibition(text, jsonb) from public;
revoke all on function public.delete_museum_exhibition(text, text) from public;

grant execute on function public.load_museum_trash(text) to anon, authenticated;
grant execute on function public.trash_museum_artifact(text, uuid) to anon, authenticated;
grant execute on function public.restore_museum_artifact(text, uuid) to anon, authenticated;
grant execute on function public.purge_museum_artifact(text, uuid) to anon, authenticated;
grant execute on function public.load_museum_exhibitions(text) to anon, authenticated;
grant execute on function public.load_museum_exhibition(text, text) to anon, authenticated;
grant execute on function public.save_museum_exhibition(text, jsonb) to anon, authenticated;
grant execute on function public.delete_museum_exhibition(text, text) to anon, authenticated;
