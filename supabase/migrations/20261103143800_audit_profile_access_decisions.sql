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

  IF target_status IS DISTINCT FROM p_status
     AND p_status IN ('approved', 'rejected') THEN
    INSERT INTO public.approval_logs (
      user_id, approved_by, decision
    )
    VALUES (
      p_user_id, caller_id, p_status
    );
  END IF;
END;
$function$;
