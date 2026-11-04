begin;

select plan(2);

select ok(
  pg_catalog.to_regclass('public.approval_logs_user_id_created_at_idx') is not null,
  'approval history is indexed by affected user and creation time'
);

select ok(
  pg_catalog.to_regclass('public.approval_logs_approved_by_created_at_idx') is not null,
  'approval history is indexed by reviewer and creation time'
);

select * from finish();

rollback;
