/* eslint-disable */
// AUTO-GENERATED — DO NOT EDIT
// Run migrations to regenerate.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          accent: string
          created_at: string
          emoji: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          tagline: string
          updated_at: string
        }
        Insert: {
          accent?: string
          created_at?: string
          emoji?: string
          id: string
          is_active?: boolean
          label: string
          sort_order?: number
          tagline: string
          updated_at?: string
        }
        Update: {
          accent?: string
          created_at?: string
          emoji?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          amount: number | null
          badge: string | null
          color: string | null
          created_at: string | null
          id: string
          kind: string
          stream_id: string
          text: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          amount?: number | null
          badge?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          kind?: string
          stream_id: string
          text?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          amount?: number | null
          badge?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          kind?: string
          stream_id?: string
          text?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "active_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_messages: {
        Row: {
          attachment_url: string | null
          created_at: string | null
          id: string
          is_paid: boolean
          price: number
          sender_id: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          text: string | null
          thread_id: string
          unlocked_by_recipient: boolean
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          is_paid?: boolean
          price?: number
          sender_id: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          text?: string | null
          thread_id: string
          unlocked_by_recipient?: boolean
        }
        Update: {
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          is_paid?: boolean
          price?: number
          sender_id?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          text?: string | null
          thread_id?: string
          unlocked_by_recipient?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "dm_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_threads: {
        Row: {
          created_at: string | null
          creator_id: string
          creator_unread_count: number
          fan_id: string
          fan_unread_count: number
          id: string
          last_message_at: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          creator_unread_count?: number
          fan_id: string
          fan_unread_count?: number
          id?: string
          last_message_at?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          creator_unread_count?: number
          fan_id?: string
          fan_unread_count?: number
          id?: string
          last_message_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_threads_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "dm_threads_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_threads_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "dm_threads_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          resend_id: string | null
          status: string
          subject: string
          template: string | null
          to_email: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id?: string
          resend_id?: string | null
          status?: string
          subject: string
          template?: string | null
          to_email: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          resend_id?: string | null
          status?: string
          subject?: string
          template?: string | null
          to_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "email_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          access: string
          category: string
          chapter: string | null
          created_at: string | null
          creator_id: string
          description: string | null
          duration_sec: number | null
          id: string
          likes: number | null
          posted_at: string | null
          ppv_price: number | null
          thumb_url: string | null
          tips: number | null
          title: string
          video_url: string | null
          views: number | null
        }
        Insert: {
          access?: string
          category?: string
          chapter?: string | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          duration_sec?: number | null
          id?: string
          likes?: number | null
          posted_at?: string | null
          ppv_price?: number | null
          thumb_url?: string | null
          tips?: number | null
          title: string
          video_url?: string | null
          views?: number | null
        }
        Update: {
          access?: string
          category?: string
          chapter?: string | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          duration_sec?: number | null
          id?: string
          likes?: number | null
          posted_at?: string | null
          ppv_price?: number | null
          thumb_url?: string | null
          tips?: number | null
          title?: string
          video_url?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "episodes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          creator_id: string | null
          episode_id: string | null
          id: number
          kind: string
          metadata: Json | null
          stream_id: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          episode_id?: string | null
          id?: never
          kind: string
          metadata?: Json | null
          stream_id?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          episode_id?: string | null
          id?: never
          kind?: string
          metadata?: Json | null
          stream_id?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string | null
          episode_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          episode_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          episode_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episode_performance"
            referencedColumns: ["episode_id"]
          },
          {
            foreignKeyName: "likes_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          access: string
          category: string
          co_host_ids: string[] | null
          creator_id: string
          dropped_frames_pct: number | null
          ended_at: string | null
          health_status: string | null
          hls_playback_url: string | null
          id: string
          is_co_stream: boolean | null
          is_live: boolean | null
          latency_mode: string | null
          max_viewers: number | null
          mux_asset_id: string | null
          mux_live_stream_id: string | null
          mux_playback_id: string | null
          mux_playback_signing_key: string | null
          peak_bitrate_kbps: number | null
          ppv_price: number | null
          primary_stream_id: string | null
          replay_enabled: boolean | null
          replay_episode_id: string | null
          rtmp_ingest_url: string | null
          rtmp_stream_key: string | null
          slow_mode: boolean | null
          started_at: string | null
          stream_source: string | null
          sub_only_chat: boolean | null
          thumb_url: string | null
          title: string
          viewers: number | null
        }
        Insert: {
          access?: string
          category?: string
          co_host_ids?: string[] | null
          creator_id: string
          dropped_frames_pct?: number | null
          ended_at?: string | null
          health_status?: string | null
          hls_playback_url?: string | null
          id?: string
          is_co_stream?: boolean | null
          is_live?: boolean | null
          latency_mode?: string | null
          max_viewers?: number | null
          mux_asset_id?: string | null
          mux_live_stream_id?: string | null
          mux_playback_id?: string | null
          mux_playback_signing_key?: string | null
          peak_bitrate_kbps?: number | null
          ppv_price?: number | null
          primary_stream_id?: string | null
          replay_enabled?: boolean | null
          replay_episode_id?: string | null
          rtmp_ingest_url?: string | null
          rtmp_stream_key?: string | null
          slow_mode?: boolean | null
          started_at?: string | null
          stream_source?: string | null
          sub_only_chat?: boolean | null
          thumb_url?: string | null
          title: string
          viewers?: number | null
        }
        Update: {
          access?: string
          category?: string
          co_host_ids?: string[] | null
          creator_id?: string
          dropped_frames_pct?: number | null
          ended_at?: string | null
          health_status?: string | null
          hls_playback_url?: string | null
          id?: string
          is_co_stream?: boolean | null
          is_live?: boolean | null
          latency_mode?: string | null
          max_viewers?: number | null
          mux_asset_id?: string | null
          mux_live_stream_id?: string | null
          mux_playback_id?: string | null
          mux_playback_signing_key?: string | null
          peak_bitrate_kbps?: number | null
          ppv_price?: number | null
          primary_stream_id?: string | null
          replay_enabled?: boolean | null
          replay_episode_id?: string | null
          rtmp_ingest_url?: string | null
          rtmp_stream_key?: string | null
          slow_mode?: boolean | null
          started_at?: string | null
          stream_source?: string | null
          sub_only_chat?: boolean | null
          thumb_url?: string | null
          title?: string
          viewers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "live_streams_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          admin_note: string | null
          amount: number
          creator_id: string
          id: string
          payout_handle: string | null
          payout_method: string | null
          processed_at: string | null
          processed_by: string | null
          requested_at: string
          status: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          creator_id: string
          id?: string
          payout_handle?: string | null
          payout_method?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          creator_id?: string
          id?: string
          payout_handle?: string | null
          payout_method?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "payout_requests_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          creator_id: string
          currency: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          method: string | null
          processed_at: string | null
          requested_at: string | null
          status: string | null
          stripe_payout_id: string | null
          stripe_transfer_id: string | null
        }
        Insert: {
          amount: number
          creator_id: string
          currency?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          method?: string | null
          processed_at?: string | null
          requested_at?: string | null
          status?: string | null
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
        }
        Update: {
          amount?: number
          creator_id?: string
          currency?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          method?: string | null
          processed_at?: string | null
          requested_at?: string | null
          status?: string | null
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agreed_to_terms_at: string | null
          avatar_url: string | null
          bio: string | null
          categories: string[] | null
          cover_url: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          fts: unknown
          handle: string | null
          id: string
          identity: string | null
          interests: string[] | null
          is_admin: boolean | null
          is_creator: boolean | null
          kyc_last_reason: string | null
          kyc_session_id: string | null
          kyc_session_url: string | null
          kyc_status: string | null
          kyc_verified_at: string | null
          last_payout_at: string | null
          legal_name: string | null
          lifetime_earnings: number | null
          location: string | null
          name: string | null
          onboarded: boolean | null
          payout_balance: number | null
          payout_connected: boolean | null
          payout_handle: string | null
          payout_method: string | null
          pending_payout: number | null
          stripe_account_id: string | null
          stripe_account_status: string | null
          stripe_customer_id: string | null
          stripe_onboarding_url: string | null
          stripe_payouts_enabled: boolean | null
          sub_price: number | null
          total_spent: number | null
          updated_at: string | null
          verified: boolean | null
          wallet_balance: number | null
        }
        Insert: {
          agreed_to_terms_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          categories?: string[] | null
          cover_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          fts?: unknown
          handle?: string | null
          id: string
          identity?: string | null
          interests?: string[] | null
          is_admin?: boolean | null
          is_creator?: boolean | null
          kyc_last_reason?: string | null
          kyc_session_id?: string | null
          kyc_session_url?: string | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          last_payout_at?: string | null
          legal_name?: string | null
          lifetime_earnings?: number | null
          location?: string | null
          name?: string | null
          onboarded?: boolean | null
          payout_balance?: number | null
          payout_connected?: boolean | null
          payout_handle?: string | null
          payout_method?: string | null
          pending_payout?: number | null
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          stripe_customer_id?: string | null
          stripe_onboarding_url?: string | null
          stripe_payouts_enabled?: boolean | null
          sub_price?: number | null
          total_spent?: number | null
          updated_at?: string | null
          verified?: boolean | null
          wallet_balance?: number | null
        }
        Update: {
          agreed_to_terms_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          categories?: string[] | null
          cover_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          fts?: unknown
          handle?: string | null
          id?: string
          identity?: string | null
          interests?: string[] | null
          is_admin?: boolean | null
          is_creator?: boolean | null
          kyc_last_reason?: string | null
          kyc_session_id?: string | null
          kyc_session_url?: string | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          last_payout_at?: string | null
          legal_name?: string | null
          lifetime_earnings?: number | null
          location?: string | null
          name?: string | null
          onboarded?: boolean | null
          payout_balance?: number | null
          payout_connected?: boolean | null
          payout_handle?: string | null
          payout_method?: string | null
          pending_payout?: number | null
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          stripe_customer_id?: string | null
          stripe_onboarding_url?: string | null
          stripe_payouts_enabled?: boolean | null
          sub_price?: number | null
          total_spent?: number | null
          updated_at?: string | null
          verified?: boolean | null
          wallet_balance?: number | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          app_version: string | null
          created_at: string | null
          id: string
          last_seen_at: string | null
          platform: string | null
          token: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          platform?: string | null
          token: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          platform?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          assigned_admin_id: string | null
          created_at: string | null
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          status: string
          target_id: string
          target_type: string
          target_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_admin_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          target_id: string
          target_type: string
          target_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_admin_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          target_id?: string
          target_type?: string
          target_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "reports_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "reports_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          created_at: string | null
          episode_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          episode_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          episode_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episode_performance"
            referencedColumns: ["episode_id"]
          },
          {
            foreignKeyName: "saves_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          active: boolean | null
          canceled_at: string | null
          creator_id: string
          fan_id: string
          id: string
          price: number
          renews_at: string | null
          started_at: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          canceled_at?: string | null
          creator_id: string
          fan_id: string
          id?: string
          price: number
          renews_at?: string | null
          started_at?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          canceled_at?: string | null
          creator_id?: string
          fan_id?: string
          id?: string
          price?: number
          renews_at?: string | null
          started_at?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "subscriptions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "subscriptions_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tips: {
        Row: {
          amount: number
          created_at: string | null
          creator_id: string
          creator_payout: number | null
          episode_id: string | null
          fan_id: string
          id: string
          message: string | null
          platform_fee: number | null
          status: string | null
          stream_id: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          creator_id: string
          creator_payout?: number | null
          episode_id?: string | null
          fan_id: string
          id?: string
          message?: string | null
          platform_fee?: number | null
          status?: string | null
          stream_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          creator_id?: string
          creator_payout?: number | null
          episode_id?: string | null
          fan_id?: string
          id?: string
          message?: string | null
          platform_fee?: number | null
          status?: string | null
          stream_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tips_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "tips_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episode_performance"
            referencedColumns: ["episode_id"]
          },
          {
            foreignKeyName: "tips_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "tips_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "active_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          creator_id: string | null
          creator_payout: number | null
          currency: string | null
          id: string
          kind: string
          label: string
          platform_fee: number | null
          status: string | null
          stripe_charge_id: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          creator_id?: string | null
          creator_payout?: number | null
          currency?: string | null
          id?: string
          kind: string
          label: string
          platform_fee?: number | null
          status?: string | null
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          creator_id?: string | null
          creator_payout?: number | null
          currency?: string | null
          id?: string
          kind?: string
          label?: string
          platform_fee?: number | null
          status?: string | null
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "transactions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unlocks: {
        Row: {
          created_at: string | null
          creator_payout: number | null
          episode_id: string | null
          fan_id: string
          id: string
          platform_fee: number | null
          price: number
          status: string | null
          stream_id: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          created_at?: string | null
          creator_payout?: number | null
          episode_id?: string | null
          fan_id: string
          id?: string
          platform_fee?: number | null
          price: number
          status?: string | null
          stream_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          created_at?: string | null
          creator_payout?: number | null
          episode_id?: string | null
          fan_id?: string
          id?: string
          platform_fee?: number | null
          price?: number
          status?: string | null
          stream_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unlocks_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episode_performance"
            referencedColumns: ["episode_id"]
          },
          {
            foreignKeyName: "unlocks_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlocks_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "unlocks_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_docs: {
        Row: {
          doc_type: string
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          doc_type?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          doc_type?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_docs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "verification_docs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_streams: {
        Row: {
          access: string | null
          category: string | null
          co_host_ids: string[] | null
          creator_id: string | null
          ended_at: string | null
          health_status: string | null
          hls_playback_url: string | null
          id: string | null
          is_co_stream: boolean | null
          is_live: boolean | null
          latency_mode: string | null
          max_viewers: number | null
          mux_playback_id: string | null
          ppv_price: number | null
          primary_stream_id: string | null
          replay_enabled: boolean | null
          replay_episode_id: string | null
          slow_mode: boolean | null
          started_at: string | null
          stream_source: string | null
          sub_only_chat: boolean | null
          thumb_url: string | null
          title: string | null
          viewers: number | null
        }
        Insert: {
          access?: string | null
          category?: string | null
          co_host_ids?: string[] | null
          creator_id?: string | null
          ended_at?: string | null
          health_status?: string | null
          hls_playback_url?: string | null
          id?: string | null
          is_co_stream?: boolean | null
          is_live?: boolean | null
          latency_mode?: string | null
          max_viewers?: number | null
          mux_playback_id?: string | null
          ppv_price?: number | null
          primary_stream_id?: string | null
          replay_enabled?: boolean | null
          replay_episode_id?: string | null
          slow_mode?: boolean | null
          started_at?: string | null
          stream_source?: string | null
          sub_only_chat?: boolean | null
          thumb_url?: string | null
          title?: string | null
          viewers?: number | null
        }
        Update: {
          access?: string | null
          category?: string | null
          co_host_ids?: string[] | null
          creator_id?: string | null
          ended_at?: string | null
          health_status?: string | null
          hls_playback_url?: string | null
          id?: string | null
          is_co_stream?: boolean | null
          is_live?: boolean | null
          latency_mode?: string | null
          max_viewers?: number | null
          mux_playback_id?: string | null
          ppv_price?: number | null
          primary_stream_id?: string | null
          replay_enabled?: boolean | null
          replay_episode_id?: string | null
          slow_mode?: boolean | null
          started_at?: string | null
          stream_source?: string | null
          sub_only_chat?: boolean | null
          thumb_url?: string | null
          title?: string | null
          viewers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "live_streams_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_revenue_daily: {
        Row: {
          creator_id: string | null
          day: string | null
          event_count: number | null
          ppv_revenue: number | null
          sub_revenue: number | null
          tip_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_stats: {
        Row: {
          categories: string[] | null
          creator_id: string | null
          ep_count: number | null
          ep_likes: number | null
          ep_tips: number | null
          ep_views: number | null
          is_creator: boolean | null
          sub_count: number | null
          sub_price: number | null
          verified: boolean | null
        }
        Relationships: []
      }
      episode_performance: {
        Row: {
          creator_id: string | null
          episode_id: string | null
          total_likes: number | null
          total_tips: number | null
          total_unlocks: number | null
          total_views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_stats"
            referencedColumns: ["creator_id"]
          },
          {
            foreignKeyName: "episodes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_revenue: {
        Row: {
          creator_cut: number | null
          day: string | null
          gross: number | null
          kind: string | null
          platform_cut: number | null
          tx_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      bump_dm_thread: {
        Args: { p_sender_id: string; p_thread_id: string }
        Returns: undefined
      }
      bump_stream_viewers: {
        Args: { p_stream_id: string; p_viewers: number }
        Returns: undefined
      }
      end_stream: {
        Args: { p_replay_episode_id?: string; p_stream_id: string }
        Returns: undefined
      }
      user_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
