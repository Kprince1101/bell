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
      calendar_shares: {
        Row: {
          calendar_id: string;
          created_at: string;
          created_by: string;
          shared_with_user_id: string;
        };
        Insert: {
          calendar_id: string;
          created_at?: string;
          created_by: string;
          shared_with_user_id: string;
        };
        Update: {
          calendar_id?: string;
          created_at?: string;
          created_by?: string;
          shared_with_user_id?: string;
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
          quiet: boolean;
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
          quiet?: boolean;
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
          quiet?: boolean;
          sync_token?: string | null;
          time_zone?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      channel_secrets: {
        Row: {
          kind: string;
          slack_team_id: string | null;
          updated_at: string;
          user_id: string;
          value: string;
        };
        Insert: {
          kind: string;
          slack_team_id?: string | null;
          updated_at?: string;
          user_id: string;
          value: string;
        };
        Update: {
          kind?: string;
          slack_team_id?: string | null;
          updated_at?: string;
          user_id?: string;
          value?: string;
        };
        Relationships: [];
      };
      channels: {
        Row: {
          active: boolean;
          hint: string | null;
          kind: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          hint?: string | null;
          kind: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          hint?: string | null;
          kind?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      channel_tests: {
        Row: {
          error: string | null;
          kind: string;
          ok: boolean;
          tested_at: string;
          user_id: string;
        };
        Insert: {
          error?: string | null;
          kind: string;
          ok: boolean;
          tested_at: string;
          user_id: string;
        };
        Update: {
          error?: string | null;
          kind?: string;
          ok?: boolean;
          tested_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      job_runs: {
        Row: {
          detail: string | null;
          job: string;
          ok: boolean;
          ran_at: string;
        };
        Insert: {
          detail?: string | null;
          job: string;
          ok: boolean;
          ran_at: string;
        };
        Update: {
          detail?: string | null;
          job?: string;
          ok?: boolean;
          ran_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          channel: string;
          claimed_at: string | null;
          created_at: string;
          due_at: string;
          error: string | null;
          event_id: string;
          event_starts_at: string;
          fallback_for: string | null;
          id: string;
          provider_ref: string | null;
          result: string | null;
          sent_at: string | null;
          step: string;
          user_id: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          channel: string;
          claimed_at?: string | null;
          created_at?: string;
          due_at: string;
          error?: string | null;
          event_id: string;
          event_starts_at: string;
          fallback_for?: string | null;
          id?: string;
          provider_ref?: string | null;
          result?: string | null;
          sent_at?: string | null;
          step: string;
          user_id: string;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          channel?: string;
          claimed_at?: string | null;
          created_at?: string;
          due_at?: string;
          error?: string | null;
          event_id?: string;
          event_starts_at?: string;
          fallback_for?: string | null;
          id?: string;
          provider_ref?: string | null;
          result?: string | null;
          sent_at?: string | null;
          step?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      slack_installs: {
        Row: {
          bot_token_encrypted: string;
          bot_user_id: string;
          installed_at: string;
          installed_by: string | null;
          team_id: string;
          team_name: string;
        };
        Insert: {
          bot_token_encrypted: string;
          bot_user_id: string;
          installed_at?: string;
          installed_by?: string | null;
          team_id: string;
          team_name: string;
        };
        Update: {
          bot_token_encrypted?: string;
          bot_user_id?: string;
          installed_at?: string;
          installed_by?: string | null;
          team_id?: string;
          team_name?: string;
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
      health_report: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      record_channel_test: {
        Args: {
          p_user_id: string;
          p_kind: string;
          p_ok: boolean;
          p_error: string | null;
          p_at: string;
        };
        Returns: undefined;
      };
      record_job_run: {
        Args: {
          p_job: string;
          p_ok: boolean;
          p_detail: string | null;
          p_at: string;
        };
        Returns: undefined;
      };
      ack_target_for_phone: {
        Args: { p_phone: string; p_now: string };
        Returns: { event_id: string; user_id: string }[];
      };
      acknowledge_event: {
        Args: {
          p_event_id: string;
          p_user_id: string;
          p_by: string;
          p_at: string;
        };
        Returns: Json[];
      };
      channel_target: {
        Args: { p_user_id: string; p_kind: string };
        Returns: Json;
      };
      claim_due_notifications: {
        Args: { p_now: string };
        Returns: Json[];
      };
      claim_fallback: {
        Args: { p_id: string; p_now: string };
        Returns: Json;
      };
      finish_notification: {
        Args: {
          p_id: string;
          p_result: string;
          p_error: string | null;
          p_provider_ref: string | null;
          p_at: string;
        };
        Returns: undefined;
      };
      materialize_notifications: {
        Args: { p_now: string; p_event_id?: string };
        Returns: number;
      };
      notification_delivery: {
        Args: { p_id: string };
        Returns: Json;
      };
      notification_owner: {
        Args: { p_id: string };
        Returns: {
          event_id: string;
          user_id: string;
          provider_ref: string | null;
          target: string | null;
        }[];
      };
      save_channel_secret: {
        Args: {
          p_user_id: string;
          p_kinds: string[];
          p_value: string;
          p_hint: string;
          p_slack_team_id?: string;
        };
        Returns: undefined;
      };
      save_slack_install: {
        Args: {
          p_team_id: string;
          p_team_name: string;
          p_bot_user_id: string;
          p_bot_token_encrypted: string;
          p_installed_by: string;
        };
        Returns: undefined;
      };
      set_calendar_quiet: {
        Args: { p_user_id: string; p_calendar_id: string; p_quiet: boolean };
        Returns: boolean;
      };
      share_calendar: {
        Args: { p_user_id: string; p_calendar_id: string; p_email: string };
        Returns: string;
      };
      unshare_calendar: {
        Args: {
          p_user_id: string;
          p_calendar_id: string;
          p_shared_with: string;
        };
        Returns: boolean;
      };
      shared_with_me: {
        Args: never;
        Returns: { id: string; label: string; color: string }[];
      };
      my_shares: {
        Args: never;
        Returns: {
          calendar_id: string;
          shared_with_user_id: string;
          email: string;
        }[];
      };
      calendar_recipients: {
        Args: { p_calendar_id: string };
        Returns: { user_id: string }[];
      };
      set_channel_active: {
        Args: { p_user_id: string; p_kind: string; p_active: boolean };
        Returns: boolean;
      };
      slack_event_owner: {
        Args: {
          p_event_id: string;
          p_team_id: string;
          p_slack_user_id: string;
        };
        Returns: string;
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
