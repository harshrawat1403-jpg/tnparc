-- Migration 14: Phase 6 Companies, Recruiters & Invitation Workflow
-- Authoritative schema, RLS policies, and narrow security definer procedures

-- ============================================================================
-- 1. Helper Functions
-- ============================================================================

-- Helper: True if caller is active SUPER_ADMIN or TNP_SECRETARY
CREATE OR REPLACE FUNCTION is_admin_or_secretary()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_active = true
      AND role IN ('SUPER_ADMIN', 'TNP_SECRETARY')
  );
$$;

-- Internal authorization helper: revoke from PUBLIC, anon, and authenticated.
-- Only executable by table/function owner (postgres) and service_role.
REVOKE ALL ON FUNCTION is_admin_or_secretary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION is_admin_or_secretary() TO service_role;

-- Ensure operational column exists on recruiter_invitations for delivery confirmation
ALTER TABLE public.recruiter_invitations
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMPTZ DEFAULT NULL;

-- Ensure case-insensitive uniqueness index on recruiter_contacts email
CREATE UNIQUE INDEX IF NOT EXISTS uq_recruiter_contacts_normalized_email
  ON public.recruiter_contacts (lower(trim(email)));

-- ============================================================================
-- 2. Row Level Security Policies
-- ============================================================================

-- A. companies
REVOKE ALL ON companies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON companies TO authenticated;

DROP POLICY IF EXISTS companies_select_staff ON companies;
CREATE POLICY companies_select_staff ON companies
  FOR SELECT
  USING (is_active_staff());

DROP POLICY IF EXISTS companies_select_recruiter ON companies;
CREATE POLICY companies_select_recruiter ON companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recruiter_profiles rp
      WHERE rp.company_id = companies.id
        AND rp.profile_id = auth.uid()
    )
  );

-- B. recruiter_contacts
REVOKE ALL ON recruiter_contacts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON recruiter_contacts TO authenticated;

DROP POLICY IF EXISTS recruiter_contacts_select_staff ON recruiter_contacts;
CREATE POLICY recruiter_contacts_select_staff ON recruiter_contacts
  FOR SELECT
  USING (is_active_staff());

DROP POLICY IF EXISTS recruiter_contacts_select_recruiter ON recruiter_contacts;
CREATE POLICY recruiter_contacts_select_recruiter ON recruiter_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recruiter_profiles rp
      WHERE rp.recruiter_contact_id = recruiter_contacts.id
        AND rp.profile_id = auth.uid()
    )
  );

-- C. recruiter_invitations
REVOKE ALL ON recruiter_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON recruiter_invitations TO authenticated;

DROP POLICY IF EXISTS recruiter_invitations_select_staff ON recruiter_invitations;
CREATE POLICY recruiter_invitations_select_staff ON recruiter_invitations
  FOR SELECT
  USING (is_active_staff());

-- Recruiters do not need direct SELECT access to recruiter_invitations;
-- invitation status verification and acceptance are fully encapsulated inside
-- the trusted SECURITY DEFINER procedure accept_recruiter_invitation().
DROP POLICY IF EXISTS recruiter_invitations_select_recruiter ON recruiter_invitations;

-- D. recruiter_profiles
REVOKE ALL ON recruiter_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON recruiter_profiles TO authenticated;

DROP POLICY IF EXISTS recruiter_profiles_select_staff ON recruiter_profiles;
CREATE POLICY recruiter_profiles_select_staff ON recruiter_profiles
  FOR SELECT
  USING (is_active_staff());

DROP POLICY IF EXISTS recruiter_profiles_select_recruiter ON recruiter_profiles;
CREATE POLICY recruiter_profiles_select_recruiter ON recruiter_profiles
  FOR SELECT
  USING (profile_id = auth.uid());

-- ============================================================================
-- 3. Staff Views
-- ============================================================================

-- Overview view for staff with invitation status join
CREATE OR REPLACE VIEW v_staff_recruiter_contacts
WITH (security_invoker = true)
AS
SELECT
  rc.id,
  rc.company_id,
  c.name AS company_name,
  c.is_archived AS company_is_archived,
  rc.full_name,
  rc.email,
  rc.phone,
  rc.designation,
  rc.is_active,
  rc.created_at,
  rc.updated_at,
  rp.id AS recruiter_profile_id,
  rp.profile_id AS bound_profile_id,
  latest_inv.id AS latest_invitation_id,
  CASE
    WHEN latest_inv.id IS NULL THEN 'NEVER_INVITED'
    WHEN latest_inv.status = 'PENDING' AND latest_inv.expires_at <= now() THEN 'EXPIRED'
    ELSE latest_inv.status::text
  END AS computed_invitation_status,
  latest_inv.invited_at AS latest_invited_at,
  latest_inv.expires_at AS latest_expires_at,
  latest_inv.accepted_at AS latest_accepted_at,
  latest_inv.revoked_at AS latest_revoked_at,
  latest_inv.delivery_confirmed_at AS latest_delivery_confirmed_at
FROM recruiter_contacts rc
JOIN companies c ON c.id = rc.company_id
LEFT JOIN recruiter_profiles rp ON rp.recruiter_contact_id = rc.id
LEFT JOIN LATERAL (
  SELECT ri.id, ri.status, ri.invited_at, ri.expires_at, ri.accepted_at, ri.revoked_at, ri.delivery_confirmed_at
  FROM recruiter_invitations ri
  WHERE ri.recruiter_contact_id = rc.id
  ORDER BY ri.invited_at DESC
  LIMIT 1
) latest_inv ON true;

GRANT SELECT ON v_staff_recruiter_contacts TO authenticated;

-- ============================================================================
-- 4. Company Management Procedures (Super Admin & Secretary Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_company(
  p_name        TEXT,
  p_website     TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id   UUID := auth.uid();
  v_clean_name TEXT;
  v_clean_web  TEXT;
  v_clean_desc TEXT;
  v_company_id UUID;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can create companies';
  END IF;

  v_clean_name := NULLIF(trim(p_name), '');
  IF v_clean_name IS NULL THEN
    RAISE EXCEPTION 'Company name cannot be empty';
  END IF;

  IF length(v_clean_name) > 200 THEN
    RAISE EXCEPTION 'Company name cannot exceed 200 characters';
  END IF;

  v_clean_web := NULLIF(trim(p_website), '');
  IF v_clean_web IS NOT NULL AND length(v_clean_web) > 500 THEN
    RAISE EXCEPTION 'Company website cannot exceed 500 characters';
  END IF;

  v_clean_desc := NULLIF(trim(p_description), '');
  IF v_clean_desc IS NOT NULL AND length(v_clean_desc) > 2000 THEN
    RAISE EXCEPTION 'Company description cannot exceed 2000 characters';
  END IF;

  -- Insert company (trigger trg_normalize_company_name populates normalized_name and checks uq)
  INSERT INTO companies (name, website, description, is_archived, created_by)
  VALUES (v_clean_name, v_clean_web, v_clean_desc, false, v_actor_id)
  RETURNING id INTO v_company_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'COMPANY_CREATED',
    'company',
    v_company_id,
    jsonb_build_object('name', v_clean_name)
  );

  RETURN jsonb_build_object('success', true, 'company_id', v_company_id);
END;
$$;

REVOKE ALL ON FUNCTION create_company(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_company(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION update_company(
  p_company_id  UUID,
  p_name        TEXT,
  p_website     TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id   UUID := auth.uid();
  v_clean_name TEXT;
  v_clean_web  TEXT;
  v_clean_desc TEXT;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can update companies';
  END IF;

  v_clean_name := NULLIF(trim(p_name), '');
  IF v_clean_name IS NULL THEN
    RAISE EXCEPTION 'Company name cannot be empty';
  END IF;

  IF length(v_clean_name) > 200 THEN
    RAISE EXCEPTION 'Company name cannot exceed 200 characters';
  END IF;

  v_clean_web := NULLIF(trim(p_website), '');
  IF v_clean_web IS NOT NULL AND length(v_clean_web) > 500 THEN
    RAISE EXCEPTION 'Company website cannot exceed 500 characters';
  END IF;

  v_clean_desc := NULLIF(trim(p_description), '');
  IF v_clean_desc IS NOT NULL AND length(v_clean_desc) > 2000 THEN
    RAISE EXCEPTION 'Company description cannot exceed 2000 characters';
  END IF;

  UPDATE companies
  SET name = v_clean_name,
      website = v_clean_web,
      description = v_clean_desc,
      updated_at = now()
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'COMPANY_UPDATED',
    'company',
    p_company_id,
    jsonb_build_object('name', v_clean_name)
  );

  RETURN jsonb_build_object('success', true, 'company_id', p_company_id);
END;
$$;

REVOKE ALL ON FUNCTION update_company(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_company(UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION archive_company(p_company_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_comp     companies%ROWTYPE;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can archive companies';
  END IF;

  SELECT * INTO v_comp FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  UPDATE companies
  SET is_archived = true,
      updated_at = now()
  WHERE id = p_company_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'COMPANY_ARCHIVED',
    'company',
    p_company_id,
    jsonb_build_object('name', v_comp.name)
  );

  RETURN jsonb_build_object('success', true, 'company_id', p_company_id, 'is_archived', true);
END;
$$;

REVOKE ALL ON FUNCTION archive_company(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_company(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION reactivate_company(p_company_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_comp     companies%ROWTYPE;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can reactivate companies';
  END IF;

  SELECT * INTO v_comp FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  UPDATE companies
  SET is_archived = false,
      updated_at = now()
  WHERE id = p_company_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'COMPANY_REACTIVATED',
    'company',
    p_company_id,
    jsonb_build_object('name', v_comp.name)
  );

  RETURN jsonb_build_object('success', true, 'company_id', p_company_id, 'is_archived', false);
END;
$$;

REVOKE ALL ON FUNCTION reactivate_company(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reactivate_company(UUID) TO authenticated;

-- ============================================================================
-- 5. Recruiter Contact Management Procedures (Super Admin & Secretary Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_recruiter_contact(
  p_company_id  UUID,
  p_full_name   TEXT,
  p_email       TEXT,
  p_phone       TEXT DEFAULT NULL,
  p_designation TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id    UUID := auth.uid();
  v_company     companies%ROWTYPE;
  v_clean_name  TEXT;
  v_clean_email TEXT;
  v_clean_phone TEXT;
  v_clean_desig TEXT;
  v_contact_id  UUID;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can create recruiter contacts';
  END IF;

  SELECT * INTO v_company FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  IF v_company.is_archived THEN
    RAISE EXCEPTION 'Cannot add recruiter contact to an archived company';
  END IF;

  v_clean_name := NULLIF(trim(p_full_name), '');
  IF v_clean_name IS NULL THEN
    RAISE EXCEPTION 'Contact name cannot be empty';
  END IF;

  IF length(v_clean_name) > 200 THEN
    RAISE EXCEPTION 'Contact name cannot exceed 200 characters';
  END IF;

  v_clean_email := NULLIF(lower(trim(p_email)), '');
  IF v_clean_email IS NULL THEN
    RAISE EXCEPTION 'Contact email cannot be empty';
  END IF;

  IF length(v_clean_email) > 255 THEN
    RAISE EXCEPTION 'Contact email cannot exceed 255 characters';
  END IF;

  IF v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  v_clean_phone := NULLIF(trim(p_phone), '');
  IF v_clean_phone IS NOT NULL AND length(v_clean_phone) > 30 THEN
    RAISE EXCEPTION 'Phone number cannot exceed 30 characters';
  END IF;

  v_clean_desig := NULLIF(trim(p_designation), '');
  IF v_clean_desig IS NOT NULL AND length(v_clean_desig) > 100 THEN
    RAISE EXCEPTION 'Designation cannot exceed 100 characters';
  END IF;

  INSERT INTO recruiter_contacts (
    company_id,
    full_name,
    email,
    phone,
    designation,
    is_active,
    created_by
  ) VALUES (
    p_company_id,
    v_clean_name,
    v_clean_email,
    v_clean_phone,
    v_clean_desig,
    true,
    v_actor_id
  ) RETURNING id INTO v_contact_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'RECRUITER_CONTACT_CREATED',
    'recruiter_contact',
    v_contact_id,
    jsonb_build_object(
      'company_id', p_company_id,
      'full_name', v_clean_name
    )
  );

  RETURN jsonb_build_object('success', true, 'contact_id', v_contact_id);
END;
$$;

REVOKE ALL ON FUNCTION create_recruiter_contact(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_recruiter_contact(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION update_recruiter_contact(
  p_contact_id  UUID,
  p_full_name   TEXT,
  p_phone       TEXT DEFAULT NULL,
  p_designation TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id    UUID := auth.uid();
  v_clean_name  TEXT;
  v_clean_phone TEXT;
  v_clean_desig TEXT;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can update recruiter contacts';
  END IF;

  v_clean_name := NULLIF(trim(p_full_name), '');
  IF v_clean_name IS NULL THEN
    RAISE EXCEPTION 'Contact name cannot be empty';
  END IF;

  IF length(v_clean_name) > 200 THEN
    RAISE EXCEPTION 'Contact name cannot exceed 200 characters';
  END IF;

  v_clean_phone := NULLIF(trim(p_phone), '');
  IF v_clean_phone IS NOT NULL AND length(v_clean_phone) > 30 THEN
    RAISE EXCEPTION 'Phone number cannot exceed 30 characters';
  END IF;

  v_clean_desig := NULLIF(trim(p_designation), '');
  IF v_clean_desig IS NOT NULL AND length(v_clean_desig) > 100 THEN
    RAISE EXCEPTION 'Designation cannot exceed 100 characters';
  END IF;

  UPDATE recruiter_contacts
  SET full_name = v_clean_name,
      phone = v_clean_phone,
      designation = v_clean_desig,
      updated_at = now()
  WHERE id = p_contact_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recruiter contact not found';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'RECRUITER_CONTACT_UPDATED',
    'recruiter_contact',
    p_contact_id,
    jsonb_build_object('full_name', v_clean_name)
  );

  RETURN jsonb_build_object('success', true, 'contact_id', p_contact_id);
END;
$$;

REVOKE ALL ON FUNCTION update_recruiter_contact(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_recruiter_contact(UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION deactivate_recruiter_contact(p_contact_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_contact  recruiter_contacts%ROWTYPE;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can deactivate recruiter contacts';
  END IF;

  SELECT * INTO v_contact FROM recruiter_contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recruiter contact not found';
  END IF;

  UPDATE recruiter_contacts
  SET is_active = false,
      updated_at = now()
  WHERE id = p_contact_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'RECRUITER_CONTACT_DEACTIVATED',
    'recruiter_contact',
    p_contact_id,
    jsonb_build_object('company_id', v_contact.company_id)
  );

  RETURN jsonb_build_object('success', true, 'contact_id', p_contact_id, 'is_active', false);
END;
$$;

REVOKE ALL ON FUNCTION deactivate_recruiter_contact(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION deactivate_recruiter_contact(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION reactivate_recruiter_contact(p_contact_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_contact  recruiter_contacts%ROWTYPE;
  v_company  companies%ROWTYPE;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can reactivate recruiter contacts';
  END IF;

  SELECT * INTO v_contact FROM recruiter_contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recruiter contact not found';
  END IF;

  SELECT * INTO v_company FROM companies WHERE id = v_contact.company_id;
  IF NOT FOUND OR v_company.is_archived THEN
    RAISE EXCEPTION 'Cannot reactivate recruiter contact: parent company is archived';
  END IF;

  UPDATE recruiter_contacts
  SET is_active = true,
      updated_at = now()
  WHERE id = p_contact_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'RECRUITER_CONTACT_REACTIVATED',
    'recruiter_contact',
    p_contact_id,
    jsonb_build_object('company_id', v_contact.company_id)
  );

  RETURN jsonb_build_object('success', true, 'contact_id', p_contact_id, 'is_active', true);
END;
$$;

REVOKE ALL ON FUNCTION reactivate_recruiter_contact(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reactivate_recruiter_contact(UUID) TO authenticated;

-- ============================================================================
-- 6. Recruiter Invitation Procedures
-- ============================================================================

CREATE OR REPLACE FUNCTION create_recruiter_invitation(p_contact_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id   UUID := auth.uid();
  v_contact    recruiter_contacts%ROWTYPE;
  v_company    companies%ROWTYPE;
  v_inv_id     UUID;
  v_expires_at TIMESTAMPTZ := now() + interval '7 days';
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can issue recruiter invitations';
  END IF;

  SELECT * INTO v_contact FROM recruiter_contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recruiter contact not found';
  END IF;

  IF NOT v_contact.is_active THEN
    RAISE EXCEPTION 'Cannot issue invitation: recruiter contact is inactive';
  END IF;

  SELECT * INTO v_company FROM companies WHERE id = v_contact.company_id;
  IF NOT FOUND OR v_company.is_archived THEN
    RAISE EXCEPTION 'Cannot issue invitation: company is archived';
  END IF;

  -- Verify contact is not already accepted/bound
  IF EXISTS (
    SELECT 1 FROM recruiter_profiles WHERE recruiter_contact_id = p_contact_id
  ) THEN
    RAISE EXCEPTION 'Cannot issue invitation: recruiter contact is already accepted and bound to an active profile';
  END IF;

  -- Opportunistically normalize any expired pending invitations for this contact
  UPDATE recruiter_invitations
  SET status = 'EXPIRED'
  WHERE recruiter_contact_id = p_contact_id
    AND status = 'PENDING'
    AND expires_at <= now();

  -- Check for existing active unexpired pending invitation
  IF EXISTS (
    SELECT 1 FROM recruiter_invitations
    WHERE recruiter_contact_id = p_contact_id
      AND status = 'PENDING'
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'A valid pending invitation already exists for this contact';
  END IF;

  -- Insert fresh invitation row (7-day database-backed expiry)
  INSERT INTO recruiter_invitations (
    recruiter_contact_id,
    invited_by,
    status,
    invited_at,
    expires_at
  ) VALUES (
    p_contact_id,
    v_actor_id,
    'PENDING',
    now(),
    v_expires_at
  ) RETURNING id INTO v_inv_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'RECRUITER_INVITATION_CREATED',
    'recruiter_invitation',
    v_inv_id,
    jsonb_build_object(
      'contact_id', p_contact_id,
      'company_id', v_contact.company_id,
      'expires_at', v_expires_at
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_inv_id,
    'contact_id', p_contact_id,
    'contact_email', v_contact.email,
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION create_recruiter_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_recruiter_invitation(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION revoke_recruiter_invitation(p_invitation_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_inv      recruiter_invitations%ROWTYPE;
BEGIN
  IF NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin or TNP Secretary can revoke recruiter invitations';
  END IF;

  SELECT * INTO v_inv FROM recruiter_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recruiter invitation not found';
  END IF;

  IF v_inv.status != 'PENDING' THEN
    RAISE EXCEPTION 'Cannot revoke an invitation with status %', v_inv.status;
  END IF;

  IF v_inv.expires_at <= now() THEN
    UPDATE recruiter_invitations SET status = 'EXPIRED' WHERE id = p_invitation_id;
    RAISE EXCEPTION 'Cannot revoke an invitation that has already expired';
  END IF;

  UPDATE recruiter_invitations
  SET status = 'REVOKED',
      revoked_by = v_actor_id,
      revoked_at = now()
  WHERE id = p_invitation_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'RECRUITER_INVITATION_REVOKED',
    'recruiter_invitation',
    p_invitation_id,
    jsonb_build_object(
      'contact_id', v_inv.recruiter_contact_id
    )
  );

  RETURN jsonb_build_object('success', true, 'invitation_id', p_invitation_id, 'status', 'REVOKED');
END;
$$;

REVOKE ALL ON FUNCTION revoke_recruiter_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION revoke_recruiter_invitation(UUID) TO authenticated;

-- Confirmation procedure: marks onboarding delivery confirmed for an invitation.
-- Strictly server-controlled; callable only by service_role (or Super Admin / Secretary).
-- Ordinary authenticated users (recruiters, students, coordinators) cannot execute.
CREATE OR REPLACE FUNCTION mark_invitation_delivery_confirmed(p_invitation_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_inv      recruiter_invitations%ROWTYPE;
BEGIN
  -- Strict server-only / staff authorization:
  -- When invoked by authenticated user, caller must be active Super Admin or TNP Secretary.
  -- Service role runs with auth.uid() IS NULL.
  IF v_actor_id IS NOT NULL AND NOT is_admin_or_secretary() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin, TNP Secretary, or server service role can confirm invitation delivery';
  END IF;

  SELECT * INTO v_inv FROM recruiter_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recruiter invitation not found';
  END IF;

  IF v_inv.status != 'PENDING' THEN
    RAISE EXCEPTION 'Cannot confirm delivery: invitation status is %', v_inv.status;
  END IF;

  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Cannot confirm delivery: invitation has expired';
  END IF;

  UPDATE recruiter_invitations
  SET delivery_confirmed_at = now()
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', p_invitation_id);
END;
$$;

REVOKE ALL ON FUNCTION mark_invitation_delivery_confirmed(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_invitation_delivery_confirmed(UUID) FROM anon;
REVOKE ALL ON FUNCTION mark_invitation_delivery_confirmed(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION mark_invitation_delivery_confirmed(UUID) TO service_role;

-- ============================================================================
-- 7. Recruiter Acceptance Procedure (Authenticated Invitee Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_recruiter_invitation()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id     UUID := auth.uid();
  v_auth_email   TEXT;
  v_clean_email  TEXT;
  v_cur_role     user_role;
  v_contact      recruiter_contacts%ROWTYPE;
  v_company      companies%ROWTYPE;
  v_invitation   recruiter_invitations%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept recruiter invitation';
  END IF;

  -- 1. Derive authenticated email securely from auth.users (cannot be forged by caller)
  SELECT email INTO v_auth_email FROM auth.users WHERE id = v_actor_id;
  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'No authenticated email address associated with user session';
  END IF;
  v_clean_email := lower(trim(v_auth_email));

  -- 2. Prevent role escalation / conflict if user already has an institutional role
  SELECT role INTO v_cur_role FROM profiles WHERE id = v_actor_id FOR UPDATE;
  IF v_cur_role IS NOT NULL AND v_cur_role != 'RECRUITER' THEN
    RAISE EXCEPTION 'Cannot accept recruiter invitation: User profile already exists with conflicting role %', v_cur_role;
  END IF;

  -- 3. Match email against institutional CRM recruiter_contacts table
  SELECT * INTO v_contact
  FROM recruiter_contacts
  WHERE lower(trim(email)) = v_clean_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No recruiter contact found matching authenticated email';
  END IF;

  -- 4. Verify contact is active
  IF NOT v_contact.is_active THEN
    RAISE EXCEPTION 'Cannot accept invitation: recruiter contact is inactive';
  END IF;

  -- 5. Verify company is not archived
  SELECT * INTO v_company FROM companies WHERE id = v_contact.company_id;
  IF NOT FOUND OR v_company.is_archived THEN
    RAISE EXCEPTION 'Cannot accept invitation: company is archived';
  END IF;

  -- 6. Verify contact is not already bound to another profile
  IF EXISTS (
    SELECT 1 FROM recruiter_profiles WHERE recruiter_contact_id = v_contact.id
  ) THEN
    RAISE EXCEPTION 'Recruiter contact is already accepted and bound to an account';
  END IF;

  -- 7. Verify user profile is not already bound to another recruiter contact
  IF EXISTS (
    SELECT 1 FROM recruiter_profiles WHERE profile_id = v_actor_id
  ) THEN
    RAISE EXCEPTION 'User already has a bound recruiter profile';
  END IF;

  -- 8. Find latest pending invitation for this contact
  SELECT * INTO v_invitation
  FROM recruiter_invitations
  WHERE recruiter_contact_id = v_contact.id
    AND status = 'PENDING'
  ORDER BY invited_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending invitation found for this contact';
  END IF;

  -- 9. Check direct timestamp expiry
  IF v_invitation.expires_at <= now() THEN
    UPDATE recruiter_invitations SET status = 'EXPIRED' WHERE id = v_invitation.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- 10. Check onboarding delivery confirmation (prevents unsent-pending acceptance)
  IF v_invitation.delivery_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Cannot accept invitation: onboarding delivery has not been confirmed';
  END IF;

  -- 11. Check revocation
  IF v_invitation.status = 'REVOKED' OR v_invitation.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has been revoked';
  END IF;

  -- 11. Atomic transaction: create profile as RECRUITER or update only if existing role is RECRUITER
  INSERT INTO profiles (id, role, display_name, is_active)
  VALUES (v_actor_id, 'RECRUITER', v_contact.full_name, true)
  ON CONFLICT (id) DO UPDATE
  SET role = 'RECRUITER',
      display_name = EXCLUDED.display_name,
      is_active = true,
      updated_at = now()
  WHERE profiles.role = 'RECRUITER';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot accept recruiter invitation: Conflicting institutional role detected on profile';
  END IF;

  -- 12. Bind recruiter profile to contact and company
  INSERT INTO recruiter_profiles (profile_id, recruiter_contact_id, company_id)
  VALUES (v_actor_id, v_contact.id, v_contact.company_id);

  -- 13. Mark invitation as ACCEPTED
  UPDATE recruiter_invitations
  SET status = 'ACCEPTED',
      accepted_at = now()
  WHERE id = v_invitation.id;

  -- 14. Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'RECRUITER_INVITATION_ACCEPTED',
    'recruiter_invitation',
    v_invitation.id,
    jsonb_build_object(
      'contact_id', v_contact.id,
      'company_id', v_contact.company_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company.id,
    'company_name', v_company.name,
    'contact_id', v_contact.id,
    'full_name', v_contact.full_name
  );
END;
$$;

REVOKE ALL ON FUNCTION accept_recruiter_invitation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_recruiter_invitation() TO authenticated;
