create table public.security_audit_log (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  actor_user_id uuid,
  actor_type text not null
    constraint security_audit_log_actor_type_check
    check (
      (actor_type = 'user' and actor_user_id is not null)
      or (actor_type = 'system' and actor_user_id is null)
    ),
  target_user_id uuid not null,
  action text not null
    constraint security_audit_log_action_check
    check (
      action in (
        'account.created',
        'account.deleted',
        'profile.access_changed',
        'permissions.changed',
        'password_reset.completed',
        'admin.account_created'
      )
    ),
  before_values jsonb,
  after_values jsonb,
  created_at timestamptz not null default pg_catalog.now()
);

alter table public.security_audit_log enable row level security;

revoke all on table public.security_audit_log
from public, anon, authenticated;

grant select on table public.security_audit_log to authenticated;
grant insert on table public.security_audit_log to service_role;

create policy security_audit_log_select_superadmin
on public.security_audit_log
for select
to authenticated
using ((select public.is_approved_superadmin()));

create index security_audit_log_target_created_at_idx
  on public.security_audit_log (target_user_id, created_at desc);

create index security_audit_log_actor_created_at_idx
  on public.security_audit_log (actor_user_id, created_at desc);

create function public.capture_profile_security_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_kind text := case when actor_id is null then 'system' else 'user' end;
begin
  if tg_op = 'INSERT' then
    insert into public.security_audit_log (
      actor_user_id, actor_type, target_user_id, action, after_values
    )
    values (
      actor_id,
      actor_kind,
      new.id,
      'account.created',
      pg_catalog.jsonb_build_object('role', new.role, 'status', new.status)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.role is distinct from new.role
      or old.status is distinct from new.status then
      insert into public.security_audit_log (
        actor_user_id,
        actor_type,
        target_user_id,
        action,
        before_values,
        after_values
      )
      values (
        actor_id,
        actor_kind,
        new.id,
        'profile.access_changed',
        pg_catalog.jsonb_build_object('role', old.role, 'status', old.status),
        pg_catalog.jsonb_build_object('role', new.role, 'status', new.status)
      );
    end if;
    return new;
  end if;

  insert into public.security_audit_log (
    actor_user_id, actor_type, target_user_id, action, before_values
  )
  values (
    actor_id,
    actor_kind,
    old.id,
    'account.deleted',
    pg_catalog.jsonb_build_object('role', old.role, 'status', old.status)
  );
  return old;
end;
$$;

revoke all on function public.capture_profile_security_event()
from public, anon, authenticated;

create trigger profiles_capture_security_events
after insert or update of role, status or delete
on public.profiles
for each row execute function public.capture_profile_security_event();

create function public.capture_module_permission_security_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_kind text := case when actor_id is null then 'system' else 'user' end;
  target_id uuid;
  before_data jsonb;
  after_data jsonb;
begin
  if tg_op = 'DELETE' then
    target_id := old.user_id;
    before_data := pg_catalog.jsonb_build_object(
      'module_name', old.module_name,
      'can_view', old.can_view,
      'can_add', old.can_add,
      'can_edit', old.can_edit,
      'can_delete', old.can_delete
    );
  else
    target_id := new.user_id;
    after_data := pg_catalog.jsonb_build_object(
      'module_name', new.module_name,
      'can_view', new.can_view,
      'can_add', new.can_add,
      'can_edit', new.can_edit,
      'can_delete', new.can_delete
    );

    if tg_op = 'UPDATE' then
      before_data := pg_catalog.jsonb_build_object(
        'module_name', old.module_name,
        'can_view', old.can_view,
        'can_add', old.can_add,
        'can_edit', old.can_edit,
        'can_delete', old.can_delete
      );

      if before_data = after_data then
        return new;
      end if;
    end if;
  end if;

  insert into public.security_audit_log (
    actor_user_id,
    actor_type,
    target_user_id,
    action,
    before_values,
    after_values
  )
  values (
    actor_id,
    actor_kind,
    target_id,
    'permissions.changed',
    before_data,
    after_data
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.capture_module_permission_security_event()
from public, anon, authenticated;

create trigger module_permissions_capture_security_events
after insert or update or delete
on public.module_permissions
for each row execute function public.capture_module_permission_security_event();

create function public.record_password_reset()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  claims jsonb := (select auth.jwt());
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'A recovery session is required';
  end if;

  if not exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(claims -> 'amr') = 'array'
          then claims -> 'amr'
        else '[]'::jsonb
      end
    ) as amr(value)
    where amr.value ->> 'method' = 'recovery'
       or amr.value #>> '{}' = 'recovery'
  ) then
    raise exception using
      errcode = '42501',
      message = 'A recovery session is required';
  end if;

  insert into public.security_audit_log (
    actor_user_id, actor_type, target_user_id, action
  )
  values (
    actor_id, 'user', actor_id, 'password_reset.completed'
  );
end;
$$;

revoke all on function public.record_password_reset()
from public, anon, authenticated;
grant execute on function public.record_password_reset() to authenticated;
