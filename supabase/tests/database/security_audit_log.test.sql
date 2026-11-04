begin;

select plan(9);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '7b000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'audit-superadmin@example.test',
    '',
    pg_catalog.now(),
    '{}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    '7b000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'audit-target@example.test',
    '',
    pg_catalog.now(),
    '{}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    '7b000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'audit-deleted@example.test',
    '',
    pg_catalog.now(),
    '{}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  );

update public.profiles
set role = 'superadmin',
    status = 'approved'
where id = '7b000000-0000-4000-8000-000000000001';

update public.profiles
set role = 'admin',
    status = 'approved'
where id = '7b000000-0000-4000-8000-000000000002';

select is(
  (select count(*)::integer
   from public.security_audit_log
   where target_user_id = '7b000000-0000-4000-8000-000000000002'
     and action = 'account.created'),
  1,
  'profile creation is audited'
);

select is(
  (select before_values ->> 'role'
   from public.security_audit_log
   where target_user_id = '7b000000-0000-4000-8000-000000000002'
     and action = 'profile.access_changed'),
  'user',
  'profile access changes retain the prior role'
);

insert into public.module_permissions (user_id, module_name, can_view)
values ('7b000000-0000-4000-8000-000000000002', 'users', true);

select is(
  (select after_values ->> 'can_view'
   from public.security_audit_log
   where target_user_id = '7b000000-0000-4000-8000-000000000002'
     and action = 'permissions.changed'),
  'true',
  'permission changes retain the resulting flags'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '7b000000-0000-4000-8000-000000000002',
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"7b000000-0000-4000-8000-000000000002","role":"authenticated","amr":[{"method":"recovery"}]}',
  true
);
select public.record_password_reset();
reset role;

select is(
  (select count(*)::integer
   from public.security_audit_log
   where target_user_id = '7b000000-0000-4000-8000-000000000002'
     and action = 'password_reset.completed'),
  1,
  'recovery-session password changes are audited'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"7b000000-0000-4000-8000-000000000002","role":"authenticated","amr":[{"method":"password"}]}',
  true
);

select throws_ok(
  $$select public.record_password_reset()$$,
  '42501',
  null,
  'non-recovery sessions cannot record password reset events'
);

select throws_ok(
  $$insert into public.security_audit_log (
      actor_user_id, actor_type, target_user_id, action
    )
    values (
      '7b000000-0000-4000-8000-000000000002',
      'user',
      '7b000000-0000-4000-8000-000000000002',
      'account.created'
    )$$,
  '42501',
  null,
  'authenticated users cannot insert audit events'
);

reset role;

delete from auth.users
where id = '7b000000-0000-4000-8000-000000000003';

select is(
  (select count(*)::integer
   from public.security_audit_log
   where target_user_id = '7b000000-0000-4000-8000-000000000003'
     and action = 'account.deleted'),
  1,
  'profile deletion retains an audit event after the account is removed'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '7b000000-0000-4000-8000-000000000002',
  true
);

select is(
  (select count(*)::integer
   from public.security_audit_log
   where target_user_id = '7b000000-0000-4000-8000-000000000002'),
  0,
  'approved admins cannot read security audit events'
);

reset role;
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '7b000000-0000-4000-8000-000000000001',
  true
);

select ok(
  (select count(*) > 0
   from public.security_audit_log
   where target_user_id = '7b000000-0000-4000-8000-000000000002'),
  'approved superadmins can read security audit events'
);

select * from finish();

rollback;
