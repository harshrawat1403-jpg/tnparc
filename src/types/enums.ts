/**
 * Application-wide TypeScript types and constants mirroring PostgreSQL ENUMs
 * and database models defined in ARCHITECTURE.md (v1.0) and Addendum A1.0.
 *
 * NOTE: Academic program codes are dynamic records in `academic_programs` and
 * are typed as string aliases, not rigid TypeScript enums.
 */

// User Roles (Super Admin, TNP Secretary, TNP Coordinator, Student, Recruiter)
export type UserRole =
  "SUPER_ADMIN" | "TNP_SECRETARY" | "TNP_COORDINATOR" | "STUDENT" | "RECRUITER";

export const USER_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "TNP_SECRETARY",
  "TNP_COORDINATOR",
  "STUDENT",
  "RECRUITER",
] as const;

// Coordinator Slots
export type CoordinatorSlot = "SLOT_1" | "SLOT_2";

export const COORDINATOR_SLOTS: readonly CoordinatorSlot[] = [
  "SLOT_1",
  "SLOT_2",
] as const;

// Student Lifecycle Status (Approved in Architecture Addendum A1.0 §3.6)
export type StudentLifecycleStatus =
  "STUDENT_ACTIVE" | "STUDENT_GRADUATED" | "ALUMNI";

export const STUDENT_LIFECYCLE_STATUSES: readonly StudentLifecycleStatus[] = [
  "STUDENT_ACTIVE",
  "STUDENT_GRADUATED",
  "ALUMNI",
] as const;

// Verification Statuses
export type VerificationStatus =
  "UNVERIFIED" | "VERIFIED" | "CORRECTION_PENDING";

export const VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  "UNVERIFIED",
  "VERIFIED",
  "CORRECTION_PENDING",
] as const;

// Skill Verification Statuses
export type SkillVerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export const SKILL_VERIFICATION_STATUSES: readonly SkillVerificationStatus[] = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;

// Evidence Types
export type EvidenceType = "PROJECT_LINK" | "PDF_DOCUMENT";

export const EVIDENCE_TYPES: readonly EvidenceType[] = [
  "PROJECT_LINK",
  "PDF_DOCUMENT",
] as const;

// Invitation Statuses
export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export const INVITATION_STATUSES: readonly InvitationStatus[] = [
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "REVOKED",
] as const;

// Drive Types
export type DriveType = "PLACEMENT" | "INTERNSHIP";

export const DRIVE_TYPES: readonly DriveType[] = [
  "PLACEMENT",
  "INTERNSHIP",
] as const;

// Drive Statuses (FSM: DRAFT -> PUBLISHED -> CLOSED -> ARCHIVED)
export type DriveStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";

export const DRIVE_STATUSES: readonly DriveStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "CLOSED",
  "ARCHIVED",
] as const;

// Application Statuses
export type ApplicationStatus =
  | "APPLIED"
  | "SHORTLISTED"
  | "INTERVIEW"
  | "SELECTED"
  | "REJECTED"
  | "WITHDRAWN";

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEW",
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

// Document Types
export type DocumentType = "RESUME" | "SKILL_EVIDENCE" | "PROFILE_PHOTO";

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  "RESUME",
  "SKILL_EVIDENCE",
  "PROFILE_PHOTO",
] as const;

// Announcement Audiences
export type AnnouncementAudience = "ALL" | "STUDENTS" | "RECRUITERS" | "STAFF";

export const ANNOUNCEMENT_AUDIENCES: readonly AnnouncementAudience[] = [
  "ALL",
  "STUDENTS",
  "RECRUITERS",
  "STAFF",
] as const;

// Announcement Statuses
export type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export const ANNOUNCEMENT_STATUSES: readonly AnnouncementStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
] as const;

// Academic Evaluation Result (from eligibility evaluation)
export type AcademicResult = "PASS" | "FAIL" | "UNDETERMINED";

export const ACADEMIC_RESULTS: readonly AcademicResult[] = [
  "PASS",
  "FAIL",
  "UNDETERMINED",
] as const;

// Canonical Eligibility Reason Codes
export type EligibilityReasonCode =
  | "ELIGIBLE"
  | "COURSE_NOT_ELIGIBLE"
  | "BATCH_NOT_ELIGIBLE"
  | "CGPA_BELOW_MINIMUM"
  | "ACTIVE_BACKLOG_LIMIT_EXCEEDED"
  | "PREVIOUSLY_SELECTED_PLACEMENT"
  | "ACADEMIC_DATA_UNAVAILABLE"
  | "ACADEMIC_UNVERIFIED"
  | "DEADLINE_PASSED"
  | "DRIVE_CRITERIA_UNAVAILABLE";

export const ELIGIBILITY_REASON_CODES: readonly EligibilityReasonCode[] = [
  "ELIGIBLE",
  "COURSE_NOT_ELIGIBLE",
  "BATCH_NOT_ELIGIBLE",
  "CGPA_BELOW_MINIMUM",
  "ACTIVE_BACKLOG_LIMIT_EXCEEDED",
  "PREVIOUSLY_SELECTED_PLACEMENT",
  "ACADEMIC_DATA_UNAVAILABLE",
  "ACADEMIC_UNVERIFIED",
  "DEADLINE_PASSED",
  "DRIVE_CRITERIA_UNAVAILABLE",
] as const;

// Skill Taxonomy Categories
export type SkillCategory =
  | "DESIGN_COMPUTATION"
  | "BUILDING_PERFORMANCE"
  | "VISUALIZATION"
  | "PROJECT_MANAGEMENT"
  | "TECHNICAL_DOCUMENTATION";

export const SKILL_CATEGORIES: readonly SkillCategory[] = [
  "DESIGN_COMPUTATION",
  "BUILDING_PERFORMANCE",
  "VISUALIZATION",
  "PROJECT_MANAGEMENT",
  "TECHNICAL_DOCUMENTATION",
] as const;

// Academic Program Code (dynamic string, not a closed enum)
export type AcademicProgramCode = string;

// Canonical Program Code references for department guidance
export const CANONICAL_PROGRAM_CODES = {
  BARCH: "BARCH",
  MPLAN: "MPLAN",
  PHD: "PHD",
} as const;

// Audit Action Types
export type AuditActionType =
  | "ROSTER_ENTRY_CREATED"
  | "ROSTER_CLAIMED"
  | "ROLE_ASSIGNED"
  | "ROLE_REVOKED"
  | "STUDENT_PROFILE_SUBMITTED"
  | "STUDENT_ACADEMIC_VERIFIED"
  | "STUDENT_ACADEMIC_REJECTED"
  | "STUDENT_SKILL_ADDED"
  | "STUDENT_SKILL_REMOVED"
  | "COMPANY_CREATED"
  | "COMPANY_UPDATED"
  | "RECRUITER_INVITED"
  | "RECRUITER_ACCEPTED"
  | "DRIVE_CREATED"
  | "DRIVE_UPDATED"
  | "DRIVE_PUBLISHED"
  | "DRIVE_CLOSED"
  | "DRIVE_ARCHIVED"
  | "RECRUITER_DRIVE_GRANTED"
  | "RECRUITER_DRIVE_REVOKED"
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_WITHDRAWN"
  | "APPLICATION_STATUS_UPDATED"
  | "APPLICATION_TERMINAL_OVERRIDE"
  | "ANNOUNCEMENT_CREATED"
  | "SUPER_ADMIN_BOOTSTRAP";
