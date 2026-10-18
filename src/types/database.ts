/**
 * Database type definitions scaffold.
 *
 * This file will be populated with generated TypeScript types from the
 * Supabase CLI in Phase 2 using:
 * `supabase gen types typescript --local > src/types/database.ts`
 *
 * For Phase 1, it serves as a typed placeholder.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
