/**
 * Generated database types for Supabase.
 * Matches the tables: projects, svg_designs, user_preferences
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
          settings: Json | null;
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
          settings?: Json | null;
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
          settings?: Json | null;
          export_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: never[];
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
        Relationships: never[];
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
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
