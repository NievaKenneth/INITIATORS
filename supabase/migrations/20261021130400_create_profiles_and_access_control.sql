create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'user'
    constraint profiles_role_check
    check (role in ('superadmin', 'admin', 'user')),
  status text not null default 'pending'
    constraint profiles_status_check
    check (status in ('pending', 'approved', 'rejected', 'blocked')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint profiles_full_name_check
    check (full_name is null or pg_catalog.length(pg_catalog.btrim(full_name)) > 0)
);

create table public.module_permissions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module_name text not null
    constraint module_permissions_module_name_check
    check (
      pg_catalog.length(pg_catalog.btrim(module_name)) > 0
      and pg_catalog.length(module_name) <= 100
    ),
  can_view boolean not null default false,
  can_add boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint module_permissions_user_module_unique unique (user_id, module_name)
);

create table public.approval_logs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  approved_by uuid not null references public.profiles (id) on delete restrict,
  decision text not null
    constraint approval_logs_decision_check
    check (decision in ('approved', 'rejected')),
  notes text,
  created_at timestamptz not null default pg_catalog.now()
);

alter table public.profiles enable row level security;
alter table public.module_permissions enable row level security;
alter table public.approval_logs enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.module_permissions from public, anon, authenticated;
revoke all on table public.approval_logs from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;
grant select on table public.module_permissions to authenticated;
grant select on table public.approval_logs to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger module_permissions_set_updated_at
before update on public.module_permissions
for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, status)
  values (
    new.id,
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    'user',
    'pending'
  );
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Existing Auth accounts receive the same least-privileged initial profile as new signups.
insert into public.profiles (id, full_name, role, status)
select
  users.id,
  nullif(pg_catalog.btrim(users.raw_user_meta_data ->> 'full_name'), ''),
  'user',
  'pending'
from auth.users as users
on conflict (id) do nothing;

create function public.is_approved_superadmin()
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
      and profile.role = 'superadmin'
      and profile.status = 'approved'
  );
$$;

revoke all on function public.is_approved_superadmin() from public, anon;
grant execute on function public.is_approved_superadmin() to authenticated;

create policy profiles_select_own_or_superadmin
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select public.is_approved_superadmin())
);

create policy profiles_update_own_name
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy module_permissions_select_own_or_superadmin
on public.module_permissions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_approved_superadmin())
);

create policy approval_logs_select_superadmin
on public.approval_logs
for select
to authenticated
using ((select public.is_approved_superadmin()));

create function public.review_profile(
  p_user_id uuid,
  p_decision text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewer_id uuid := auth.uid();
begin
  if reviewer_id is null or not public.is_approved_superadmin() then
    raise exception using
      errcode = '42501',
      message = 'Only an approved superadmin can review profiles';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception using
      errcode = '22023',
      message = 'Decision must be approved or rejected';
  end if;

  update public.profiles
  set status = p_decision
  where id = p_user_id;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'Profile does not exist';
  end if;

  insert into public.approval_logs (user_id, approved_by, decision, notes)
  values (p_user_id, reviewer_id, p_decision, p_notes);
end;
$$;

revoke all on function public.review_profile(uuid, text, text) from public, anon;
grant execute on function public.review_profile(uuid, text, text) to authenticated;

create function public.set_profile_access(
  p_user_id uuid,
  p_role text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_approved_superadmin() then
    raise exception using
      errcode = '42501',
      message = 'Only an approved superadmin can change profile access';
  end if;

  if p_role not in ('superadmin', 'admin', 'user') then
    raise exception using
      errcode = '22023',
      message = 'Invalid profile role';
  end if;

  if p_status not in ('pending', 'approved', 'rejected', 'blocked') then
    raise exception using
      errcode = '22023',
      message = 'Invalid profile status';
  end if;

  update public.profiles
  set role = p_role,
      status = p_status
  where id = p_user_id;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'Profile does not exist';
  end if;
end;
$$;

revoke all on function public.set_profile_access(uuid, text, text) from public, anon;
grant execute on function public.set_profile_access(uuid, text, text) to authenticated;

create function public.set_module_permissions(
  p_user_id uuid,
  p_module_name text,
  p_can_view boolean,
  p_can_add boolean,
  p_can_edit boolean,
  p_can_delete boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_approved_superadmin() then
    raise exception using
      errcode = '42501',
      message = 'Only an approved superadmin can change module permissions';
  end if;

  insert into public.module_permissions (
    user_id,
    module_name,
    can_view,
    can_add,
    can_edit,
    can_delete
  )
  values (
    p_user_id,
    p_module_name,
    p_can_view,
    p_can_add,
    p_can_edit,
    p_can_delete
  )
  on conflict (user_id, module_name)
  do update set
    can_view = excluded.can_view,
    can_add = excluded.can_add,
    can_edit = excluded.can_edit,
    can_delete = excluded.can_delete;
end;
$$;

revoke all on function public.set_module_permissions(uuid, text, boolean, boolean, boolean, boolean)
  from public, anon;
grant execute on function public.set_module_permissions(uuid, text, boolean, boolean, boolean, boolean)
  to authenticated;

create function public.delete_module_permissions(
  p_user_id uuid,
  p_module_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_approved_superadmin() then
    raise exception using
      errcode = '42501',
      message = 'Only an approved superadmin can delete module permissions';
  end if;

  delete from public.module_permissions
  where user_id = p_user_id
    and module_name = p_module_name;
end;
$$;

revoke all on function public.delete_module_permissions(uuid, text) from public, anon;
grant execute on function public.delete_module_permissions(uuid, text) to authenticated;
