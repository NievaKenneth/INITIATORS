
-- Allow approved admins and superadmins to view user profiles.
create or replace function public.is_approved_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role in ('admin', 'superadmin')
      and profile.status = 'approved'
  );
$$;

revoke all on function public.is_approved_admin()
from public, anon, authenticated;

grant execute on function public.is_approved_admin()
to authenticated;

-- Allow approved admins to view all profiles.
create policy profiles_select_approved_admin
on public.profiles
for select
to authenticated
using ((select public.is_approved_admin()));

-- Allow approved admins to edit profile names only.
-- Existing column-level grants still restrict which columns
-- authenticated users can update.
create policy profiles_update_name_approved_admin
on public.profiles
for update
to authenticated
using ((select public.is_approved_admin()))
with check ((select public.is_approved_admin()));
