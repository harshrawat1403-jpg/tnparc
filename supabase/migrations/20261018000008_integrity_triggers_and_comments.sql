-- Migration 8: Integrity Triggers (updated_at) and Schema Documentation Comments
-- Phase 2 Database Schema Foundation

-- 1. Apply updated_at Triggers Across All Applicable Tables
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_academic_programs_updated_at
  BEFORE UPDATE ON academic_programs
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_student_roster_updated_at
  BEFORE UPDATE ON student_roster
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_student_profiles_updated_at
  BEFORE UPDATE ON student_profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_academic_records_updated_at
  BEFORE UPDATE ON academic_records
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_skills_updated_at
  BEFORE UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_student_skills_updated_at
  BEFORE UPDATE ON student_skills
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_recruiter_contacts_updated_at
  BEFORE UPDATE ON recruiter_contacts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_placement_drives_updated_at
  BEFORE UPDATE ON placement_drives
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_drive_eligibility_updated_at
  BEFORE UPDATE ON drive_eligibility
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- 2. Schema Architectural Comments
COMMENT ON TABLE profiles IS 'Central user identity linking auth.users to roles, active status, and coordinator slots.';
COMMENT ON COLUMN profiles.coordinator_slot IS 'Restricted to SLOT_1 or SLOT_2; valid only for TNP_COORDINATOR role.';
COMMENT ON COLUMN profiles.student_lifecycle_status IS 'STUDENT_ACTIVE, STUDENT_GRADUATED, or ALUMNI; valid only for STUDENT role.';

COMMENT ON TABLE academic_programs IS 'Database-driven academic programs. Modifying programs does not require schema changes.';
COMMENT ON COLUMN academic_programs.placement_eligible IS 'Indicates whether students of this program participate in placement drives by default (PhD is false by default).';

COMMENT ON TABLE student_roster IS 'Authoritative department roster entries used to gate student self-registration.';
COMMENT ON COLUMN student_roster.claimed_by IS 'Profile ID of the student who claimed this roster entry upon email confirmation.';

COMMENT ON TABLE student_profiles IS 'Operational student profile details along with Addendum A1.0 public showcase opt-in fields.';
COMMENT ON COLUMN student_profiles.public_profile_slug IS 'URL-safe slug for public student showcase; immutable once assigned under standard workflows.';

COMMENT ON TABLE academic_records IS 'Official academic records containing verified CGPA and active backlog counts.';

COMMENT ON TABLE skills IS 'Canonical skill catalog managed by TNP administration.';
COMMENT ON TABLE student_skills IS 'Student claimed skills; limited to a maximum of 15 active claims per student.';
COMMENT ON TABLE student_skill_evidence IS 'Supporting evidence for skill claims; requires either a project link or a PDF document, never both.';
COMMENT ON TABLE coordinator_student_scopes IS 'Assignment of coordinator review authority to specific program and batch cohorts.';

COMMENT ON TABLE companies IS 'Canonical recruiter company entities with normalized name deduplication.';
COMMENT ON TABLE recruiter_contacts IS 'Point of contact for a company eligible to receive recruiter invitations.';
COMMENT ON TABLE recruiter_invitations IS 'Tracked invitations for recruiter onboarding with strict 7-day database-backed expiry.';
COMMENT ON TABLE recruiter_profiles IS 'Operational profile mapping authenticated recruiter users to company contacts.';

COMMENT ON TABLE placement_drives IS 'Placement and internship opportunities following the DRAFT -> PUBLISHED -> CLOSED -> ARCHIVED FSM.';
COMMENT ON COLUMN placement_drives.requirements_info IS 'Informational text for candidates; not evaluated by automated eligibility logic.';

COMMENT ON TABLE drive_eligibility IS 'Unified criteria thresholds (minimum CGPA, max backlogs, prior placement exclusion) for a drive.';
COMMENT ON TABLE drive_eligible_batches IS 'Explicit program and batch pairs eligible to participate in a placement drive.';
COMMENT ON TABLE recruiter_drive_access IS 'Scoped authorization grants allowing recruiters to view specific published drives.';

COMMENT ON TABLE applications IS 'Permanent student drive applications with point-in-time academic snapshots.';
COMMENT ON TABLE application_status_history IS 'Append-only ledger recording all application state transitions and corrections.';

COMMENT ON TABLE documents IS 'Metadata for stored student documents, enforcing at most one current resume per student.';
COMMENT ON TABLE announcements IS 'Department notices broadcast to targeted user audiences.';
COMMENT ON TABLE audit_logs IS 'Append-only audit trail capturing security events, administrative changes, and verification actions.';
