update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg', 'image/gif']
where id = 'artifact-images';

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
  display_pattern text := '^' || expected_prefix || '[0-9a-fA-F-]{36}/display\.(webp|jpg|gif)$';
  thumbnail_pattern text := '^' || expected_prefix || '[0-9a-fA-F-]{36}/thumbnail\.(webp|jpg)$';
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
