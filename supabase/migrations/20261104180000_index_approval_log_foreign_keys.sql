create index approval_logs_user_id_created_at_idx
  on public.approval_logs (user_id, created_at desc);

create index approval_logs_approved_by_created_at_idx
  on public.approval_logs (approved_by, created_at desc);
