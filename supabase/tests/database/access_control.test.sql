begin;

select plan(24);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '8c000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'qa-superadmin@example.test',
    '',
    pg_catalog.now(),
    '{}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    '8c000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'qa-admin@example.test',
    '',
    pg_catalog.now(),
    '{}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    '8c000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'qa-user@example.test',
    '',
    pg_catalog.now(),
    '{}'::jsonb,
    '{"full_name":"Pending User"}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    '8c000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'qa-other-user@example.test',
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
where id = '8c000000-0000-4000-8000-000000000001';

update public.profiles
set role = 'admin',
    status = 'approved'
where id = '8c000000-0000-4000-8000-000000000002';

insert into public.module_permissions (user_id, module_name, can_view)
values
  ('8c000000-0000-4000-8000-000000000002', 'users', true),
  ('8c000000-0000-4000-8000-000000000003', 'users', true);

select is(
  (select role from public.profiles
   where id = '8c000000-0000-4000-8000-000000000003'),
  'user',
  'new Auth users receive the user role'
);

select is(
  (select status from public.profiles
   where id = '8c000000-0000-4000-8000-000000000003'),
  'pending',
  'new Auth users require approval'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000003',
  true
);

select is(
  (select count(*)::integer from public.profiles),
  1,
  'pending users can read only their own profile'
);

select is(
  (select count(*)::integer from public.module_permissions),
  1,
  'users can read only their own permission rows'
);

update public.profiles
set full_name = 'Updated Pending User'
where id = '8c000000-0000-4000-8000-000000000003';

select is(
  (select full_name from public.profiles
   where id = '8c000000-0000-4000-8000-000000000003'),
  'Updated Pending User',
  'users can update their own name'
);

select throws_ok(
  $$update public.profiles set role = 'admin'
    where id = '8c000000-0000-4000-8000-000000000003'$$,
  '42501',
  null,
  'users cannot directly change their role'
);

select throws_ok(
  $$select public.set_profile_access(
      '8c000000-0000-4000-8000-000000000003', 'admin', 'approved'
    )$$,
  '42501',
  null,
  'pending users cannot change profile access'
);

select throws_ok(
  $$insert into public.module_permissions (user_id, module_name)
    values ('8c000000-0000-4000-8000-000000000003', 'users')$$,
  '42501',
  null,
  'authenticated users cannot write module permissions directly'
);

select throws_ok(
  $$insert into public.approval_logs (user_id, approved_by, decision)
    values (
      '8c000000-0000-4000-8000-000000000003',
      '8c000000-0000-4000-8000-000000000001',
      'approved'
    )$$,
  '42501',
  null,
  'authenticated users cannot write approval logs directly'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.profiles$$,
  '42501',
  null,
  'anonymous users cannot read profiles'
);

reset role;
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $$select public.review_profile(
      '8c000000-0000-4000-8000-000000000003', 'approved'
    )$$,
  'approved superadmins can approve pending profiles'
);

reset role;

select is(
  (select status from public.profiles
   where id = '8c000000-0000-4000-8000-000000000003'),
  'approved',
  'profile review updates the pending status'
);

select is(
  (select approved_by
   from public.approval_logs
   where user_id = '8c000000-0000-4000-8000-000000000003'),
  '8c000000-0000-4000-8000-000000000001'::uuid,
  'approval logs retain the authenticated reviewer'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000001',
  true
);

select is(
  (select count(*)::integer from public.profiles),
  4,
  'approved superadmins can read all profiles'
);

reset role;
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000002',
  true
);

select lives_ok(
  $$select public.set_profile_blocked(
      '8c000000-0000-4000-8000-000000000003', true
    )$$,
  'approved admins can block approved users'
);

reset role;

select is(
  (select status from public.profiles
   where id = '8c000000-0000-4000-8000-000000000003'),
  'blocked',
  'blocking changes the account status'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000002',
  true
);

select lives_ok(
  $$select public.set_profile_blocked(
      '8c000000-0000-4000-8000-000000000003', false
    )$$,
  'approved admins can unblock approved users'
);

select throws_ok(
  $$select public.set_profile_role(
      '8c000000-0000-4000-8000-000000000003', 'admin'
    )$$,
  '42501',
  null,
  'admins cannot assign roles'
);

select throws_ok(
  $$select public.set_module_permissions(
      '8c000000-0000-4000-8000-000000000003',
      'users',
      true,
      true,
      false,
      false
    )$$,
  '42501',
  null,
  'admins cannot assign module permissions'
);

reset role;

select is(
  (select status from public.profiles
   where id = '8c000000-0000-4000-8000-000000000003'),
  'approved',
  'unblocking restores the approved status'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $$select public.set_profile_role(
      '8c000000-0000-4000-8000-000000000003', 'admin'
    )$$,
  'approved superadmins can change another profile role'
);

select throws_ok(
  $$select public.set_profile_access(
      '8c000000-0000-4000-8000-000000000001', 'user', 'approved'
    )$$,
  '22023',
  null,
  'the last approved superadmin cannot remove their own access'
);

reset role;

select is(
  (select role || ':' || status from public.profiles
   where id = '8c000000-0000-4000-8000-000000000001'),
  'superadmin:approved',
  'self-demotion rejection preserves the superadmin account'
);

select is(
  (select count(*)::integer
   from public.profiles
   where role = 'superadmin' and status = 'approved'),
  1,
  'at least one approved superadmin remains'
);

select * from finish();

rollback;
