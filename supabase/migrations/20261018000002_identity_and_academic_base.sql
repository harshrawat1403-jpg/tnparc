-- Migration 2: Identity, Academic Programs, Roster, Student Profiles, and Academic Records
-- Phase 2 Database Schema Foundation

-- 1. Profiles Table (maps 1:1 to auth.users)
CREATE TABLE profiles (
  id                       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                     user_role NOT NULL,
  display_name             TEXT NOT NULL,
  avatar_url               TEXT,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  coordinator_slot         coordinator_slot,
  student_lifecycle_status student_lifecycle_status,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_coordinator_slot
    CHECK (
      (role = 'TNP_COORDINATOR' AND coordinator_slot IS NOT NULL)
      OR (role != 'TNP_COORDINATOR' AND coordinator_slot IS NULL)
    ),

  CONSTRAINT chk_lifecycle_status_student_only
    CHECK (
      (role = 'STUDENT' AND student_lifecycle_status IS NOT NULL)
      OR (role != 'STUDENT' AND student_lifecycle_status IS NULL)
    )
);

-- Profiles Cardinality and Role Indexes
CREATE UNIQUE INDEX uq_active_super_admin
  ON profiles (role) WHERE role = 'SUPER_ADMIN' AND is_active = true;

CREATE UNIQUE INDEX uq_active_secretary
  ON profiles (role) WHERE role = 'TNP_SECRETARY' AND is_active = true;

CREATE UNIQUE INDEX uq_active_coordinator_slot
  ON profiles (coordinator_slot) WHERE role = 'TNP_COORDINATOR' AND is_active = true;

CREATE INDEX idx_profiles_role
  ON profiles (role) WHERE is_active = true;

-- 2. Academic Programs (Database-driven academic programs)
CREATE TABLE academic_programs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL UNIQUE,
  display_name       TEXT NOT NULL,
  degree_level       TEXT NOT NULL,
  duration_years     INTEGER NOT NULL CHECK (duration_years > 0),
  is_active          BOOLEAN NOT NULL DEFAULT true,
  placement_eligible BOOLEAN NOT NULL DEFAULT true,
  created_by         UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_programs_active
  ON academic_programs (code) WHERE is_active = true;

-- 3. Student Roster (Pre-verified institutional registration authority)
CREATE TABLE student_roster (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institutional_id    TEXT NOT NULL UNIQUE,
  full_name           TEXT NOT NULL,
  institutional_email TEXT NOT NULL UNIQUE,
  program_id          UUID NOT NULL REFERENCES academic_programs(id) ON DELETE RESTRICT,
  batch               TEXT NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  claimed_by          UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_roster_lookup
  ON student_roster (institutional_email) WHERE is_active = true AND claimed_by IS NULL;

CREATE OR REPLACE FUNCTION normalize_roster_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.institutional_email := lower(trim(NEW.institutional_email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_roster_email
  BEFORE INSERT OR UPDATE OF institutional_email ON student_roster
  FOR EACH ROW EXECUTE FUNCTION normalize_roster_email();

-- 4. Student Profiles (Operational student detail + approved public showcase fields)
CREATE TABLE student_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id               UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  phone                    TEXT,
  portfolio_url            TEXT,
  linkedin_url             TEXT,
  other_links              JSONB NOT NULL DEFAULT '[]'::jsonb,
  bio                      TEXT,
  profile_photo_path       TEXT,
  profile_completeness     INTEGER NOT NULL DEFAULT 0
    CHECK (profile_completeness BETWEEN 0 AND 100),
  -- Approved Addendum A1.0 Showcase Foundations
  public_profile_enabled   BOOLEAN NOT NULL DEFAULT false,
  public_resume_enabled    BOOLEAN NOT NULL DEFAULT false,
  public_portfolio_enabled BOOLEAN NOT NULL DEFAULT false,
  public_profile_slug      TEXT,
  public_headline          TEXT,
  public_tagline           TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_slug_format
    CHECK (public_profile_slug IS NULL OR public_profile_slug ~ '^[a-z0-9][a-z0-9\-]{2,62}$'),

  CONSTRAINT chk_public_requires_slug
    CHECK (
      (public_profile_enabled = false)
      OR (public_profile_enabled = true AND public_profile_slug IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_public_profile_slug
  ON student_profiles (public_profile_slug)
  WHERE public_profile_slug IS NOT NULL;

-- 5. Academic Records (Academic performance and verification status)
CREATE TABLE academic_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE RESTRICT,
  program_id          UUID NOT NULL REFERENCES academic_programs(id) ON DELETE RESTRICT,
  batch               TEXT NOT NULL,
  cgpa                NUMERIC(4,2) CHECK (cgpa IS NULL OR (cgpa >= 0.00 AND cgpa <= 10.00)),
  active_backlogs     INTEGER CHECK (active_backlogs IS NULL OR active_backlogs >= 0),
  verification_status verification_status NOT NULL DEFAULT 'UNVERIFIED',
  verified_by         UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_verified_fields
    CHECK (
      (verification_status = 'VERIFIED' AND verified_by IS NOT NULL AND verified_at IS NOT NULL)
      OR (verification_status != 'VERIFIED')
    )
);

CREATE INDEX idx_academic_program_batch
  ON academic_records (program_id, batch);
