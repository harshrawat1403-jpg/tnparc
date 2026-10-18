-- Migration 6: Applications and Application Status History
-- Phase 2 Database Schema Foundation

-- 1. Applications (Permanent placement records with point-in-time snapshot)
CREATE TABLE applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  drive_id          UUID NOT NULL REFERENCES placement_drives(id) ON DELETE RESTRICT,
  status            application_status NOT NULL DEFAULT 'APPLIED',
  applied_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot_cgpa     NUMERIC(4,2) CHECK (snapshot_cgpa IS NULL OR (snapshot_cgpa >= 0.00 AND snapshot_cgpa <= 10.00)),
  snapshot_backlogs INTEGER CHECK (snapshot_backlogs IS NULL OR snapshot_backlogs >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_student_drive UNIQUE (student_id, drive_id)
);

CREATE INDEX idx_applications_student
  ON applications (student_id);

CREATE INDEX idx_applications_drive
  ON applications (drive_id);

CREATE INDEX idx_applications_status
  ON applications (status);

CREATE INDEX idx_applications_drive_status
  ON applications (drive_id, status);

-- 2. Application Status History (Append-only ledger of status transitions)
CREATE TABLE application_status_history (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id         UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  previous_status        application_status,
  new_status             application_status NOT NULL,
  changed_by             UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reason                 TEXT,
  is_terminal_correction BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_history_application
  ON application_status_history (application_id);

CREATE INDEX idx_history_created
  ON application_status_history (created_at);

-- Enforce append-only invariants on application_status_history
CREATE TRIGGER trg_history_no_update
  BEFORE UPDATE ON application_status_history
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_modification();

CREATE TRIGGER trg_history_no_delete
  BEFORE DELETE ON application_status_history
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_modification();
