grant select on table public.museum_admins to authenticated;

drop policy if exists "museum admins can read themselves" on public.museum_admins;
create policy "museum admins can read themselves"
on public.museum_admins
for select
to authenticated
using (user_id = auth.uid());
