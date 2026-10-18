-- Migration 7: Documents, Announcements, and Audit Logs
-- Phase 2 Database Schema Foundation

-- 1. Documents (Storage references with current resume uniqueness)
CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type   document_type NOT NULL,
  storage_path    TEXT NOT NULL,
  file_name       TEXT,
  file_size_bytes INTEGER CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  mime_type       TEXT,
  is_current      BOOLEAN NOT NULL DEFAULT true,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one active/current resume per student
CREATE UNIQUE INDEX uq_current_resume
  ON documents (owner_id) WHERE document_type = 'RESUME' AND is_current = true;

CREATE INDEX idx_documents_owner
  ON documents (owner_id);

CREATE INDEX idx_documents_owner_type_current
  ON documents (owner_id, document_type) WHERE is_current = true;

-- 2. Announcements
CREATE TABLE announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  audience     announcement_audience NOT NULL DEFAULT 'ALL',
  status       announcement_status NOT NULL DEFAULT 'DRAFT',
  published_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_status
  ON announcements (status);

CREATE INDEX idx_announcements_audience
  ON announcements (audience) WHERE status = 'PUBLISHED';

-- 3. Audit Logs (Append-only institutional tamper-evident security audit log)
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity
  ON audit_logs (entity_type, entity_id);

CREATE INDEX idx_audit_actor
  ON audit_logs (actor_id);

CREATE INDEX idx_audit_created
  ON audit_logs (created_at);

CREATE INDEX idx_audit_action
  ON audit_logs (action);

-- Enforce append-only invariants on audit_logs
CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_modification();

CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_modification();
