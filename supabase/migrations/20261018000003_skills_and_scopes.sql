-- Migration 3: Skills, Student Skills, Evidence, and Coordinator Scopes
-- Phase 2 Database Schema Foundation

-- 1. Skills Catalog
CREATE TABLE skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  category    TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skills_active
  ON skills (name) WHERE is_active = true;

-- 2. Student Skills (Max 15 active claims enforced atomically via trigger)
CREATE TABLE student_skills (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id            UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  proficiency_level   INTEGER NOT NULL CHECK (proficiency_level BETWEEN 1 AND 4),
  verification_status skill_verification_status NOT NULL DEFAULT 'PENDING',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  verified_by         UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_student_skill UNIQUE (student_id, skill_id)
);

CREATE INDEX idx_student_skills_student
  ON student_skills (student_id);

CREATE INDEX idx_student_skills_active
  ON student_skills (student_id) WHERE is_active = true;

CREATE INDEX idx_student_skills_pending
  ON student_skills (verification_status) WHERE verification_status = 'PENDING';

-- Atomic Enforcement of 15 Active Skill Claims Cap
-- Serializes concurrent claim attempts by acquiring an exclusive row-level lock on the student profile
CREATE OR REPLACE FUNCTION enforce_student_skill_claim_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NEW.is_active = true THEN
    -- Serialize concurrent modifications for the same student
    PERFORM 1 FROM profiles WHERE id = NEW.student_id FOR UPDATE;

    SELECT COUNT(*) INTO v_count
    FROM student_skills
    WHERE student_id = NEW.student_id
      AND is_active = true
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

    IF v_count >= 15 THEN
      RAISE EXCEPTION 'Maximum active skill claims limit (15) reached for this student';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_skill_cap
  BEFORE INSERT OR UPDATE OF is_active, student_id ON student_skills
  FOR EACH ROW EXECUTE FUNCTION enforce_student_skill_claim_cap();

-- 3. Student Skill Evidence (Exclusive source: URL OR PDF, never both)
CREATE TABLE student_skill_evidence (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_skill_id UUID NOT NULL REFERENCES student_skills(id) ON DELETE CASCADE,
  evidence_type    evidence_type NOT NULL,
  evidence_url     TEXT,
  storage_path     TEXT,
  description      TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_evidence_source
    CHECK (
      (evidence_type = 'PROJECT_LINK' AND evidence_url IS NOT NULL AND storage_path IS NULL)
      OR (evidence_type = 'PDF_DOCUMENT' AND storage_path IS NOT NULL AND evidence_url IS NULL)
    )
);

CREATE INDEX idx_evidence_skill
  ON student_skill_evidence (student_skill_id);

-- 4. Coordinator Student Scopes (Super Admin bounds coordinator visibility)
CREATE TABLE coordinator_student_scopes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id     UUID NOT NULL REFERENCES academic_programs(id) ON DELETE RESTRICT,
  batch          TEXT NOT NULL,
  granted_by     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_coordinator_scope UNIQUE (coordinator_id, program_id, batch)
);

CREATE INDEX idx_scope_coordinator
  ON coordinator_student_scopes (coordinator_id);
