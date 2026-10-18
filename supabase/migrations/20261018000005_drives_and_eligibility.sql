-- Migration 5: Placement Drives, Drive Eligibility, Eligible Batches, and Recruiter Drive Access
-- Phase 2 Database Schema Foundation

-- 1. Placement Drives (DRAFT -> PUBLISHED -> CLOSED -> ARCHIVED)
CREATE TABLE placement_drives (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  title                TEXT NOT NULL,
  drive_type           drive_type NOT NULL,
  status               drive_status NOT NULL DEFAULT 'DRAFT',
  description          TEXT,
  location             TEXT,
  application_deadline TIMESTAMPTZ,
  package_lpa          NUMERIC(6,2),
  stipend_monthly      NUMERIC(10,2),
  compensation_details TEXT,
  requirements_info    TEXT,
  created_by           UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  published_by         UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  published_at         TIMESTAMPTZ,
  closed_by            UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  closed_at            TIMESTAMPTZ,
  archived_by          UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  archived_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_deadline_for_published
    CHECK (status = 'DRAFT' OR application_deadline IS NOT NULL),

  CONSTRAINT chk_published_fields
    CHECK (
      (status != 'DRAFT' AND published_by IS NOT NULL AND published_at IS NOT NULL)
      OR status = 'DRAFT'
    )
);

CREATE INDEX idx_drives_status
  ON placement_drives (status);

CREATE INDEX idx_drives_company
  ON placement_drives (company_id);

CREATE INDEX idx_drives_deadline
  ON placement_drives (application_deadline) WHERE status = 'PUBLISHED';

-- Drive Status FSM, Immutability & Lifecycle Timestamps Trigger
CREATE OR REPLACE FUNCTION enforce_drive_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Enforce that all placement drives start in DRAFT on INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW.status != 'DRAFT' THEN
      RAISE EXCEPTION 'Placement drives must be created in DRAFT status';
    END IF;
    IF NEW.published_at IS NOT NULL OR NEW.closed_at IS NOT NULL OR NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Lifecycle timestamps must be NULL on initial drive creation in DRAFT';
    END IF;
    RETURN NEW;
  END IF;

  -- 2. Enforce terminal state: ARCHIVED cannot be modified
  IF OLD.status = 'ARCHIVED' THEN
    RAISE EXCEPTION 'Placement drives in ARCHIVED status are terminal and cannot be modified';
  END IF;

  -- 3. Validate state machine transitions
  IF NOT (
    (OLD.status = 'DRAFT'     AND NEW.status = 'PUBLISHED') OR
    (OLD.status = 'PUBLISHED' AND NEW.status = 'CLOSED')    OR
    (OLD.status = 'CLOSED'    AND NEW.status = 'ARCHIVED')  OR
    (OLD.status = NEW.status)
  ) THEN
    RAISE EXCEPTION 'Invalid drive status transition from % to %', OLD.status, NEW.status;
  END IF;

  -- 4. Ensure company_id and drive_type are immutable after publication
  IF OLD.status != 'DRAFT' THEN
    IF NEW.company_id != OLD.company_id THEN
      RAISE EXCEPTION 'company_id is immutable after drive publication';
    END IF;
    IF NEW.drive_type != OLD.drive_type THEN
      RAISE EXCEPTION 'drive_type is immutable after drive publication';
    END IF;
  END IF;

  -- 5. Maintain and validate lifecycle timestamps
  IF NEW.status = 'DRAFT' THEN
    IF NEW.published_at IS NOT NULL OR NEW.closed_at IS NOT NULL OR NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Lifecycle timestamps must be NULL in DRAFT status';
    END IF;
  ELSIF NEW.status = 'PUBLISHED' THEN
    IF OLD.status = 'DRAFT' THEN
      NEW.published_at := COALESCE(NEW.published_at, now());
    END IF;
    IF NEW.closed_at IS NOT NULL OR NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'closed_at and archived_at must be NULL in PUBLISHED status';
    END IF;
  ELSIF NEW.status = 'CLOSED' THEN
    IF OLD.status = 'PUBLISHED' THEN
      NEW.closed_at := COALESCE(NEW.closed_at, now());
    END IF;
    IF NEW.closed_at < NEW.published_at THEN
      RAISE EXCEPTION 'closed_at cannot precede published_at';
    END IF;
    IF NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'archived_at must be NULL in CLOSED status';
    END IF;
  ELSIF NEW.status = 'ARCHIVED' THEN
    IF OLD.status = 'CLOSED' THEN
      NEW.archived_at := COALESCE(NEW.archived_at, now());
    END IF;
    IF NEW.archived_at < NEW.closed_at THEN
      RAISE EXCEPTION 'archived_at cannot precede closed_at';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_drive_status
  BEFORE INSERT OR UPDATE ON placement_drives
  FOR EACH ROW EXECUTE FUNCTION enforce_drive_status_transition();

-- 2. Drive Eligibility (One row per drive: global criteria thresholds)
CREATE TABLE drive_eligibility (
  id                                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id                              UUID NOT NULL UNIQUE REFERENCES placement_drives(id) ON DELETE CASCADE,
  minimum_cgpa                          NUMERIC(4,2) NOT NULL DEFAULT 0.00,
  maximum_active_backlogs               INTEGER NOT NULL DEFAULT 0,
  exclude_previously_selected_placement BOOLEAN NOT NULL DEFAULT true,
  informational_requirements            TEXT,
  created_at                            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_min_cgpa
    CHECK (minimum_cgpa >= 0.00 AND minimum_cgpa <= 10.00),

  CONSTRAINT chk_max_backlogs
    CHECK (maximum_active_backlogs >= 0)
);

-- 3. Drive Eligible Batches (Per-cohort rows: exact program + batch pairs)
CREATE TABLE drive_eligible_batches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id   UUID NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES academic_programs(id) ON DELETE RESTRICT,
  batch      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_drive_program_batch UNIQUE (drive_id, program_id, batch)
);

CREATE INDEX idx_eligible_drive
  ON drive_eligible_batches (drive_id);

CREATE INDEX idx_eligible_program_batch
  ON drive_eligible_batches (program_id, batch);

-- 4. Recruiter Drive Access (Scoped drive visibility for verified recruiters)
CREATE TABLE recruiter_drive_access (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_profile_id UUID NOT NULL REFERENCES recruiter_profiles(id) ON DELETE CASCADE,
  drive_id             UUID NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
  granted_by           UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  granted_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ,
  revoked_by           UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  revoked_at           TIMESTAMPTZ,

  CONSTRAINT uq_recruiter_drive UNIQUE (recruiter_profile_id, drive_id)
);

CREATE INDEX idx_rda_recruiter
  ON recruiter_drive_access (recruiter_profile_id) WHERE revoked_at IS NULL;
