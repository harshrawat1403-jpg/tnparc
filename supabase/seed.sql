-- Seed Data for Local Development & Schema Verification
-- Department of Architecture & Planning, VNIT Nagpur — TNP Portal
-- Note: Synthetic and development-safe identifiers only; no real PII, students, recruiters, or secrets.

DO $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  -- Insert synthetic auth user for development database validation
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_admin_id) THEN
    INSERT INTO auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      v_admin_id,
      'authenticated',
      'authenticated',
      'dev-admin@vnit.test',
      crypt('devpassword123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Dev Administrator"}'::jsonb,
      now(),
      now()
    );
  END IF;

  -- Insert profile for synthetic admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_admin_id) THEN
    INSERT INTO profiles (
      id,
      role,
      display_name,
      is_active
    )
    VALUES (
      v_admin_id,
      'SUPER_ADMIN',
      'Dev Administrator',
      true
    );
  END IF;

  -- Seed academic programs per approved Architecture policy (§7 / §25):
  -- 1. B.Arch (UG): placement_eligible = true
  -- 2. M.Plan (PG): placement_eligible = true
  -- 3. PhD (DOCTORAL): placement_eligible = false (excluded from placement workflows by default)
  INSERT INTO academic_programs (
    code,
    display_name,
    degree_level,
    duration_years,
    is_active,
    placement_eligible,
    created_by
  )
  VALUES
    ('BARCH', 'Bachelor of Architecture', 'UG', 5, true, true, v_admin_id),
    ('MPLAN', 'Master of Urban Planning', 'PG', 2, true, true, v_admin_id),
    ('PHD', 'Doctor of Philosophy (Architecture & Planning)', 'DOCTORAL', 3, true, false, v_admin_id)
  ON CONFLICT (code) DO NOTHING;

END;
$$;
