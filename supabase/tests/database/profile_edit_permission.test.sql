begin;

select plan(2);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '7a000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'permission-admin@example.test',
    '',
    pg_catalog.now(),
    '{}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    '7a000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'permission-target@example.test',
    '',
    pg_catalog.now(),
    '{}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  );

update public.profiles
set role = 'admin',
    status = 'approved'
where id = '7a000000-0000-4000-8000-000000000001';

update public.profiles
set full_name = 'Target'
where id = '7a000000-0000-4000-8000-000000000002';

insert into public.module_permissions (user_id, module_name, can_edit)
values ('7a000000-0000-4000-8000-000000000001', 'users', false);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '7a000000-0000-4000-8000-000000000001',
  true
);

update public.profiles
set full_name = 'Denied'
where id = '7a000000-0000-4000-8000-000000000002';

select is(
  (select full_name from public.profiles
   where id = '7a000000-0000-4000-8000-000000000002'),
  'Target',
  'approved admins without users.can_edit cannot edit other profiles'
);

reset role;

update public.module_permissions
set can_edit = true
where user_id = '7a000000-0000-4000-8000-000000000001'
  and module_name = 'users';

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '7a000000-0000-4000-8000-000000000001',
  true
);

update public.profiles
set full_name = 'Allowed'
where id = '7a000000-0000-4000-8000-000000000002';

select is(
  (select full_name from public.profiles
   where id = '7a000000-0000-4000-8000-000000000002'),
  'Allowed',
  'approved admins with users.can_edit can edit other profiles'
);

select * from finish();

rollback;
