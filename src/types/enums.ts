/**
 * Application-wide TypeScript types and constants mirroring PostgreSQL ENUMs
 * and database models defined in ARCHITECTURE.md (v1.0).
 *
 * NOTE: Academic program codes are dynamic records in `academic_programs` and
 * are typed as string aliases, not rigid TypeScript enums.
 */

// User Roles
export type UserRole =
  "STUDENT" | "COORDINATOR" | "OFFICER" | "SUPER_ADMIN" | "RECRUITER";

export const USER_ROLES: readonly UserRole[] = [
  "STUDENT",
  "COORDINATOR",
  "OFFICER",
  "SUPER_ADMIN",
  "RECRUITER",
] as const;

// Drive Types
export type DriveType = "PLACEMENT" | "INTERNSHIP";

export const DRIVE_TYPES: readonly DriveType[] = [
  "PLACEMENT",
  "INTERNSHIP",
] as const;

// Drive Statuses
export type DriveStatus =
  "DRAFT" | "PUBLISHED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const DRIVE_STATUSES: readonly DriveStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

// Application Statuses
export type ApplicationStatus =
  | "APPLIED"
  | "WITHDRAWN"
  | "SHORTLISTED"
  | "TEST_SCHEDULED"
  | "INTERVIEW_SCHEDULED"
  | "REJECTED"
  | "SELECTED";

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "APPLIED",
  "WITHDRAWN",
  "SHORTLISTED",
  "TEST_SCHEDULED",
  "INTERVIEW_SCHEDULED",
  "REJECTED",
  "SELECTED",
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
  | "DRIVE_IN_PROGRESS"
  | "DRIVE_COMPLETED"
  | "DRIVE_CANCELLED"
  | "RECRUITER_DRIVE_GRANTED"
  | "RECRUITER_DRIVE_REVOKED"
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_WITHDRAWN"
  | "APPLICATION_STATUS_UPDATED"
  | "APPLICATION_TERMINAL_OVERRIDE"
  | "ANNOUNCEMENT_CREATED"
  | "SUPER_ADMIN_BOOTSTRAP";
