export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  bell: {
    Tables: {
      allowlist: {
        Row: {
          added_at: string;
          email: string;
        };
        Insert: {
          added_at?: string;
          email: string;
        };
        Update: {
          added_at?: string;
          email?: string;
        };
        Relationships: [];
      };
      migrations: {
        Row: {
          applied_at: string;
          name: string;
        };
        Insert: {
          applied_at?: string;
          name: string;
        };
        Update: {
          applied_at?: string;
          name?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          time_zone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id: string;
          time_zone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          time_zone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      before_user_created: {
        Args: { event: Json };
        Returns: Json;
      };
      claim_account: {
        Args: { p_time_zone: string };
        Returns: {
          created_at: string;
          email: string;
          id: string;
          time_zone: string;
          updated_at: string;
        };
      };
      delete_me: {
        Args: never;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
