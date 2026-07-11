alter table public.artifacts
add column if not exists source_artifact_id text;

create unique index if not exists artifacts_source_artifact_id_unique
on public.artifacts (source_artifact_id)
where source_artifact_id is not null;

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
    source_artifact_id,
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
    artifact_row ->> 'symbol',
    artifact_row ->> 'cover_alt',
    coalesce(artifact_row ->> 'cover_image', ''),
    nullif(artifact_row ->> 'cover_storage_path', ''),
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
    symbol = excluded.symbol,
    cover_alt = excluded.cover_alt,
    cover_image = excluded.cover_image,
    cover_storage_path = excluded.cover_storage_path,
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
begin
  perform public.assert_museum_admin_session(input_session_token);

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

grant execute on function public.create_museum_artifact(text, jsonb) to anon, authenticated;
grant execute on function public.update_museum_artifact(text, uuid, jsonb) to anon, authenticated;
