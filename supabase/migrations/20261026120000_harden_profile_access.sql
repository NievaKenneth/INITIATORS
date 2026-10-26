
-- PROPOSED SECURITY FIX
-- Test only in the disposable security_test database.
-- Does not modify the original migrations.

CREATE OR REPLACE FUNCTION public.set_profile_access(
  p_user_id uuid,
  p_role text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  caller_status text;
  target_role text;
  target_status text;
  active_superadmins bigint;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(81120420261021::bigint);

  SELECT role, status
    INTO caller_role, caller_status
  FROM public.profiles
  WHERE id = caller_id
  FOR UPDATE;

  IF caller_id IS NULL
     OR caller_role IS DISTINCT FROM 'superadmin'
     OR caller_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Only an approved superadmin can change profile access';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Target user ID is required';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('superadmin', 'admin', 'user') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid profile role';
  END IF;

  IF p_status IS NULL
     OR p_status NOT IN ('pending', 'approved', 'rejected', 'blocked') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid profile status';
  END IF;

  IF p_user_id = caller_id
     AND (p_role <> 'superadmin' OR p_status <> 'approved') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'A superadmin cannot remove their own superadmin access';
  END IF;

  SELECT role, status
    INTO target_role, target_status
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Profile does not exist';
  END IF;

  IF target_role = 'superadmin'
     AND target_status = 'approved'
     AND (p_role <> 'superadmin' OR p_status <> 'approved') THEN
    SELECT count(*)
      INTO active_superadmins
    FROM public.profiles
    WHERE role = 'superadmin'
      AND status = 'approved';

    IF active_superadmins <= 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Cannot remove the last approved superadmin';
    END IF;
  END IF;

  UPDATE public.profiles
  SET role = p_role,
      status = p_status
  WHERE id = p_user_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.set_profile_blocked(
  p_user_id uuid,
  p_blocked boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  caller_status text;
  target_role text;
  target_status text;
  expected_status text;
  next_status text;
  active_superadmins bigint;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(81120420261021::bigint);

  SELECT role, status
    INTO caller_role, caller_status
  FROM public.profiles
  WHERE id = caller_id
  FOR UPDATE;

  IF caller_id IS NULL
     OR caller_role IS NULL
     OR caller_role NOT IN ('admin', 'superadmin')
     OR caller_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Only an approved admin can block or unblock profiles';
  END IF;

  IF p_user_id IS NULL OR p_blocked IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Target user ID and blocked state are required';
  END IF;

  IF p_user_id = caller_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'An admin cannot change their own access status';
  END IF;

  SELECT role, status
    INTO target_role, target_status
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Profile does not exist';
  END IF;

  IF target_role = 'superadmin' AND caller_role <> 'superadmin' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Only a superadmin can block or unblock another superadmin';
  END IF;

  IF p_blocked THEN
    expected_status := 'approved';
    next_status := 'blocked';
  ELSE
    expected_status := 'blocked';
    next_status := 'approved';
  END IF;

  IF target_status IS DISTINCT FROM expected_status THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Profile does not exist or its status has changed';
  END IF;

  IF p_blocked
     AND target_role = 'superadmin'
     AND target_status = 'approved' THEN
    SELECT count(*)
      INTO active_superadmins
    FROM public.profiles
    WHERE role = 'superadmin'
      AND status = 'approved';

    IF active_superadmins <= 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Cannot block the last approved superadmin';
    END IF;
  END IF;

  UPDATE public.profiles
  SET status = next_status
  WHERE id = p_user_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.set_profile_role(
  p_user_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  caller_status text;
  target_role text;
  target_status text;
  active_superadmins bigint;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(81120420261021::bigint);

  SELECT role, status
    INTO caller_role, caller_status
  FROM public.profiles
  WHERE id = caller_id
  FOR UPDATE;

  IF caller_id IS NULL
     OR caller_role IS DISTINCT FROM 'superadmin'
     OR caller_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Only an approved superadmin can change profile roles';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Target user ID is required';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('superadmin', 'admin', 'user') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid profile role';
  END IF;

  IF p_user_id = caller_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'A superadmin cannot change their own role';
  END IF;

  SELECT role, status
    INTO target_role, target_status
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Profile does not exist';
  END IF;

  IF target_role = 'superadmin'
     AND target_status = 'approved'
     AND p_role <> 'superadmin' THEN
    SELECT count(*)
      INTO active_superadmins
    FROM public.profiles
    WHERE role = 'superadmin'
      AND status = 'approved';

    IF active_superadmins <= 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Cannot demote the last approved superadmin';
    END IF;
  END IF;

  UPDATE public.profiles
  SET role = p_role
  WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_profile(
  p_user_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  reviewer_id uuid := auth.uid();
  reviewer_role text;
  reviewer_status text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(81120420261021::bigint);

  SELECT role, status
    INTO reviewer_role, reviewer_status
  FROM public.profiles
  WHERE id = reviewer_id
  FOR UPDATE;

  IF reviewer_id IS NULL
     OR reviewer_role IS DISTINCT FROM 'superadmin'
     OR reviewer_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Only an approved superadmin can review profiles';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Target user ID is required';
  END IF;

  IF p_decision IS NULL
     OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Decision must be approved or rejected';
  END IF;

  IF p_user_id = reviewer_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'A superadmin cannot change their own approval status';
  END IF;

  UPDATE public.profiles
  SET status = p_decision
  WHERE id = p_user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Pending profile does not exist';
  END IF;

  INSERT INTO public.approval_logs (
    user_id, approved_by, decision, notes
  )
  VALUES (
    p_user_id, reviewer_id, p_decision, p_notes
  );
END;
$function$;
