alter table public.artifacts
add column if not exists visibility text not null default 'published';

alter table public.artifacts
drop constraint if exists artifacts_visibility_check;

alter table public.artifacts
add constraint artifacts_visibility_check
check (visibility in ('draft', 'published', 'unlisted'));

create index if not exists artifacts_visibility_created_at_idx
on public.artifacts (visibility, created_at);

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
  where has_admin_session or artifact.visibility = 'published'
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
  where (
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
    and artifact.visibility <> 'published';
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
begin
  perform public.assert_museum_admin_session(input_session_token);
  perform public.validate_museum_artifact_images(target_id, artifact_row, false);

  insert into public.artifacts (
    id, source_artifact_id, owner_id, title, category, category_label, volume, year, medium, rarity,
    featured, visibility, symbol, cover_alt, cover_image, cover_storage_path, cover_thumbnail_storage_path,
    gallery_images, palette, summary, note
  )
  values (
    target_id,
    nullif(artifact_row ->> 'source_artifact_id', ''),
    null,
    artifact_row ->> 'title',
    artifact_row ->> 'category',
    artifact_row ->> 'category_label',
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
    coalesce(artifact_row ->> 'note', '')
  )
  on conflict (source_artifact_id) where source_artifact_id is not null
  do update set
    title = excluded.title,
    category = excluded.category,
    category_label = excluded.category_label,
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
    note = excluded.note
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
  current_artifact public.artifacts;
  legacy_values_unchanged boolean;
begin
  perform public.assert_museum_admin_session(input_session_token);

  select * into current_artifact from public.artifacts where id = artifact_id;
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

  update public.artifacts
  set
    source_artifact_id = coalesce(nullif(artifact_row ->> 'source_artifact_id', ''), source_artifact_id),
    title = artifact_row ->> 'title',
    category = artifact_row ->> 'category',
    category_label = artifact_row ->> 'category_label',
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
  returning * into updated_artifact;

  if updated_artifact.id is null then
    raise exception 'Museum artifact not found' using errcode = 'P0002';
  end if;
  return updated_artifact;
end;
$$;

drop policy if exists "public can read artifacts" on public.artifacts;
revoke select on public.artifacts from anon, authenticated;

revoke all on function public.load_museum_artifacts(text) from public;
revoke all on function public.load_museum_artifact(text, text) from public;
revoke all on function public.load_museum_hidden_source_artifact_ids() from public;

grant execute on function public.load_museum_artifacts(text) to anon, authenticated;
grant execute on function public.load_museum_artifact(text, text) to anon, authenticated;
grant execute on function public.load_museum_hidden_source_artifact_ids() to anon, authenticated;
grant execute on function public.create_museum_artifact(text, jsonb) to anon, authenticated;
grant execute on function public.update_museum_artifact(text, uuid, jsonb) to anon, authenticated;
