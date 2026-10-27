create or replace function public.review_profile(
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

  if p_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'Target user ID is required';
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception using
      errcode = '22023',
      message = 'Decision must be approved or rejected';
  end if;

  if p_user_id = reviewer_id then
    raise exception using
      errcode = '22023',
      message = 'A superadmin cannot change their own approval status';
  end if;

  update public.profiles
  set status = p_decision
  where id = p_user_id
    and status = 'pending';

  if not found then
    raise exception using
      errcode = '22023',
      message = 'Pending profile does not exist';
  end if;

  insert into public.approval_logs (user_id, approved_by, decision, notes)
  values (p_user_id, reviewer_id, p_decision, p_notes);
end;
$$;

revoke all on function public.review_profile(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.review_profile(uuid, text, text)
to authenticated;

create function public.set_profile_role(
  p_user_id uuid,
  p_role text
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
      message = 'Only an approved superadmin can change profile roles';
  end if;

  if p_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'Target user ID is required';
  end if;

  if p_role is null or p_role not in ('superadmin', 'admin', 'user') then
    raise exception using
      errcode = '22023',
      message = 'Invalid profile role';
  end if;

  if p_user_id = auth.uid() then
    raise exception using
      errcode = '22023',
      message = 'A superadmin cannot change their own role';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'Profile does not exist';
  end if;
end;
$$;

revoke all on function public.set_profile_role(uuid, text)
from public, anon, authenticated;
grant execute on function public.set_profile_role(uuid, text)
to authenticated;

create function public.set_profile_blocked(
  p_user_id uuid,
  p_blocked boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_status text;
  next_status text;
begin
  if auth.uid() is null or not public.is_approved_admin() then
    raise exception using
      errcode = '42501',
      message = 'Only an approved admin can block or unblock profiles';
  end if;

  if p_user_id is null or p_blocked is null then
    raise exception using
      errcode = '22023',
      message = 'Target user ID and blocked state are required';
  end if;

  if p_user_id = auth.uid() then
    raise exception using
      errcode = '22023',
      message = 'An admin cannot change their own access status';
  end if;

  if p_blocked then
    expected_status := 'approved';
    next_status := 'blocked';
  else
    expected_status := 'blocked';
    next_status := 'approved';
  end if;

  update public.profiles
  set status = next_status
  where id = p_user_id
    and status = expected_status;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'Profile does not exist or its status has changed';
  end if;
end;
$$;

revoke all on function public.set_profile_blocked(uuid, boolean)
from public, anon, authenticated;
grant execute on function public.set_profile_blocked(uuid, boolean)
to authenticated;
