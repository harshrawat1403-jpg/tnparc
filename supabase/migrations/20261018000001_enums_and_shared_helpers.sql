-- Migration 1: Extensions, Enums, and Shared Integrity Helpers
-- Phase 2 Database Schema Foundation

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Role and Lifecycle ENUMs
CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',
  'TNP_SECRETARY',
  'TNP_COORDINATOR',
  'STUDENT',
  'RECRUITER'
);

CREATE TYPE coordinator_slot AS ENUM (
  'SLOT_1',
  'SLOT_2'
);

-- Approved in Architecture Addendum A1.0 §3.6
CREATE TYPE student_lifecycle_status AS ENUM (
  'STUDENT_ACTIVE',
  'STUDENT_GRADUATED',
  'ALUMNI'
);

-- 2. Verification and Evidence ENUMs
CREATE TYPE verification_status AS ENUM (
  'UNVERIFIED',
  'VERIFIED',
  'CORRECTION_PENDING'
);

CREATE TYPE skill_verification_status AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED'
);

CREATE TYPE evidence_type AS ENUM (
  'PROJECT_LINK',
  'PDF_DOCUMENT'
);

-- 3. Recruiter and Drive ENUMs
CREATE TYPE invitation_status AS ENUM (
  'PENDING',
  'ACCEPTED',
  'EXPIRED',
  'REVOKED'
);

CREATE TYPE drive_type AS ENUM (
  'PLACEMENT',
  'INTERNSHIP'
);

CREATE TYPE drive_status AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'CLOSED',
  'ARCHIVED'
);

-- 4. Application and Document ENUMs
CREATE TYPE application_status AS ENUM (
  'APPLIED',
  'SHORTLISTED',
  'INTERVIEW',
  'SELECTED',
  'REJECTED',
  'WITHDRAWN'
);

CREATE TYPE document_type AS ENUM (
  'RESUME',
  'SKILL_EVIDENCE',
  'PROFILE_PHOTO'
);

-- 5. Announcement ENUMs
CREATE TYPE announcement_audience AS ENUM (
  'ALL',
  'STUDENTS',
  'RECRUITERS',
  'STAFF'
);

CREATE TYPE announcement_status AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

-- 6. Shared Append-Only Integrity Function
-- Prevents updates and deletions on audit and status history tables
CREATE OR REPLACE FUNCTION prevent_append_only_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'This table is append-only: % operation is not permitted on %', TG_OP, TG_TABLE_NAME;
END;
$$;

-- 7. Shared Updated-At Trigger Function
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
