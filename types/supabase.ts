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
      account_secrets: {
        Row: {
          account_id: string;
          refresh_token_encrypted: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          refresh_token_encrypted: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          refresh_token_encrypted?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agenda_visits: {
        Row: {
          baseline_at: string | null;
          seen_at: string;
          user_id: string;
        };
        Insert: {
          baseline_at?: string | null;
          seen_at: string;
          user_id: string;
        };
        Update: {
          baseline_at?: string | null;
          seen_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          created_at: string;
          email: string;
          google_account_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          google_account_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          google_account_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      calendars: {
        Row: {
          account_id: string;
          active: boolean;
          channel_expires_at: string | null;
          channel_id: string | null;
          channel_resource_id: string | null;
          color: string;
          created_at: string;
          fail_count: number;
          google_calendar_id: string;
          healthy: boolean;
          id: string;
          label: string;
          last_error: string | null;
          last_sync_at: string | null;
          paused: boolean;
          sync_token: string | null;
          time_zone: string | null;
          user_id: string;
        };
        Insert: {
          account_id: string;
          active?: boolean;
          channel_expires_at?: string | null;
          channel_id?: string | null;
          channel_resource_id?: string | null;
          color?: string;
          created_at?: string;
          fail_count?: number;
          google_calendar_id: string;
          healthy?: boolean;
          id?: string;
          label: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          paused?: boolean;
          sync_token?: string | null;
          time_zone?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string;
          active?: boolean;
          channel_expires_at?: string | null;
          channel_id?: string | null;
          channel_resource_id?: string | null;
          color?: string;
          created_at?: string;
          fail_count?: number;
          google_calendar_id?: string;
          healthy?: boolean;
          id?: string;
          label?: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          paused?: boolean;
          sync_token?: string | null;
          time_zone?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          all_day: boolean;
          attendees: Json;
          calendar_id: string;
          changed_at: string | null;
          created_at: string;
          description: string | null;
          ends_at: string;
          event_id: string;
          fingerprint: string;
          id: string;
          instance_at: string | null;
          join_url: string | null;
          last_seen_at: string;
          location: string | null;
          organizer: string | null;
          previous_starts_at: string | null;
          raw_start: string;
          recurring_event_id: string | null;
          source_tz: string | null;
          starts_at: string;
          status: string;
          title: string;
          user_id: string;
        };
        Insert: {
          all_day?: boolean;
          attendees?: Json;
          calendar_id: string;
          changed_at?: string | null;
          created_at?: string;
          description?: string | null;
          ends_at: string;
          event_id: string;
          fingerprint: string;
          id?: string;
          instance_at?: string | null;
          join_url?: string | null;
          last_seen_at?: string;
          location?: string | null;
          organizer?: string | null;
          previous_starts_at?: string | null;
          raw_start: string;
          recurring_event_id?: string | null;
          source_tz?: string | null;
          starts_at: string;
          status: string;
          title?: string;
          user_id: string;
        };
        Update: {
          all_day?: boolean;
          attendees?: Json;
          calendar_id?: string;
          changed_at?: string | null;
          created_at?: string;
          description?: string | null;
          ends_at?: string;
          event_id?: string;
          fingerprint?: string;
          id?: string;
          instance_at?: string | null;
          join_url?: string | null;
          last_seen_at?: string;
          location?: string | null;
          organizer?: string | null;
          previous_starts_at?: string | null;
          raw_start?: string;
          recurring_event_id?: string | null;
          source_tz?: string | null;
          starts_at?: string;
          status?: string;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      allowlist: {
        Row: {
          added_at: string;
          email: string;
          role: string;
        };
        Insert: {
          added_at?: string;
          email: string;
          role?: string;
        };
        Update: {
          added_at?: string;
          email?: string;
          role?: string;
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
      apply_sync: {
        Args: {
          p_calendar_id: string;
          p_events: Json;
          p_cancelled: string[];
          p_from_sync_token: string | null;
          p_sync_token: string;
          p_full: boolean;
          p_window_start: string;
          p_window_end: string;
          p_seen_at: string;
        };
        Returns: boolean;
      };
      mark_push_stopped: {
        Args: { p_now: string };
        Returns: string[];
      };
      record_sync_failure: {
        Args: { p_calendar_id: string; p_error: string };
        Returns: Database['bell']['Tables']['calendars']['Row'];
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
        Returns: boolean;
      };
      is_owner: {
        Args: never;
        Returns: boolean;
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
