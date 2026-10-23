-- Phase 13: Reliability, Errors, and Audit Refinement Migration
-- 1. Defense-in-depth privacy trigger for audit_logs metadata
-- 2. Bounded, role-aware audit viewer procedure (get_audit_log_page)
--    Super Admin: Full system audit trail
--    TNP Secretary: Operational audit subset (strictly excludes bootstrap, role changes, security config)
--    Coordinator/Student/Recruiter/Anon: Denied (42501)

-- ============================================================================
-- 1. Defense-in-Depth Privacy Guard Trigger for audit_logs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_audit_metadata_privacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_forbidden_keys TEXT[] := ARRAY[
    'cgpa', 'snapshot_cgpa', 'previous_cgpa', 'new_cgpa',
    'backlog', 'backlogs', 'active_backlogs', 'total_backlogs', 'snapshot_backlogs',
    'password', 'password_hash', 'raw_password',
    'token', 'auth_token', 'access_token', 'refresh_token', 'verification_token', 'reset_token', 'invitation_token',
    'jwt', 'otp',
    'invitation_url', 'signed_url', 'signed_document_url',
    'resume_content',
    'sgpa', 'tenth_percentage', 'twelfth_percentage', 'diploma_percentage',
    'phone', 'personal_email', 'secret', 'hash'
  ];
  v_stack JSONB[] := ARRAY[]::JSONB[];
  v_curr JSONB;
  v_elem JSONB;
  v_pair RECORD;
  v_iterations INTEGER := 0;
  v_nodes_inspected INTEGER := 0;
BEGIN
  IF NEW.metadata IS NOT NULL THEN
    -- Bounded metadata size (max 32KB)
    IF length(NEW.metadata::TEXT) > 32768 THEN
      RAISE EXCEPTION 'Audit metadata exceeds maximum allowed size of 32KB'
        USING ERRCODE = '23514';
    END IF;

    -- Bounded iterative traversal to check all nested keys case-insensitively
    IF jsonb_typeof(NEW.metadata) IN ('object', 'array') THEN
      v_stack := ARRAY[NEW.metadata];
    END IF;

    WHILE array_length(v_stack, 1) > 0 LOOP
      v_iterations := v_iterations + 1;
      IF v_iterations > 500 THEN
        RAISE EXCEPTION 'Audit metadata exceeds maximum inspection complexity of 500 nodes'
          USING ERRCODE = '23514';
      END IF;

      v_curr := v_stack[array_length(v_stack, 1)];
      v_stack := v_stack[1 : array_length(v_stack, 1) - 1];

      IF jsonb_typeof(v_curr) = 'object' THEN
        FOR v_pair IN SELECT key, value FROM jsonb_each(v_curr) LOOP
          v_nodes_inspected := v_nodes_inspected + 1;
          IF v_nodes_inspected > 500 THEN
            RAISE EXCEPTION 'Audit metadata exceeds maximum inspection complexity of 500 nodes'
              USING ERRCODE = '23514';
          END IF;

          IF lower(v_pair.key) = ANY(v_forbidden_keys) THEN
            RAISE EXCEPTION 'Audit metadata violates privacy policy: forbidden key "%" detected', lower(v_pair.key)
              USING ERRCODE = '23514';
          END IF;
          IF jsonb_typeof(v_pair.value) IN ('object', 'array') THEN
            v_stack := array_append(v_stack, v_pair.value);
          END IF;
        END LOOP;
      ELSIF jsonb_typeof(v_curr) = 'array' THEN
        FOR v_elem IN SELECT value FROM jsonb_array_elements(v_curr) LOOP
          v_nodes_inspected := v_nodes_inspected + 1;
          IF v_nodes_inspected > 500 THEN
            RAISE EXCEPTION 'Audit metadata exceeds maximum inspection complexity of 500 nodes'
              USING ERRCODE = '23514';
          END IF;

          IF jsonb_typeof(v_elem) IN ('object', 'array') THEN
            v_stack := array_append(v_stack, v_elem);
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_metadata_privacy ON public.audit_logs;
CREATE TRIGGER trg_audit_metadata_privacy
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_audit_metadata_privacy();

-- ============================================================================
-- 2. Role-Aware Bounded Audit Log Viewer Procedure
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_audit_log_page(
  p_limit       INTEGER DEFAULT 50,
  p_offset      INTEGER DEFAULT 0,
  p_action      TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_start_date  TIMESTAMPTZ DEFAULT NULL,
  p_end_date    TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  created_at  TIMESTAMPTZ,
  actor_id    UUID,
  actor_name  TEXT,
  actor_role  public.user_role,
  action      TEXT,
  entity_type TEXT,
  entity_id   UUID,
  metadata    JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id    UUID := auth.uid();
  v_caller_role  public.user_role := public.get_user_role();
  v_clean_limit  INTEGER;
  v_clean_offset INTEGER;
  v_is_admin     BOOLEAN;
  v_is_sec       BOOLEAN;
BEGIN
  -- 1. Authentication & Active Staff Authorization Gate
  IF v_caller_id IS NULL OR NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can view audit logs'
      USING ERRCODE = '42501';
  END IF;

  v_is_admin := (v_caller_role = 'SUPER_ADMIN');
  v_is_sec   := (v_caller_role = 'TNP_SECRETARY');

  IF NOT (v_is_admin OR v_is_sec) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can view audit logs'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Secretary Scope Restriction:
  -- If Secretary explicitly searches for a forbidden administrative action, return empty result set
  IF v_is_sec AND NOT v_is_admin AND p_action IS NOT NULL THEN
    IF p_action IN ('BOOTSTRAP_SUPER_ADMIN', 'ROLE_ASSIGNED', 'ROLE_REMOVED', 'SYSTEM_CONFIG') THEN
      RETURN;
    END IF;
  END IF;

  -- 3. Bounded Limit & Offset Sanitization
  v_clean_limit  := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_clean_offset := GREATEST(COALESCE(p_offset, 0), 0);

  -- 4. Bounded Query with Windowed Total Count
  RETURN QUERY
  SELECT
    al.id,
    al.created_at,
    al.actor_id,
    COALESCE(p.display_name, 'System / Automated') AS actor_name,
    p.role AS actor_role,
    al.action,
    al.entity_type,
    al.entity_id,
    al.metadata,
    COUNT(*) OVER() AS total_count
  FROM public.audit_logs al
  LEFT JOIN public.profiles p ON p.id = al.actor_id
  WHERE
    -- Secretary is restricted to operational subset
    (
      v_is_admin
      OR (
        v_is_sec
        AND al.action NOT IN ('BOOTSTRAP_SUPER_ADMIN', 'ROLE_ASSIGNED', 'ROLE_REMOVED', 'SYSTEM_CONFIG')
      )
    )
    -- Optional Bounded Filters
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
  ORDER BY al.created_at DESC, al.id DESC
  LIMIT v_clean_limit
  OFFSET v_clean_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_audit_log_page(INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_audit_log_page(INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- 3. Audited Correction of Published Placement Drive (DRIVE_CORRECTED_PUBLISHED)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.correct_published_drive(
  p_drive_id             UUID,
  p_reason               TEXT,
  p_title                TEXT DEFAULT NULL,
  p_description          TEXT DEFAULT NULL,
  p_location             TEXT DEFAULT NULL,
  p_application_deadline TIMESTAMPTZ DEFAULT NULL,
  p_package_lpa          NUMERIC DEFAULT NULL,
  p_stipend_monthly      NUMERIC DEFAULT NULL,
  p_compensation_details TEXT DEFAULT NULL,
  p_requirements_info    TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id         UUID := auth.uid();
  v_caller_role      public.user_role;
  v_is_active        BOOLEAN;
  v_drive            public.placement_drives%ROWTYPE;
  v_clean_reason     TEXT;
  v_clean_title      TEXT;
  v_corrected_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 1. Authority: Super Admin or TNP Secretary only
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT role, is_active INTO v_caller_role, v_is_active
  FROM public.profiles
  WHERE id = v_actor_id;

  IF NOT FOUND OR NOT v_is_active OR v_caller_role NOT IN ('SUPER_ADMIN', 'TNP_SECRETARY') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin and TNP Secretary can correct published drives'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Mandatory correction reason
  v_clean_reason := NULLIF(trim(p_reason), '');
  IF v_clean_reason IS NULL THEN
    RAISE EXCEPTION 'Correction reason is required for published drive corrections'
      USING ERRCODE = '22023';
  END IF;

  IF length(v_clean_reason) < 5 OR length(v_clean_reason) > 500 THEN
    RAISE EXCEPTION 'Correction reason must be between 5 and 500 characters'
      USING ERRCODE = '22023';
  END IF;

  -- 3. Row lock and state check
  SELECT * INTO v_drive
  FROM public.placement_drives
  WHERE id = p_drive_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement drive not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_drive.status != 'PUBLISHED' THEN
    RAISE EXCEPTION 'Only PUBLISHED drives can be corrected (current status: %)', v_drive.status
      USING ERRCODE = '22023';
  END IF;

  -- 4. Validations on allowable fields
  IF p_title IS NOT NULL THEN
    v_clean_title := NULLIF(trim(p_title), '');
    IF v_clean_title IS NULL THEN
      RAISE EXCEPTION 'Drive title cannot be empty'
        USING ERRCODE = '22023';
    END IF;
    IF length(v_clean_title) > 200 THEN
      RAISE EXCEPTION 'Drive title cannot exceed 200 characters'
        USING ERRCODE = '22023';
    END IF;
    IF v_clean_title IS DISTINCT FROM v_drive.title THEN
      v_corrected_fields := array_append(v_corrected_fields, 'title');
    END IF;
  ELSE
    v_clean_title := v_drive.title;
  END IF;

  IF p_application_deadline IS NOT NULL THEN
    IF p_application_deadline <= now() THEN
      RAISE EXCEPTION 'Application deadline must be in the future'
        USING ERRCODE = '22023';
    END IF;
    IF p_application_deadline IS DISTINCT FROM v_drive.application_deadline THEN
      v_corrected_fields := array_append(v_corrected_fields, 'application_deadline');
    END IF;
  END IF;

  IF p_package_lpa IS NOT NULL THEN
    IF p_package_lpa < 0 OR p_package_lpa > 9999.99 THEN
      RAISE EXCEPTION 'Package LPA must be between 0 and 9999.99'
        USING ERRCODE = '22023';
    END IF;
    IF p_package_lpa IS DISTINCT FROM v_drive.package_lpa THEN
      v_corrected_fields := array_append(v_corrected_fields, 'package_lpa');
    END IF;
  END IF;

  IF p_stipend_monthly IS NOT NULL THEN
    IF p_stipend_monthly < 0 OR p_stipend_monthly > 99999999.99 THEN
      RAISE EXCEPTION 'Monthly stipend must be positive'
        USING ERRCODE = '22023';
    END IF;
    IF p_stipend_monthly IS DISTINCT FROM v_drive.stipend_monthly THEN
      v_corrected_fields := array_append(v_corrected_fields, 'stipend_monthly');
    END IF;
  END IF;

  IF p_description IS NOT NULL AND p_description IS DISTINCT FROM v_drive.description THEN
    v_corrected_fields := array_append(v_corrected_fields, 'description');
  END IF;
  IF p_location IS NOT NULL AND p_location IS DISTINCT FROM v_drive.location THEN
    v_corrected_fields := array_append(v_corrected_fields, 'location');
  END IF;
  IF p_compensation_details IS NOT NULL AND p_compensation_details IS DISTINCT FROM v_drive.compensation_details THEN
    v_corrected_fields := array_append(v_corrected_fields, 'compensation_details');
  END IF;
  IF p_requirements_info IS NOT NULL AND p_requirements_info IS DISTINCT FROM v_drive.requirements_info THEN
    v_corrected_fields := array_append(v_corrected_fields, 'requirements_info');
  END IF;

  -- 5. Execute in-place correction preserving publication lifecycle metadata
  UPDATE public.placement_drives
  SET title = v_clean_title,
      description = COALESCE(NULLIF(trim(p_description), ''), v_drive.description),
      location = COALESCE(NULLIF(trim(p_location), ''), v_drive.location),
      application_deadline = COALESCE(p_application_deadline, v_drive.application_deadline),
      package_lpa = COALESCE(p_package_lpa, v_drive.package_lpa),
      stipend_monthly = COALESCE(p_stipend_monthly, v_drive.stipend_monthly),
      compensation_details = COALESCE(NULLIF(trim(p_compensation_details), ''), v_drive.compensation_details),
      requirements_info = COALESCE(NULLIF(trim(p_requirements_info), ''), v_drive.requirements_info),
      updated_at = now()
  WHERE id = p_drive_id;

  -- 6. Record DRIVE_CORRECTED_PUBLISHED audit log entry
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_actor_id,
    'DRIVE_CORRECTED_PUBLISHED',
    'placement_drive',
    p_drive_id,
    jsonb_build_object(
      'drive_id', p_drive_id,
      'title', v_clean_title,
      'reason', v_clean_reason,
      'corrected_fields', v_corrected_fields
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'drive_id', p_drive_id,
    'corrected_fields', v_corrected_fields
  );
END;
$$;

REVOKE ALL ON FUNCTION public.correct_published_drive(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_published_drive(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;
