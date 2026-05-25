/**
 * Generated database types for Supabase.
 * Matches the tables: projects, svg_designs, user_preferences
 */

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: number;
          user_id: string;
          name: string;
          svg_data: string;
          extrude_depth: number;
          keycap_size: number;
          peg_radius: number;
          settings: Record<string, unknown> | null;
          export_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          name: string;
          svg_data: string;
          extrude_depth?: number;
          keycap_size?: number;
          peg_radius?: number;
          settings?: Record<string, unknown> | null;
          export_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          name?: string;
          svg_data?: string;
          extrude_depth?: number;
          keycap_size?: number;
          peg_radius?: number;
          settings?: Record<string, unknown> | null;
          export_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      svg_designs: {
        Row: {
          id: number;
          user_id: string;
          name: string;
          svg_data: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          name: string;
          svg_data: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          name?: string;
          svg_data?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_preferences: {
        Row: {
          user_id: string;
          sidebar_mode: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          sidebar_mode?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          sidebar_mode?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
