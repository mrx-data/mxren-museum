alter table public.artifacts
drop constraint if exists artifacts_category_check;

create table if not exists public.museum_categories (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  label text not null check (char_length(trim(label)) between 1 and 40),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists museum_categories_label_unique
on public.museum_categories (lower(label));

insert into public.museum_categories (id, label, sort_order)
values
  ('games', '游戏藏品', 10),
  ('landscapes', '风景切片', 20),
  ('personal-works', '个人作品', 30)
on conflict (id) do nothing;

drop trigger if exists set_museum_categories_updated_at on public.museum_categories;
create trigger set_museum_categories_updated_at
before update on public.museum_categories
for each row
execute function public.set_updated_at();

alter table public.museum_categories enable row level security;

drop policy if exists "museum categories are publicly readable" on public.museum_categories;
create policy "museum categories are publicly readable"
on public.museum_categories
for select
to anon, authenticated
using (true);

revoke all on public.museum_categories from anon, authenticated;
grant select on public.museum_categories to anon, authenticated;

create or replace function public.save_museum_category(
  input_session_token text,
  input_category_id text,
  input_category_label text
)
returns public.museum_categories
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_id text := lower(trim(input_category_id));
  normalized_label text := trim(input_category_label);
  saved_category public.museum_categories;
  next_sort_order integer;
begin
  perform public.assert_museum_admin_session(input_session_token);

  if normalized_id !~ '^[a-z0-9][a-z0-9-]{2,63}$' then
    raise exception '类别标识无效' using errcode = '22023';
  end if;

  if char_length(normalized_label) < 1 or char_length(normalized_label) > 40 then
    raise exception '类别名称需为 1 至 40 个字符' using errcode = '22023';
  end if;

  select coalesce(max(sort_order), 0) + 10
  into next_sort_order
  from public.museum_categories;

  insert into public.museum_categories (id, label, sort_order)
  values (normalized_id, normalized_label, next_sort_order)
  on conflict (id) do update
  set label = excluded.label
  returning * into saved_category;

  update public.artifacts
  set category_label = normalized_label
  where category = normalized_id
    and category_label is distinct from normalized_label;

  return saved_category;
end;
$$;

revoke all on function public.save_museum_category(text, text, text) from public;
grant execute on function public.save_museum_category(text, text, text) to anon, authenticated;
