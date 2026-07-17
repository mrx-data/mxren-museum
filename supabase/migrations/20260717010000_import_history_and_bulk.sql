create table if not exists public.museum_artifact_versions (
  id bigint generated always as identity primary key,
  artifact_id uuid not null,
  operation text not null default 'update' check (operation in ('update', 'trash', 'restore', 'purge')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists museum_artifact_versions_artifact_idx
on public.museum_artifact_versions (artifact_id, created_at desc);

alter table public.museum_artifact_versions enable row level security;
revoke all on public.museum_artifact_versions from anon, authenticated;

create or replace function public.capture_museum_artifact_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  change_operation text := 'update';
begin
  if tg_op = 'DELETE' then
    change_operation := 'purge';
  elsif old.deleted_at is null and new.deleted_at is not null then
    change_operation := 'trash';
  elsif old.deleted_at is not null and new.deleted_at is null then
    change_operation := 'restore';
  end if;

  insert into public.museum_artifact_versions (artifact_id, operation, snapshot)
  values (old.id, change_operation, to_jsonb(old));
  delete from public.museum_artifact_versions version
  where version.artifact_id = old.id
    and version.id in (
      select stale.id
      from public.museum_artifact_versions stale
      where stale.artifact_id = old.id
      order by stale.created_at desc, stale.id desc
      offset 50
    );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists capture_museum_artifact_version on public.artifacts;
create trigger capture_museum_artifact_version
after update or delete on public.artifacts
for each row execute function public.capture_museum_artifact_version();

create or replace function public.load_museum_artifact_versions(
  input_session_token text,
  input_artifact_id uuid,
  input_limit integer default 20
)
returns table (
  id bigint,
  artifact_id uuid,
  operation text,
  snapshot jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  perform public.assert_museum_admin_session(input_session_token);
  return query
  select version.id, version.artifact_id, version.operation, version.snapshot, version.created_at
  from public.museum_artifact_versions version
  where version.artifact_id = input_artifact_id
  order by version.created_at desc
  limit greatest(1, least(coalesce(input_limit, 20), 50));
end;
$$;

create or replace function public.restore_museum_artifact_version(
  input_session_token text,
  input_version_id bigint
)
returns public.artifacts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  version_record public.museum_artifact_versions;
  artifact_row jsonb;
  restored_artifact public.artifacts;
begin
  perform public.assert_museum_admin_session(input_session_token);
  select * into version_record
  from public.museum_artifact_versions
  where id = input_version_id;
  if version_record.id is null then
    raise exception 'Museum artifact version not found' using errcode = 'P0002';
  end if;

  artifact_row := version_record.snapshot;
  perform public.validate_museum_artifact_images(version_record.artifact_id, artifact_row, true);

  update public.artifacts
  set
    source_artifact_id = nullif(artifact_row ->> 'source_artifact_id', ''),
    title = artifact_row ->> 'title',
    category = artifact_row ->> 'category',
    category_label = artifact_row ->> 'category_label',
    tags = coalesce(array(select jsonb_array_elements_text(coalesce(artifact_row -> 'tags', '[]'::jsonb))), '{}'::text[]),
    artifact_date = nullif(artifact_row ->> 'artifact_date', '')::date,
    volume = artifact_row ->> 'volume',
    year = artifact_row ->> 'year',
    medium = artifact_row ->> 'medium',
    rarity = artifact_row ->> 'rarity',
    featured = coalesce((artifact_row ->> 'featured')::boolean, false),
    visibility = coalesce(nullif(artifact_row ->> 'visibility', ''), 'draft'),
    symbol = artifact_row ->> 'symbol',
    cover_alt = artifact_row ->> 'cover_alt',
    cover_image = coalesce(artifact_row ->> 'cover_image', ''),
    cover_storage_path = nullif(artifact_row ->> 'cover_storage_path', ''),
    cover_thumbnail_storage_path = nullif(artifact_row ->> 'cover_thumbnail_storage_path', ''),
    gallery_images = coalesce(artifact_row -> 'gallery_images', '[]'::jsonb),
    palette = coalesce(artifact_row -> 'palette', '{}'::jsonb),
    summary = coalesce(artifact_row ->> 'summary', ''),
    note = coalesce(artifact_row ->> 'note', ''),
    deleted_at = null
  where id = version_record.artifact_id
  returning * into restored_artifact;

  if restored_artifact.id is null then
    raise exception 'Museum artifact not found' using errcode = 'P0002';
  end if;
  return restored_artifact;
end;
$$;

create or replace function public.batch_update_museum_artifacts(
  input_session_token text,
  input_artifact_ids uuid[],
  input_patch jsonb
)
returns setof public.artifacts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_visibility text := nullif(input_patch ->> 'visibility', '');
  normalized_category text := nullif(input_patch ->> 'category', '');
  normalized_category_label text := nullif(input_patch ->> 'categoryLabel', '');
  normalized_tags text[];
begin
  perform public.assert_museum_admin_session(input_session_token);
  if coalesce(cardinality(input_artifact_ids), 0) < 1 or cardinality(input_artifact_ids) > 100 then
    raise exception '请选择 1 至 100 件藏品' using errcode = '22023';
  end if;
  if normalized_visibility is not null and normalized_visibility not in ('draft', 'published', 'unlisted') then
    raise exception '陈列状态无效' using errcode = '22023';
  end if;
  if normalized_category is not null and normalized_category !~ '^[a-z0-9][a-z0-9-]{2,63}$' then
    raise exception '类别标识无效' using errcode = '22023';
  end if;
  if input_patch ? 'tags' then
    select coalesce(array_agg(tag order by first_seen), '{}'::text[])
    into normalized_tags
    from (
      select min(ordinality) first_seen, trim(value) tag
      from jsonb_array_elements_text(coalesce(input_patch -> 'tags', '[]'::jsonb)) with ordinality
      where char_length(trim(value)) between 1 and 24
      group by lower(trim(value)), trim(value)
      order by min(ordinality)
      limit 12
    ) normalized;
  end if;

  if coalesce((input_patch ->> 'trash')::boolean, false) then
    return query
    update public.artifacts
    set deleted_at = now()
    where id = any(input_artifact_ids) and deleted_at is null
    returning *;
    return;
  end if;

  return query
  update public.artifacts
  set
    visibility = coalesce(normalized_visibility, visibility),
    category = coalesce(normalized_category, category),
    category_label = coalesce(normalized_category_label, category_label),
    tags = case when input_patch ? 'tags' then normalized_tags else tags end
  where id = any(input_artifact_ids) and deleted_at is null
  returning *;
end;
$$;

create or replace function public.museum_import_artifact_row(import_record jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'id', import_record ->> 'remoteId',
    'source_artifact_id', import_record ->> 'sourceArtifactId',
    'title', import_record ->> 'title',
    'category', import_record ->> 'category',
    'category_label', import_record ->> 'categoryLabel',
    'tags', coalesce(import_record -> 'tags', '[]'::jsonb),
    'artifact_date', import_record ->> 'artifactDate',
    'volume', import_record ->> 'volume',
    'year', import_record ->> 'year',
    'medium', import_record ->> 'medium',
    'rarity', import_record ->> 'rarity',
    'featured', coalesce(import_record -> 'featured', 'false'::jsonb),
    'visibility', import_record ->> 'visibility',
    'symbol', import_record ->> 'symbol',
    'cover_alt', import_record ->> 'coverAlt',
    'cover_image', coalesce(import_record ->> 'coverImage', ''),
    'cover_storage_path', import_record ->> 'coverStoragePath',
    'cover_thumbnail_storage_path', import_record ->> 'coverThumbnailStoragePath',
    'gallery_images', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'src', coalesce(image ->> 'src', ''),
          'storagePath', image ->> 'storagePath',
          'alt', image ->> 'alt',
          'label', image ->> 'label'
        ))
        from jsonb_array_elements(coalesce(import_record -> 'galleryImages', '[]'::jsonb)) image
      ),
      '[]'::jsonb
    ),
    'palette', coalesce(import_record -> 'palette', '{}'::jsonb),
    'summary', coalesce(import_record ->> 'summary', ''),
    'note', coalesce(import_record ->> 'note', '')
  );
$$;

create or replace function public.apply_museum_import(
  input_session_token text,
  import_payload jsonb,
  conflict_strategy text default 'skip',
  input_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  item jsonb;
  artifact_row jsonb;
  target_id uuid;
  existing_id uuid;
  is_trash boolean;
  created_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := 0;
  trashed_count integer := 0;
  category_count integer := 0;
  exhibition_count integer := 0;
begin
  perform public.assert_museum_admin_session(input_session_token);
  if import_payload ->> 'format' <> 'mxren-museum.export.v1' then
    raise exception '不支持的馆藏导入格式' using errcode = '22023';
  end if;
  if conflict_strategy not in ('skip', 'overwrite') then
    raise exception '导入冲突策略无效' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(import_payload -> 'artifacts', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(import_payload -> 'trash', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(import_payload -> 'artifacts', '[]'::jsonb)) > 5000
    or jsonb_array_length(coalesce(import_payload -> 'trash', '[]'::jsonb)) > 5000 then
    raise exception '馆藏导入记录无效或超出限制' using errcode = '22023';
  end if;

  for item, is_trash in
    select value, false from jsonb_array_elements(coalesce(import_payload -> 'artifacts', '[]'::jsonb))
    union all
    select value, true from jsonb_array_elements(coalesce(import_payload -> 'trash', '[]'::jsonb))
  loop
    if nullif(item ->> 'remoteId', '') is null then
      skipped_count := skipped_count + 1;
      continue;
    end if;
    target_id := (item ->> 'remoteId')::uuid;
    artifact_row := public.museum_import_artifact_row(item);
    if char_length(trim(coalesce(artifact_row ->> 'title', ''))) not between 1 and 120 then
      raise exception '导入藏品标题无效' using errcode = '22023';
    end if;

    select artifact.id into existing_id
    from public.artifacts artifact
    where artifact.id = target_id
      or (
        nullif(artifact_row ->> 'source_artifact_id', '') is not null
        and artifact.source_artifact_id = artifact_row ->> 'source_artifact_id'
      )
    limit 1;

    if existing_id is not null and conflict_strategy = 'skip' then
      skipped_count := skipped_count + 1;
      continue;
    end if;
    perform public.validate_museum_artifact_images(coalesce(existing_id, target_id), artifact_row, false);
    if existing_id is null then
      created_count := created_count + 1;
    else
      updated_count := updated_count + 1;
    end if;
    if is_trash then trashed_count := trashed_count + 1; end if;
    if input_dry_run then continue; end if;

    if existing_id is null then
      select (public.create_museum_artifact(input_session_token, artifact_row)).id into existing_id;
    else
      if exists(select 1 from public.artifacts where id = existing_id and deleted_at is not null) then
        perform public.restore_museum_artifact(input_session_token, existing_id);
      end if;
      perform public.update_museum_artifact(input_session_token, existing_id, artifact_row);
    end if;
    if is_trash then
      perform public.trash_museum_artifact(input_session_token, existing_id);
    end if;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(import_payload -> 'categories', '[]'::jsonb))
  loop
    if lower(trim(coalesce(item ->> 'id', ''))) !~ '^[a-z0-9][a-z0-9-]{2,63}$'
      or char_length(trim(coalesce(item ->> 'label', ''))) not between 1 and 40 then
      raise exception '导入类别格式无效' using errcode = '22023';
    end if;
    if conflict_strategy = 'skip' and exists(
      select 1 from public.museum_categories where id = lower(trim(item ->> 'id'))
    ) then
      continue;
    end if;
    category_count := category_count + 1;
    if not input_dry_run then
      perform public.save_museum_category(input_session_token, item ->> 'id', item ->> 'label');
    end if;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(import_payload -> 'exhibitions', '[]'::jsonb))
  loop
    if lower(trim(coalesce(item ->> 'id', ''))) !~ '^[a-z0-9][a-z0-9-]{2,63}$'
      or char_length(trim(coalesce(item ->> 'title', ''))) not between 1 and 80
      or coalesce(item ->> 'visibility', '') not in ('draft', 'published', 'unlisted')
      or jsonb_typeof(coalesce(item -> 'artifactIds', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(item -> 'artifactIds', '[]'::jsonb)) not between 1 and 50 then
      raise exception '导入专题格式无效' using errcode = '22023';
    end if;
    if conflict_strategy = 'skip' and exists(
      select 1 from public.museum_exhibitions where id = lower(trim(item ->> 'id'))
    ) then
      continue;
    end if;
    exhibition_count := exhibition_count + 1;
    if not input_dry_run then
      perform public.save_museum_exhibition(
        input_session_token,
        jsonb_build_object(
          'id', item ->> 'id',
          'title', item ->> 'title',
          'summary', coalesce(item ->> 'summary', ''),
          'note', coalesce(item ->> 'note', ''),
          'visibility', item ->> 'visibility',
          'artifact_ids', coalesce(item -> 'artifactIds', '[]'::jsonb)
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'dryRun', input_dry_run,
    'strategy', conflict_strategy,
    'created', created_count,
    'updated', updated_count,
    'skipped', skipped_count,
    'trashed', trashed_count,
    'categories', category_count,
    'exhibitions', exhibition_count
  );
end;
$$;

revoke all on function public.capture_museum_artifact_version() from public, anon, authenticated;
revoke all on function public.load_museum_artifact_versions(text, uuid, integer) from public;
revoke all on function public.restore_museum_artifact_version(text, bigint) from public;
revoke all on function public.batch_update_museum_artifacts(text, uuid[], jsonb) from public;
revoke all on function public.museum_import_artifact_row(jsonb) from public, anon, authenticated;
revoke all on function public.apply_museum_import(text, jsonb, text, boolean) from public;

grant execute on function public.load_museum_artifact_versions(text, uuid, integer) to anon, authenticated;
grant execute on function public.restore_museum_artifact_version(text, bigint) to anon, authenticated;
grant execute on function public.batch_update_museum_artifacts(text, uuid[], jsonb) to anon, authenticated;
grant execute on function public.apply_museum_import(text, jsonb, text, boolean) to anon, authenticated;
