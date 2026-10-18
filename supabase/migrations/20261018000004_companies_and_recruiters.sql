-- Migration 4: Companies and Recruiters
-- Phase 2 Database Schema Foundation

-- 1. Companies Directory
CREATE TABLE companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  website         TEXT,
  description     TEXT,
  is_archived     BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_normalized_company_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_name := lower(trim(NEW.name));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_company_name
  BEFORE INSERT OR UPDATE OF name ON companies
  FOR EACH ROW EXECUTE FUNCTION set_normalized_company_name();

-- 2. Recruiter Contacts
CREATE TABLE recruiter_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  phone       TEXT,
  designation TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recruiter_contacts_company
  ON recruiter_contacts (company_id);

CREATE OR REPLACE FUNCTION normalize_recruiter_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_recruiter_email
  BEFORE INSERT OR UPDATE OF email ON recruiter_contacts
  FOR EACH ROW EXECUTE FUNCTION normalize_recruiter_email();

-- 3. Recruiter Invitations (Database-backed 7-day expiry and single pending invitation rule)
CREATE TABLE recruiter_invitations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_contact_id UUID NOT NULL REFERENCES recruiter_contacts(id) ON DELETE RESTRICT,
  invited_by           UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status               invitation_status NOT NULL DEFAULT 'PENDING',
  invited_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ NOT NULL,
  accepted_at          TIMESTAMPTZ,
  revoked_by           UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  revoked_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_invitation_expiry
    CHECK (expires_at > invited_at)
);

CREATE UNIQUE INDEX uq_pending_invitation
  ON recruiter_invitations (recruiter_contact_id) WHERE status = 'PENDING';

-- 4. Recruiter Profiles (Links authenticated recruiter user to contact and company)
CREATE TABLE recruiter_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id           UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  recruiter_contact_id UUID NOT NULL UNIQUE REFERENCES recruiter_contacts(id) ON DELETE RESTRICT,
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
