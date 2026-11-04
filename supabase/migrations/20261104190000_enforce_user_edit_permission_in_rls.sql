drop policy profiles_update_name_approved_admin
on public.profiles;

create policy profiles_update_name_with_permission
on public.profiles
for update
to authenticated
using (
  (select public.is_approved_superadmin())
  or (
    (select public.is_approved_admin())
    and exists (
      select 1
      from public.module_permissions as permission
      where permission.user_id = (select auth.uid())
        and permission.module_name = 'users'
        and permission.can_edit
    )
  )
)
with check (
  (select public.is_approved_superadmin())
  or (
    (select public.is_approved_admin())
    and exists (
      select 1
      from public.module_permissions as permission
      where permission.user_id = (select auth.uid())
        and permission.module_name = 'users'
        and permission.can_edit
    )
  )
);
