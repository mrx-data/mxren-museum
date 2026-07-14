alter table public.artifacts
add column if not exists cover_thumbnail_storage_path text;

update storage.buckets
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/webp', 'image/gif']
where id = 'artifact-images';

drop policy if exists "museum admins can upload artifact images" on storage.objects;
drop policy if exists "museum admins can update artifact images" on storage.objects;
drop policy if exists "museum admins can delete artifact images" on storage.objects;

create or replace function public.validate_museum_artifact_images(
  artifact_id uuid,
  artifact_row jsonb,
  allow_unchanged_legacy boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_prefix text := format('artifacts/%s/', artifact_id);
  cover_path text := nullif(artifact_row ->> 'cover_storage_path', '');
  thumbnail_path text := nullif(artifact_row ->> 'cover_thumbnail_storage_path', '');
  display_pattern text := '^' || expected_prefix || '[0-9a-fA-F-]{36}/display\.(webp|gif)$';
  thumbnail_pattern text := '^' || expected_prefix || '[0-9a-fA-F-]{36}/thumbnail\.webp$';
  gallery_image jsonb;
begin
  if jsonb_typeof(coalesce(artifact_row -> 'gallery_images', '[]'::jsonb)) <> 'array' then
    raise exception 'Gallery images must be an array' using errcode = '22023';
  end if;

  if not allow_unchanged_legacy and coalesce(artifact_row ->> 'cover_image', '') ~* '^data:image/' then
    raise exception 'Base64 cover images are no longer accepted' using errcode = '22023';
  end if;

  if cover_path is not null and cover_path !~ display_pattern then
    raise exception 'Cover storage path does not belong to this artifact' using errcode = '22023';
  end if;
  if thumbnail_path is not null and thumbnail_path !~ thumbnail_pattern then
    raise exception 'Cover thumbnail path does not belong to this artifact' using errcode = '22023';
  end if;

  for gallery_image in select value from jsonb_array_elements(coalesce(artifact_row -> 'gallery_images', '[]'::jsonb))
  loop
    if not allow_unchanged_legacy and coalesce(gallery_image ->> 'src', '') ~* '^data:image/' then
      raise exception 'Base64 gallery images are no longer accepted' using errcode = '22023';
    end if;
    if nullif(gallery_image ->> 'storagePath', '') is not null
      and (gallery_image ->> 'storagePath') !~ display_pattern
    then
      raise exception 'Gallery storage path does not belong to this artifact' using errcode = '22023';
    end if;
  end loop;
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
begin
  perform public.assert_museum_admin_session(input_session_token);
  perform public.validate_museum_artifact_images(target_id, artifact_row, false);

  insert into public.artifacts (
    id, source_artifact_id, owner_id, title, category, category_label, volume, year, medium, rarity,
    featured, symbol, cover_alt, cover_image, cover_storage_path, cover_thumbnail_storage_path,
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

revoke all on function public.validate_museum_artifact_images(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.create_museum_artifact(text, jsonb) to anon, authenticated;
grant execute on function public.update_museum_artifact(text, uuid, jsonb) to anon, authenticated;
