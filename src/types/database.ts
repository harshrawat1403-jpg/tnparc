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
            foreignKeyName: "application_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      applications: {
        Row: {
          applied_at: string;
          created_at: string;
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
            foreignKeyName: "applications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
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
            foreignKeyName: "coordinator_student_scopes_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
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
            foreignKeyName: "placement_drives_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_drives_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
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
            foreignKeyName: "recruiter_contacts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
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
            foreignKeyName: "recruiter_drive_access_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_drive_access_recruiter_profile_id_fkey";
            columns: ["recruiter_profile_id"];
            isOneToOne: false;
            referencedRelation: "recruiter_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_drive_access_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recruiter_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
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
            foreignKeyName: "recruiter_invitations_recruiter_contact_id_fkey";
            columns: ["recruiter_contact_id"];
            isOneToOne: false;
            referencedRelation: "recruiter_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_invitations_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
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
            foreignKeyName: "recruiter_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiter_profiles_recruiter_contact_id_fkey";
            columns: ["recruiter_contact_id"];
            isOneToOne: true;
            referencedRelation: "recruiter_contacts";
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
            foreignKeyName: "student_skills_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_skills_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
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
