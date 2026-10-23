export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      academic_programs: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          degree_level: string;
          display_name: string;
          duration_years: number;
          id: string;
          is_active: boolean;
          placement_eligible: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by: string;
          degree_level: string;
          display_name: string;
          duration_years: number;
          id?: string;
          is_active?: boolean;
          placement_eligible?: boolean;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          degree_level?: string;
          display_name?: string;
          duration_years?: number;
          id?: string;
          is_active?: boolean;
          placement_eligible?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_programs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academic_programs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      academic_records: {
        Row: {
          active_backlogs: number | null;
          batch: string;
          cgpa: number | null;
          created_at: string;
          id: string;
          profile_id: string;
          program_id: string;
          updated_at: string;
          verification_status: Database["public"]["Enums"]["verification_status"];
          verified_at: string | null;
          verified_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          active_backlogs?: number | null;
          batch: string;
          cgpa?: number | null;
          created_at?: string;
          id?: string;
          profile_id: string;
          program_id: string;
          updated_at?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          active_backlogs?: number | null;
          batch?: string;
          cgpa?: number | null;
          created_at?: string;
          id?: string;
          profile_id?: string;
          program_id?: string;
          updated_at?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "academic_records_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academic_records_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "academic_records_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "academic_programs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academic_records_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academic_records_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      alumni_employment_history: {
        Row: {
          alumni_id: string;
          city: string | null;
          company_id: string | null;
          country: string | null;
          created_at: string;
          ended_at: string | null;
          id: string;
          notes: string | null;
          organization: string;
          professional_domain: string | null;
          role: string;
          started_at: string;
        };
        ComputedFields: never;
        Insert: {
          alumni_id: string;
          city?: string | null;
          company_id?: string | null;
          country?: string | null;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          notes?: string | null;
          organization: string;
          professional_domain?: string | null;
          role: string;
          started_at: string;
        };
        Update: {
          alumni_id?: string;
          city?: string | null;
          company_id?: string | null;
          country?: string | null;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          notes?: string | null;
          organization?: string;
          professional_domain?: string | null;
          role?: string;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alumni_employment_history_alumni_id_fkey";
            columns: ["alumni_id"];
            isOneToOne: false;
            referencedRelation: "alumni_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumni_employment_history_alumni_id_fkey";
            columns: ["alumni_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_alumni_directory";
            referencedColumns: ["alumni_id"];
          },
          {
            foreignKeyName: "alumni_employment_history_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumni_employment_history_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["company_id"];
          },
        ];
      };
      alumni_profiles: {
        Row: {
          city: string | null;
          company_id: string | null;
          consent_recorded_at: string | null;
          country: string;
          created_at: string;
          current_organization: string | null;
          current_role: string | null;
          graduation_year: number;
          higher_studies_institution: string | null;
          higher_studies_program: string | null;
          higher_studies_year_start: number | null;
          id: string;
          last_verified_at: string | null;
          last_verified_by: string | null;
          linkedin_url: string | null;
          professional_domain: string | null;
          profile_id: string;
          program_id: string;
          public_alumni_enabled: boolean;
          updated_at: string;
          willing_to_mentor: boolean;
          willing_to_refer: boolean;
          willing_to_support_placement: boolean;
        };
        ComputedFields: never;
        Insert: {
          city?: string | null;
          company_id?: string | null;
          consent_recorded_at?: string | null;
          country?: string;
          created_at?: string;
          current_organization?: string | null;
          current_role?: string | null;
          graduation_year: number;
          higher_studies_institution?: string | null;
          higher_studies_program?: string | null;
          higher_studies_year_start?: number | null;
          id?: string;
          last_verified_at?: string | null;
          last_verified_by?: string | null;
          linkedin_url?: string | null;
          professional_domain?: string | null;
          profile_id: string;
          program_id: string;
          public_alumni_enabled?: boolean;
          updated_at?: string;
          willing_to_mentor?: boolean;
          willing_to_refer?: boolean;
          willing_to_support_placement?: boolean;
        };
        Update: {
          city?: string | null;
          company_id?: string | null;
          consent_recorded_at?: string | null;
          country?: string;
          created_at?: string;
          current_organization?: string | null;
          current_role?: string | null;
          graduation_year?: number;
          higher_studies_institution?: string | null;
          higher_studies_program?: string | null;
          higher_studies_year_start?: number | null;
          id?: string;
          last_verified_at?: string | null;
          last_verified_by?: string | null;
          linkedin_url?: string | null;
          professional_domain?: string | null;
          profile_id?: string;
          program_id?: string;
          public_alumni_enabled?: boolean;
          updated_at?: string;
          willing_to_mentor?: boolean;
          willing_to_refer?: boolean;
          willing_to_support_placement?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "alumni_profiles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumni_profiles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "alumni_profiles_last_verified_by_fkey";
            columns: ["last_verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumni_profiles_last_verified_by_fkey";
            columns: ["last_verified_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "alumni_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumni_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "alumni_profiles_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "academic_programs";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          audience: Database["public"]["Enums"]["announcement_audience"];
          body: string;
          created_at: string;
          created_by: string;
          expires_at: string | null;
          id: string;
          published_at: string | null;
          status: Database["public"]["Enums"]["announcement_status"];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          audience?: Database["public"]["Enums"]["announcement_audience"];
          body: string;
          created_at?: string;
          created_by: string;
          expires_at?: string | null;
          id?: string;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["announcement_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          audience?: Database["public"]["Enums"]["announcement_audience"];
          body?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string | null;
          id?: string;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["announcement_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      application_status_history: {
        Row: {
          application_id: string;
          changed_by: string;
          created_at: string;
          id: string;
          is_terminal_correction: boolean;
          new_status: Database["public"]["Enums"]["application_status"];
          previous_status:
            Database["public"]["Enums"]["application_status"] | null;
          reason: string | null;
          transition_sequence: number;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          changed_by: string;
          created_at?: string;
          id?: string;
          is_terminal_correction?: boolean;
          new_status: Database["public"]["Enums"]["application_status"];
          previous_status?:
            Database["public"]["Enums"]["application_status"] | null;
          reason?: string | null;
          transition_sequence?: number;
        };
        Update: {
          application_id?: string;
          changed_by?: string;
          created_at?: string;
          id?: string;
          is_terminal_correction?: boolean;
          new_status?: Database["public"]["Enums"]["application_status"];
          previous_status?:
            Database["public"]["Enums"]["application_status"] | null;
          reason?: string | null;
          transition_sequence?: number;
        };
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "application_status_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_applications";
            referencedColumns: ["application_id"];
          },
          {
            foreignKeyName: "application_status_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["application_id"];
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      applications: {
        Row: {
          applied_at: string;
          created_at: string;
          current_sequence: number;
          drive_id: string;
          id: string;
          snapshot_backlogs: number | null;
          snapshot_cgpa: number | null;
          status: Database["public"]["Enums"]["application_status"];
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          applied_at?: string;
          created_at?: string;
          current_sequence?: number;
          drive_id: string;
          id?: string;
          snapshot_backlogs?: number | null;
          snapshot_cgpa?: number | null;
          status?: Database["public"]["Enums"]["application_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          applied_at?: string;
          created_at?: string;
          current_sequence?: number;
          drive_id?: string;
          id?: string;
          snapshot_backlogs?: number | null;
          snapshot_cgpa?: number | null;
          status?: Database["public"]["Enums"]["application_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "placement_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_recruiter_granted_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_student_published_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          ip_address: unknown;
          metadata: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          ip_address?: unknown;
          metadata?: NonNullable<Json>;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          ip_address?: unknown;
          metadata?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      companies: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          is_archived: boolean;
          name: string;
          normalized_name: string;
          updated_at: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          is_archived?: boolean;
          name: string;
          normalized_name: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          is_archived?: boolean;
          name?: string;
          normalized_name?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "companies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      coordinator_student_scopes: {
        Row: {
          batch: string;
          coordinator_id: string;
          granted_at: string;
          granted_by: string;
          id: string;
          program_id: string;
        };
        ComputedFields: never;
        Insert: {
          batch: string;
          coordinator_id: string;
          granted_at?: string;
          granted_by: string;
          id?: string;
          program_id: string;
        };
        Update: {
          batch?: string;
          coordinator_id?: string;
          granted_at?: string;
          granted_by?: string;
          id?: string;
          program_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coordinator_student_scopes_coordinator_id_fkey";
            columns: ["coordinator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coordinator_student_scopes_coordinator_id_fkey";
            columns: ["coordinator_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "coordinator_student_scopes_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coordinator_student_scopes_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "coordinator_student_scopes_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "academic_programs";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          document_type: Database["public"]["Enums"]["document_type"];
          file_name: string | null;
          file_size_bytes: number | null;
          id: string;
          is_current: boolean;
          mime_type: string | null;
          owner_id: string;
          storage_path: string;
          uploaded_at: string;
        };
        ComputedFields: never;
        Insert: {
          document_type: Database["public"]["Enums"]["document_type"];
          file_name?: string | null;
          file_size_bytes?: number | null;
          id?: string;
          is_current?: boolean;
          mime_type?: string | null;
          owner_id: string;
          storage_path: string;
          uploaded_at?: string;
        };
        Update: {
          document_type?: Database["public"]["Enums"]["document_type"];
          file_name?: string | null;
          file_size_bytes?: number | null;
          id?: string;
          is_current?: boolean;
          mime_type?: string | null;
          owner_id?: string;
          storage_path?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      drive_eligibility: {
        Row: {
          created_at: string;
          drive_id: string;
          exclude_previously_selected_placement: boolean;
          id: string;
          informational_requirements: string | null;
          maximum_active_backlogs: number;
          minimum_cgpa: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          drive_id: string;
          exclude_previously_selected_placement?: boolean;
          id?: string;
          informational_requirements?: string | null;
          maximum_active_backlogs?: number;
          minimum_cgpa?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          drive_id?: string;
          exclude_previously_selected_placement?: boolean;
          id?: string;
          informational_requirements?: string | null;
          maximum_active_backlogs?: number;
          minimum_cgpa?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drive_eligibility_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: true;
            referencedRelation: "placement_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drive_eligibility_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: true;
            referencedRelation: "v_recruiter_granted_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drive_eligibility_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: true;
            referencedRelation: "v_staff_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drive_eligibility_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: true;
            referencedRelation: "v_student_published_drives";
            referencedColumns: ["id"];
          },
        ];
      };
      drive_eligible_batches: {
        Row: {
          batch: string;
          created_at: string;
          drive_id: string;
          id: string;
          program_id: string;
        };
        ComputedFields: never;
        Insert: {
          batch: string;
          created_at?: string;
          drive_id: string;
          id?: string;
          program_id: string;
        };
        Update: {
          batch?: string;
          created_at?: string;
          drive_id?: string;
          id?: string;
          program_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drive_eligible_batches_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "placement_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drive_eligible_batches_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_recruiter_granted_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drive_eligible_batches_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drive_eligible_batches_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_student_published_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drive_eligible_batches_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "academic_programs";
            referencedColumns: ["id"];
          },
        ];
      };
      placement_drives: {
        Row: {
          application_deadline: string | null;
          archived_at: string | null;
          archived_by: string | null;
          closed_at: string | null;
          closed_by: string | null;
          company_id: string;
          compensation_details: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          drive_type: Database["public"]["Enums"]["drive_type"];
          id: string;
          location: string | null;
          package_lpa: number | null;
          published_at: string | null;
          published_by: string | null;
          requirements_info: string | null;
          status: Database["public"]["Enums"]["drive_status"];
          stipend_monthly: number | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          application_deadline?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          company_id: string;
          compensation_details?: string | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          drive_type: Database["public"]["Enums"]["drive_type"];
          id?: string;
          location?: string | null;
          package_lpa?: number | null;
          published_at?: string | null;
          published_by?: string | null;
          requirements_info?: string | null;
          status?: Database["public"]["Enums"]["drive_status"];
          stipend_monthly?: number | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          application_deadline?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          company_id?: string;
          compensation_details?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          drive_type?: Database["public"]["Enums"]["drive_type"];
          id?: string;
          location?: string | null;
          package_lpa?: number | null;
          published_at?: string | null;
          published_by?: string | null;
          requirements_info?: string | null;
          status?: Database["public"]["Enums"]["drive_status"];
          stipend_monthly?: number | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "placement_drives_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "placement_drives_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "placement_drives_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "placement_drives_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "placement_drives_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          coordinator_slot:
            Database["public"]["Enums"]["coordinator_slot"] | null;
          created_at: string;
          display_name: string;
          id: string;
          is_active: boolean;
          role: Database["public"]["Enums"]["user_role"];
          student_lifecycle_status:
            Database["public"]["Enums"]["student_lifecycle_status"] | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          coordinator_slot?:
            Database["public"]["Enums"]["coordinator_slot"] | null;
          created_at?: string;
          display_name: string;
          id: string;
          is_active?: boolean;
          role: Database["public"]["Enums"]["user_role"];
          student_lifecycle_status?:
            Database["public"]["Enums"]["student_lifecycle_status"] | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          coordinator_slot?:
            Database["public"]["Enums"]["coordinator_slot"] | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          student_lifecycle_status?:
            Database["public"]["Enums"]["student_lifecycle_status"] | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      recruiter_contacts: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string;
          designation: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          created_by: string;
          designation?: string | null;
          email: string;
          full_name: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string;
          designation?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recruiter_contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "recruiter_contacts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_contacts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      recruiter_drive_access: {
        Row: {
          drive_id: string;
          expires_at: string | null;
          granted_at: string;
          granted_by: string;
          id: string;
          recruiter_profile_id: string;
          revoked_at: string | null;
          revoked_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          drive_id: string;
          expires_at?: string | null;
          granted_at?: string;
          granted_by: string;
          id?: string;
          recruiter_profile_id: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
        };
        Update: {
          drive_id?: string;
          expires_at?: string | null;
          granted_at?: string;
          granted_by?: string;
          id?: string;
          recruiter_profile_id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recruiter_drive_access_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "placement_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_drive_access_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_recruiter_granted_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_drive_access_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_drive_access_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_student_published_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_drive_access_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_drive_access_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "recruiter_drive_access_recruiter_profile_id_fkey";
            columns: ["recruiter_profile_id"];
            isOneToOne: false;
            referencedRelation: "recruiter_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_drive_access_recruiter_profile_id_fkey";
            columns: ["recruiter_profile_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_recruiter_contacts";
            referencedColumns: ["recruiter_profile_id"];
          },
          {
            foreignKeyName: "recruiter_drive_access_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_drive_access_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      recruiter_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          delivery_confirmed_at: string | null;
          expires_at: string;
          id: string;
          invited_at: string;
          invited_by: string;
          recruiter_contact_id: string;
          revoked_at: string | null;
          revoked_by: string | null;
          status: Database["public"]["Enums"]["invitation_status"];
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          delivery_confirmed_at?: string | null;
          expires_at: string;
          id?: string;
          invited_at?: string;
          invited_by: string;
          recruiter_contact_id: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          status?: Database["public"]["Enums"]["invitation_status"];
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          delivery_confirmed_at?: string | null;
          expires_at?: string;
          id?: string;
          invited_at?: string;
          invited_by?: string;
          recruiter_contact_id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          status?: Database["public"]["Enums"]["invitation_status"];
        };
        Relationships: [
          {
            foreignKeyName: "recruiter_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "recruiter_invitations_recruiter_contact_id_fkey";
            columns: ["recruiter_contact_id"];
            isOneToOne: false;
            referencedRelation: "recruiter_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_invitations_recruiter_contact_id_fkey";
            columns: ["recruiter_contact_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_recruiter_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_invitations_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_invitations_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      recruiter_profiles: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          profile_id: string;
          recruiter_contact_id: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          profile_id: string;
          recruiter_contact_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          profile_id?: string;
          recruiter_contact_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recruiter_profiles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_profiles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "recruiter_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "recruiter_profiles_recruiter_contact_id_fkey";
            columns: ["recruiter_contact_id"];
            isOneToOne: true;
            referencedRelation: "recruiter_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_profiles_recruiter_contact_id_fkey";
            columns: ["recruiter_contact_id"];
            isOneToOne: true;
            referencedRelation: "v_staff_recruiter_contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      skills: {
        Row: {
          category: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category?: string | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "skills_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "skills_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      student_profiles: {
        Row: {
          bio: string | null;
          created_at: string;
          id: string;
          linkedin_url: string | null;
          other_links: NonNullable<Json>;
          phone: string | null;
          portfolio_url: string | null;
          profile_completeness: number;
          profile_id: string;
          profile_photo_path: string | null;
          public_headline: string | null;
          public_portfolio_enabled: boolean;
          public_profile_enabled: boolean;
          public_profile_slug: string | null;
          public_resume_enabled: boolean;
          public_tagline: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bio?: string | null;
          created_at?: string;
          id?: string;
          linkedin_url?: string | null;
          other_links?: NonNullable<Json>;
          phone?: string | null;
          portfolio_url?: string | null;
          profile_completeness?: number;
          profile_id: string;
          profile_photo_path?: string | null;
          public_headline?: string | null;
          public_portfolio_enabled?: boolean;
          public_profile_enabled?: boolean;
          public_profile_slug?: string | null;
          public_resume_enabled?: boolean;
          public_tagline?: string | null;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          id?: string;
          linkedin_url?: string | null;
          other_links?: NonNullable<Json>;
          phone?: string | null;
          portfolio_url?: string | null;
          profile_completeness?: number;
          profile_id?: string;
          profile_photo_path?: string | null;
          public_headline?: string | null;
          public_portfolio_enabled?: boolean;
          public_profile_enabled?: boolean;
          public_profile_slug?: string | null;
          public_resume_enabled?: boolean;
          public_tagline?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      student_roster: {
        Row: {
          batch: string;
          claimed_by: string | null;
          created_at: string;
          full_name: string;
          id: string;
          institutional_email: string;
          institutional_id: string;
          is_active: boolean;
          program_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          batch: string;
          claimed_by?: string | null;
          created_at?: string;
          full_name: string;
          id?: string;
          institutional_email: string;
          institutional_id: string;
          is_active?: boolean;
          program_id: string;
          updated_at?: string;
        };
        Update: {
          batch?: string;
          claimed_by?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          institutional_email?: string;
          institutional_id?: string;
          is_active?: boolean;
          program_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_roster_claimed_by_fkey";
            columns: ["claimed_by"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_roster_claimed_by_fkey";
            columns: ["claimed_by"];
            isOneToOne: true;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_roster_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "academic_programs";
            referencedColumns: ["id"];
          },
        ];
      };
      student_skill_evidence: {
        Row: {
          description: string | null;
          evidence_type: Database["public"]["Enums"]["evidence_type"];
          evidence_url: string | null;
          id: string;
          storage_path: string | null;
          student_skill_id: string;
          submitted_at: string;
        };
        ComputedFields: never;
        Insert: {
          description?: string | null;
          evidence_type: Database["public"]["Enums"]["evidence_type"];
          evidence_url?: string | null;
          id?: string;
          storage_path?: string | null;
          student_skill_id: string;
          submitted_at?: string;
        };
        Update: {
          description?: string | null;
          evidence_type?: Database["public"]["Enums"]["evidence_type"];
          evidence_url?: string | null;
          id?: string;
          storage_path?: string | null;
          student_skill_id?: string;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_skill_evidence_student_skill_id_fkey";
            columns: ["student_skill_id"];
            isOneToOne: false;
            referencedRelation: "student_skills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_skill_evidence_student_skill_id_fkey";
            columns: ["student_skill_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_skill_reviews";
            referencedColumns: ["student_skill_id"];
          },
        ];
      };
      student_skills: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          proficiency_level: number;
          skill_id: string;
          student_id: string;
          updated_at: string;
          verification_status: Database["public"]["Enums"]["skill_verification_status"];
          verified_at: string | null;
          verified_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          proficiency_level: number;
          skill_id: string;
          student_id: string;
          updated_at?: string;
          verification_status?: Database["public"]["Enums"]["skill_verification_status"];
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          proficiency_level?: number;
          skill_id?: string;
          student_id?: string;
          updated_at?: string;
          verification_status?: Database["public"]["Enums"]["skill_verification_status"];
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_skills_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_skills_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_skill_reviews";
            referencedColumns: ["skill_id"];
          },
          {
            foreignKeyName: "student_skills_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_skills_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_skills_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_skills_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
    };
    Views: {
      v_recruiter_granted_drives: {
        Row: {
          access_grant_id: string | null;
          application_deadline: string | null;
          company_id: string | null;
          company_name: string | null;
          company_website: string | null;
          compensation_details: string | null;
          description: string | null;
          drive_type: Database["public"]["Enums"]["drive_type"] | null;
          expires_at: string | null;
          granted_at: string | null;
          id: string | null;
          is_open: boolean | null;
          location: string | null;
          package_lpa: number | null;
          published_at: string | null;
          requirements_info: string | null;
          status: Database["public"]["Enums"]["drive_status"] | null;
          stipend_monthly: number | null;
          title: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "placement_drives_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["company_id"];
          },
        ];
      };
      v_staff_alumni_directory: {
        Row: {
          alumni_id: string | null;
          city: string | null;
          company_id: string | null;
          company_is_archived: boolean | null;
          company_name: string | null;
          company_website: string | null;
          consent_recorded_at: string | null;
          country: string | null;
          created_at: string | null;
          current_employer: string | null;
          current_organization: string | null;
          current_role: string | null;
          graduation_year: number | null;
          higher_studies_institution: string | null;
          higher_studies_program: string | null;
          higher_studies_year_start: number | null;
          last_verified_at: string | null;
          last_verified_by: string | null;
          linkedin_url: string | null;
          professional_domain: string | null;
          profile_id: string | null;
          program_code: string | null;
          program_id: string | null;
          program_name: string | null;
          public_alumni_enabled: boolean | null;
          student_is_active: boolean | null;
          student_lifecycle_status:
            Database["public"]["Enums"]["student_lifecycle_status"] | null;
          student_name: string | null;
          updated_at: string | null;
          willing_to_mentor: boolean | null;
          willing_to_refer: boolean | null;
          willing_to_support_placement: boolean | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "alumni_profiles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumni_profiles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "alumni_profiles_last_verified_by_fkey";
            columns: ["last_verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumni_profiles_last_verified_by_fkey";
            columns: ["last_verified_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "alumni_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumni_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "alumni_profiles_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "academic_programs";
            referencedColumns: ["id"];
          },
        ];
      };
      v_staff_alumni_employment_history: {
        Row: {
          alumni_id: string | null;
          city: string | null;
          company_id: string | null;
          company_name: string | null;
          country: string | null;
          created_at: string | null;
          employment_id: string | null;
          ended_at: string | null;
          notes: string | null;
          organization: string | null;
          professional_domain: string | null;
          profile_id: string | null;
          role: string | null;
          started_at: string | null;
          student_name: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "alumni_employment_history_alumni_id_fkey";
            columns: ["alumni_id"];
            isOneToOne: false;
            referencedRelation: "alumni_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumni_employment_history_alumni_id_fkey";
            columns: ["alumni_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_alumni_directory";
            referencedColumns: ["alumni_id"];
          },
          {
            foreignKeyName: "alumni_employment_history_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumni_employment_history_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "alumni_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumni_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      v_staff_application_history: {
        Row: {
          application_id: string | null;
          changed_by: string | null;
          changed_by_name: string | null;
          changed_by_role: Database["public"]["Enums"]["user_role"] | null;
          created_at: string | null;
          id: string | null;
          is_terminal_correction: boolean | null;
          new_status: Database["public"]["Enums"]["application_status"] | null;
          previous_status:
            Database["public"]["Enums"]["application_status"] | null;
          reason: string | null;
          transition_sequence: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "application_status_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_applications";
            referencedColumns: ["application_id"];
          },
          {
            foreignKeyName: "application_status_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["application_id"];
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      v_staff_applications: {
        Row: {
          application_deadline: string | null;
          application_id: string | null;
          application_status:
            Database["public"]["Enums"]["application_status"] | null;
          applied_at: string | null;
          company_id: string | null;
          company_name: string | null;
          drive_id: string | null;
          drive_status: Database["public"]["Enums"]["drive_status"] | null;
          drive_title: string | null;
          drive_type: Database["public"]["Enums"]["drive_type"] | null;
          program_code: string | null;
          program_id: string | null;
          program_name: string | null;
          snapshot_backlogs: number | null;
          snapshot_cgpa: number | null;
          student_batch: string | null;
          student_id: string | null;
          student_name: string | null;
          updated_at: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "academic_records_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "academic_programs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "placement_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_recruiter_granted_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_student_published_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "placement_drives_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["company_id"];
          },
        ];
      };
      v_staff_drives: {
        Row: {
          application_deadline: string | null;
          archived_at: string | null;
          archived_by: string | null;
          archived_by_name: string | null;
          closed_at: string | null;
          closed_by: string | null;
          closed_by_name: string | null;
          company_id: string | null;
          company_is_archived: boolean | null;
          company_name: string | null;
          compensation_details: string | null;
          created_at: string | null;
          created_by: string | null;
          created_by_name: string | null;
          description: string | null;
          drive_type: Database["public"]["Enums"]["drive_type"] | null;
          eligible_batches_count: number | null;
          id: string | null;
          location: string | null;
          package_lpa: number | null;
          published_at: string | null;
          published_by: string | null;
          published_by_name: string | null;
          recruiter_grants_count: number | null;
          requirements_info: string | null;
          status: Database["public"]["Enums"]["drive_status"] | null;
          stipend_monthly: number | null;
          title: string | null;
          updated_at: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "placement_drives_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "placement_drives_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "placement_drives_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "placement_drives_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "placement_drives_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      v_staff_recruiter_contacts: {
        Row: {
          bound_profile_id: string | null;
          company_id: string | null;
          company_is_archived: boolean | null;
          company_name: string | null;
          computed_invitation_status: string | null;
          created_at: string | null;
          designation: string | null;
          email: string | null;
          full_name: string | null;
          id: string | null;
          is_active: boolean | null;
          latest_accepted_at: string | null;
          latest_delivery_confirmed_at: string | null;
          latest_expires_at: string | null;
          latest_invitation_id: string | null;
          latest_invited_at: string | null;
          latest_revoked_at: string | null;
          phone: string | null;
          recruiter_profile_id: string | null;
          updated_at: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "recruiter_contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "recruiter_profiles_profile_id_fkey";
            columns: ["bound_profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_profiles_profile_id_fkey";
            columns: ["bound_profile_id"];
            isOneToOne: true;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      v_staff_skill_reviews: {
        Row: {
          batch: string | null;
          claim_created_at: string | null;
          claim_updated_at: string | null;
          evidence_description: string | null;
          evidence_id: string | null;
          evidence_storage_path: string | null;
          evidence_submitted_at: string | null;
          evidence_type: Database["public"]["Enums"]["evidence_type"] | null;
          evidence_url: string | null;
          is_active: boolean | null;
          proficiency_level: number | null;
          program_code: string | null;
          program_name: string | null;
          skill_category: string | null;
          skill_id: string | null;
          skill_name: string | null;
          student_id: string | null;
          student_name: string | null;
          student_skill_id: string | null;
          verification_status:
            Database["public"]["Enums"]["skill_verification_status"] | null;
          verified_at: string | null;
          verified_by: string | null;
          verifier_name: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "student_skills_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_skills_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_skills_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_skills_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      v_staff_student_public_profiles: {
        Row: {
          batch: string | null;
          has_photo: boolean | null;
          portfolio_url: string | null;
          program_code: string | null;
          program_name: string | null;
          public_headline: string | null;
          public_portfolio_enabled: boolean | null;
          public_profile_enabled: boolean | null;
          public_profile_slug: string | null;
          public_resume_enabled: boolean | null;
          public_tagline: string | null;
          student_email: string | null;
          student_id: string | null;
          student_lifecycle_status:
            Database["public"]["Enums"]["student_lifecycle_status"] | null;
          student_name: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_student_application_timeline: {
        Row: {
          application_id: string | null;
          created_at: string | null;
          id: string | null;
          new_status: Database["public"]["Enums"]["application_status"] | null;
          previous_status:
            Database["public"]["Enums"]["application_status"] | null;
          transition_sequence: number | null;
        };
        ComputedFields: never;
        Insert: {
          application_id?: string | null;
          created_at?: string | null;
          id?: string | null;
          new_status?: Database["public"]["Enums"]["application_status"] | null;
          previous_status?:
            Database["public"]["Enums"]["application_status"] | null;
          transition_sequence?: number | null;
        };
        Update: {
          application_id?: string | null;
          created_at?: string | null;
          id?: string | null;
          new_status?: Database["public"]["Enums"]["application_status"] | null;
          previous_status?:
            Database["public"]["Enums"]["application_status"] | null;
          transition_sequence?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "application_status_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_applications";
            referencedColumns: ["application_id"];
          },
          {
            foreignKeyName: "application_status_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["application_id"];
          },
        ];
      };
      v_student_applications: {
        Row: {
          application_deadline: string | null;
          application_id: string | null;
          application_status:
            Database["public"]["Enums"]["application_status"] | null;
          applied_at: string | null;
          can_withdraw: boolean | null;
          company_id: string | null;
          company_name: string | null;
          company_website: string | null;
          drive_id: string | null;
          drive_status: Database["public"]["Enums"]["drive_status"] | null;
          drive_title: string | null;
          drive_type: Database["public"]["Enums"]["drive_type"] | null;
          snapshot_backlogs: number | null;
          snapshot_cgpa: number | null;
          student_id: string | null;
          updated_at: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "applications_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "placement_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_recruiter_granted_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_drive_id_fkey";
            columns: ["drive_id"];
            isOneToOne: false;
            referencedRelation: "v_student_published_drives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_staff_student_public_profiles";
            referencedColumns: ["student_id"];
          },
        ];
      };
      v_student_published_drives: {
        Row: {
          application_deadline: string | null;
          company_id: string | null;
          company_name: string | null;
          company_website: string | null;
          compensation_details: string | null;
          description: string | null;
          drive_type: Database["public"]["Enums"]["drive_type"] | null;
          id: string | null;
          is_open: boolean | null;
          location: string | null;
          package_lpa: number | null;
          published_at: string | null;
          requirements_info: string | null;
          status: Database["public"]["Enums"]["drive_status"] | null;
          stipend_monthly: number | null;
          title: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "placement_drives_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "v_student_applications";
            referencedColumns: ["company_id"];
          },
        ];
      };
    };
    Functions: {
      _coordinator_has_scope_over: {
        Args: { p_student_id: string };
        Returns: boolean;
      };
      _evaluate_eligibility_for_student: {
        Args: { p_drive_id: string; p_student_id: string };
        Returns: {
          academic_result: string;
          is_available: boolean;
          reason_codes: string[];
        }[];
      };
      _get_public_avatar_storage_path: {
        Args: { p_slug: string };
        Returns: string;
      };
      _is_student_publicly_eligible: {
        Args: { p_profile_id: string };
        Returns: boolean;
      };
      accept_recruiter_invitation: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      add_own_alumni_employment: {
        Args: {
          p_city?: string;
          p_company_id?: string;
          p_country?: string;
          p_ended_at?: string;
          p_notes?: string;
          p_organization: string;
          p_professional_domain?: string;
          p_role: string;
          p_started_at: string;
        };
        Returns: Json;
      };
      admin_reassign_profile_slug: {
        Args: {
          p_new_slug: string;
          p_reason: string;
          p_target_student_id: string;
        };
        Returns: Json;
      };
      apply_to_drive: { Args: { p_drive_id: string }; Returns: Json };
      archive_announcement: {
        Args: { p_announcement_id: string };
        Returns: Json;
      };
      archive_company: { Args: { p_company_id: string }; Returns: Json };
      archive_placement_drive: { Args: { p_drive_id: string }; Returns: Json };
      archive_student_skill: {
        Args: { p_student_skill_id: string };
        Returns: Json;
      };
      assign_role: {
        Args: {
          p_coordinator_slot?: Database["public"]["Enums"]["coordinator_slot"];
          p_new_role: Database["public"]["Enums"]["user_role"];
          p_target_profile_id: string;
        };
        Returns: Json;
      };
      calculate_student_profile_completeness: {
        Args: { p_student_id: string };
        Returns: number;
      };
      can_access_student: { Args: { p_student_id: string }; Returns: boolean };
      can_current_user_access_student: {
        Args: { p_student_id: string };
        Returns: boolean;
      };
      can_staff_access_photo_object: {
        Args: { p_object_name: string };
        Returns: boolean;
      };
      can_staff_access_resume_object: {
        Args: { p_object_name: string };
        Returns: boolean;
      };
      can_staff_access_skill_evidence: {
        Args: { p_object_name: string };
        Returns: boolean;
      };
      can_student_access_own_skill_evidence: {
        Args: { p_object_name: string };
        Returns: boolean;
      };
      can_view_announcement: {
        Args: {
          p_audience: Database["public"]["Enums"]["announcement_audience"];
          p_expires_at: string;
          p_published_at: string;
          p_status: Database["public"]["Enums"]["announcement_status"];
        };
        Returns: boolean;
      };
      claim_student_skill: {
        Args: { p_proficiency_level: number; p_skill_id: string };
        Returns: Json;
      };
      close_placement_drive: { Args: { p_drive_id: string }; Returns: Json };
      company_has_published_drive: {
        Args: { p_company_id: string };
        Returns: boolean;
      };
      configure_drive_eligibility: {
        Args: {
          p_drive_id: string;
          p_exclude_previously_selected_placement?: boolean;
          p_informational_requirements?: string;
          p_maximum_active_backlogs: number;
          p_minimum_cgpa: number;
        };
        Returns: Json;
      };
      configure_drive_eligible_batches: {
        Args: { p_batches: Json; p_drive_id: string };
        Returns: Json;
      };
      convert_student_to_alumni: {
        Args: {
          p_city?: string;
          p_company_id?: string;
          p_country?: string;
          p_current_organization?: string;
          p_current_role?: string;
          p_linkedin_url?: string;
          p_professional_domain?: string;
          p_reason?: string;
          p_student_id: string;
        };
        Returns: Json;
      };
      correct_student_academic_record: {
        Args: {
          p_active_backlogs: number;
          p_cgpa: number;
          p_reason: string;
          p_target_profile_id: string;
        };
        Returns: Json;
      };
      correct_terminal_status: {
        Args: { p_application_id: string; p_reason: string };
        Returns: Json;
      };
      create_announcement: {
        Args: {
          p_audience?: Database["public"]["Enums"]["announcement_audience"];
          p_body: string;
          p_expires_at?: string;
          p_title: string;
        };
        Returns: string;
      };
      create_company: {
        Args: { p_description?: string; p_name: string; p_website?: string };
        Returns: Json;
      };
      create_placement_drive: {
        Args: {
          p_application_deadline?: string;
          p_company_id: string;
          p_compensation_details?: string;
          p_description?: string;
          p_drive_type: Database["public"]["Enums"]["drive_type"];
          p_location?: string;
          p_package_lpa?: number;
          p_requirements_info?: string;
          p_stipend_monthly?: number;
          p_title: string;
        };
        Returns: Json;
      };
      create_recruiter_contact: {
        Args: {
          p_company_id: string;
          p_designation?: string;
          p_email: string;
          p_full_name: string;
          p_phone?: string;
        };
        Returns: Json;
      };
      create_recruiter_invitation: {
        Args: { p_contact_id: string };
        Returns: Json;
      };
      create_skill: {
        Args: { p_category?: string; p_description?: string; p_name: string };
        Returns: Json;
      };
      deactivate_recruiter_contact: {
        Args: { p_contact_id: string };
        Returns: Json;
      };
      deactivate_skill: { Args: { p_skill_id: string }; Returns: Json };
      get_my_announcements: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: {
          audience: Database["public"]["Enums"]["announcement_audience"];
          body: string;
          expires_at: string;
          id: string;
          published_at: string;
          title: string;
        }[];
      };
      get_my_drive_eligibility: {
        Args: { p_drive_id: string };
        Returns: {
          academic_result: string;
          is_available: boolean;
          reason_codes: string[];
        }[];
      };
      get_my_lifecycle: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["student_lifecycle_status"];
      };
      get_my_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      get_public_alumni_directory: {
        Args: {
          p_graduation_year?: number;
          p_limit?: number;
          p_offset?: number;
          p_program_code?: string;
          p_search?: string;
        };
        Returns: {
          city: string;
          country: string;
          current_employer: string;
          designation: string;
          graduation_year: number;
          name: string;
          professional_domain: string;
          program_code: string;
          program_name: string;
          total_count: number;
        }[];
      };
      get_public_batch_page: {
        Args: {
          p_batch: string;
          p_has_portfolio?: boolean;
          p_limit?: number;
          p_offset?: number;
          p_program_code?: string;
          p_search?: string;
          p_skill?: string;
        };
        Returns: {
          graduation_batch: string;
          has_photo: boolean;
          headline: string;
          name: string;
          portfolio_available: boolean;
          portfolio_url: string;
          program_code: string;
          program_name: string;
          resume_available: boolean;
          slug: string;
          tagline: string;
          top_skills: Json;
          total_count: number;
        }[];
      };
      get_public_batches: {
        Args: Record<PropertyKey, never>;
        Returns: {
          batch: string;
          program_code: string;
          program_name: string;
          student_count: number;
        }[];
      };
      get_public_student_profile: {
        Args: { p_slug: string };
        Returns: {
          graduation_batch: string;
          has_photo: boolean;
          headline: string;
          linkedin_url: string;
          name: string;
          portfolio_available: boolean;
          portfolio_url: string;
          program_code: string;
          program_name: string;
          resume_available: boolean;
          slug: string;
          tagline: string;
          verified_skills: Json;
        }[];
      };
      get_staff_alumni_analytics: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_staff_alumni_by_company: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: {
          alumni_count: number;
          company_id: string;
          company_name: string;
          is_canonical: boolean;
        }[];
      };
      get_staff_alumni_by_year: {
        Args: Record<PropertyKey, never>;
        Returns: {
          alumni_count: number;
          graduation_year: number;
        }[];
      };
      get_staff_alumni_outreach_candidates: {
        Args: { p_limit?: number; p_offset?: number; p_preference?: string };
        Returns: {
          alumni_id: string;
          city: string;
          country: string;
          current_employer: string;
          designation: string;
          graduation_year: number;
          linkedin_url: string;
          name: string;
          profile_id: string;
          program_code: string;
          program_name: string;
          total_count: number;
          willing_to_mentor: boolean;
          willing_to_refer: boolean;
          willing_to_support_placement: boolean;
        }[];
      };
      get_staff_announcements: {
        Args: {
          p_audience?: Database["public"]["Enums"]["announcement_audience"];
          p_limit?: number;
          p_offset?: number;
          p_status?: Database["public"]["Enums"]["announcement_status"];
        };
        Returns: {
          audience: Database["public"]["Enums"]["announcement_audience"];
          body: string;
          created_at: string;
          created_by: string;
          creator_name: string;
          expires_at: string;
          id: string;
          published_at: string;
          status: Database["public"]["Enums"]["announcement_status"];
          title: string;
          updated_at: string;
        }[];
      };
      get_staff_companies_by_year: {
        Args: { p_limit?: number; p_year?: number };
        Returns: {
          company_id: string;
          company_name: string;
          students_selected: number;
          year: number;
        }[];
      };
      get_staff_conversion_statistics: {
        Args: { p_limit?: number; p_year?: number };
        Returns: {
          company_name: string;
          conversion_pct: number;
          drive_id: string;
          drive_status: string;
          drive_title: string;
          drive_type: string;
          published_year: number;
          total_applied: number;
          total_selected: number;
        }[];
      };
      get_staff_drive_statistics: {
        Args: { p_from_year?: number; p_to_year?: number };
        Returns: {
          internship_drives: number;
          placement_drives: number;
          total_drives: number;
          year: number;
        }[];
      };
      get_staff_export_data: {
        Args: { p_export_type: string; p_filters?: Json };
        Returns: Json;
      };
      get_staff_internship_placement_conversion: {
        Args: Record<PropertyKey, never>;
        Returns: {
          conversion_rate_pct: number;
          converted_to_placement: number;
          total_internship_selected: number;
        }[];
      };
      get_staff_repeat_recruiters: {
        Args: Record<PropertyKey, never>;
        Returns: {
          company_id: string;
          company_name: string;
          first_year: number;
          latest_year: number;
          total_drives: number;
          years_recruited: number;
        }[];
      };
      get_student_lifecycle_status: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["student_lifecycle_status"];
      };
      get_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      grant_recruiter_drive_access: {
        Args: {
          p_drive_id: string;
          p_expires_at?: string;
          p_recruiter_profile_id: string;
        };
        Returns: Json;
      };
      is_active_alumni: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_active_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_active_student: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_admin_or_secretary: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_current_user_active_student: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_super_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      mark_invitation_delivery_confirmed: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      mark_student_graduated: {
        Args: { p_reason: string; p_student_id: string };
        Returns: Json;
      };
      match_alumni_company: {
        Args: { p_alumni_id: string; p_company_id: string; p_reason: string };
        Returns: Json;
      };
      provision_student_account: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      publish_announcement: {
        Args: { p_announcement_id: string };
        Returns: Json;
      };
      publish_placement_drive: { Args: { p_drive_id: string }; Returns: Json };
      reactivate_company: { Args: { p_company_id: string }; Returns: Json };
      reactivate_recruiter_contact: {
        Args: { p_contact_id: string };
        Returns: Json;
      };
      reactivate_skill: { Args: { p_skill_id: string }; Returns: Json };
      record_export_audit: {
        Args: {
          p_export_type: string;
          p_filter_summary?: Json;
          p_row_count?: number;
        };
        Returns: boolean;
      };
      register_skill_evidence_pdf: {
        Args: {
          p_description?: string;
          p_storage_path: string;
          p_student_skill_id: string;
        };
        Returns: Json;
      };
      register_student_resume: {
        Args: {
          p_file_name: string;
          p_file_size_bytes: number;
          p_mime_type: string;
          p_storage_path: string;
        };
        Returns: Json;
      };
      reject_student_skill: {
        Args: { p_reason?: string; p_student_skill_id: string };
        Returns: Json;
      };
      remove_staff_role: {
        Args: { p_target_profile_id: string };
        Returns: Json;
      };
      resubmit_student_skill: {
        Args: { p_student_skill_id: string };
        Returns: Json;
      };
      revoke_recruiter_drive_access: {
        Args: { p_access_id: string };
        Returns: Json;
      };
      revoke_recruiter_invitation: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      submit_skill_evidence_link: {
        Args: {
          p_description?: string;
          p_evidence_url: string;
          p_student_skill_id: string;
        };
        Returns: Json;
      };
      transition_application_status: {
        Args: {
          p_application_id: string;
          p_new_status: Database["public"]["Enums"]["application_status"];
          p_reason?: string;
        };
        Returns: Json;
      };
      update_company: {
        Args: {
          p_company_id: string;
          p_description?: string;
          p_name: string;
          p_website?: string;
        };
        Returns: Json;
      };
      update_draft_announcement: {
        Args: {
          p_announcement_id: string;
          p_audience: Database["public"]["Enums"]["announcement_audience"];
          p_body: string;
          p_expires_at?: string;
          p_title: string;
        };
        Returns: Json;
      };
      update_own_alumni_profile: {
        Args: {
          p_city?: string;
          p_company_id?: string;
          p_country?: string;
          p_current_organization?: string;
          p_current_role?: string;
          p_higher_studies_institution?: string;
          p_higher_studies_program?: string;
          p_higher_studies_year_start?: number;
          p_linkedin_url?: string;
          p_professional_domain?: string;
          p_public_alumni_enabled?: boolean;
          p_willing_to_mentor?: boolean;
          p_willing_to_refer?: boolean;
          p_willing_to_support_placement?: boolean;
        };
        Returns: Json;
      };
      update_own_profile_photo: {
        Args: { p_storage_path: string };
        Returns: Json;
      };
      update_own_public_profile_settings: {
        Args: {
          p_public_headline?: string;
          p_public_portfolio_enabled: boolean;
          p_public_profile_enabled: boolean;
          p_public_profile_slug?: string;
          p_public_resume_enabled: boolean;
          p_public_tagline?: string;
        };
        Returns: Json;
      };
      update_own_student_profile: {
        Args: {
          p_bio?: string;
          p_linkedin_url?: string;
          p_other_links?: Json;
          p_phone?: string;
          p_portfolio_url?: string;
          p_public_headline?: string;
          p_public_tagline?: string;
        };
        Returns: Json;
      };
      update_placement_drive: {
        Args: {
          p_application_deadline?: string;
          p_compensation_details?: string;
          p_description?: string;
          p_drive_id: string;
          p_location?: string;
          p_package_lpa?: number;
          p_requirements_info?: string;
          p_stipend_monthly?: number;
          p_title: string;
        };
        Returns: Json;
      };
      update_recruiter_contact: {
        Args: {
          p_contact_id: string;
          p_designation?: string;
          p_full_name: string;
          p_phone?: string;
        };
        Returns: Json;
      };
      update_skill: {
        Args: {
          p_category?: string;
          p_description?: string;
          p_name: string;
          p_skill_id: string;
        };
        Returns: Json;
      };
      update_student_skill_proficiency: {
        Args: { p_proficiency_level: number; p_student_skill_id: string };
        Returns: Json;
      };
      verify_alumni_profile: { Args: { p_alumni_id: string }; Returns: Json };
      verify_student_academic_record: {
        Args: {
          p_active_backlogs: number;
          p_cgpa: number;
          p_target_profile_id: string;
        };
        Returns: Json;
      };
      verify_student_skill: {
        Args: { p_student_skill_id: string };
        Returns: Json;
      };
      withdraw_application: {
        Args: { p_application_id: string; p_reason?: string };
        Returns: Json;
      };
    };
    Enums: {
      announcement_audience: "ALL" | "STUDENTS" | "RECRUITERS" | "STAFF";
      announcement_status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      application_status:
        | "APPLIED"
        | "SHORTLISTED"
        | "INTERVIEW"
        | "SELECTED"
        | "REJECTED"
        | "WITHDRAWN";
      coordinator_slot: "SLOT_1" | "SLOT_2";
      document_type: "RESUME" | "SKILL_EVIDENCE" | "PROFILE_PHOTO";
      drive_status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
      drive_type: "PLACEMENT" | "INTERNSHIP";
      evidence_type: "PROJECT_LINK" | "PDF_DOCUMENT";
      invitation_status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
      skill_verification_status: "PENDING" | "VERIFIED" | "REJECTED";
      student_lifecycle_status:
        "STUDENT_ACTIVE" | "STUDENT_GRADUATED" | "ALUMNI";
      user_role:
        | "SUPER_ADMIN"
        | "TNP_SECRETARY"
        | "TNP_COORDINATOR"
        | "STUDENT"
        | "RECRUITER";
      verification_status: "UNVERIFIED" | "VERIFIED" | "CORRECTION_PENDING";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      announcement_audience: ["ALL", "STUDENTS", "RECRUITERS", "STAFF"],
      announcement_status: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      application_status: [
        "APPLIED",
        "SHORTLISTED",
        "INTERVIEW",
        "SELECTED",
        "REJECTED",
        "WITHDRAWN",
      ],
      coordinator_slot: ["SLOT_1", "SLOT_2"],
      document_type: ["RESUME", "SKILL_EVIDENCE", "PROFILE_PHOTO"],
      drive_status: ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"],
      drive_type: ["PLACEMENT", "INTERNSHIP"],
      evidence_type: ["PROJECT_LINK", "PDF_DOCUMENT"],
      invitation_status: ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"],
      skill_verification_status: ["PENDING", "VERIFIED", "REJECTED"],
      student_lifecycle_status: [
        "STUDENT_ACTIVE",
        "STUDENT_GRADUATED",
        "ALUMNI",
      ],
      user_role: [
        "SUPER_ADMIN",
        "TNP_SECRETARY",
        "TNP_COORDINATOR",
        "STUDENT",
        "RECRUITER",
      ],
      verification_status: ["UNVERIFIED", "VERIFIED", "CORRECTION_PENDING"],
    },
  },
} as const;
