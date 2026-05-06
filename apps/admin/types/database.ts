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
      applications: {
        Row: {
          allowed_origins: string[]
          api_key_hash: string
          api_key_prefix: string
          callback_url: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          metadata_json: Json
          name: string
          slug: string
          status: Database["public"]["Enums"]["application_status"]
          tenant_id: string
          updated_at: string
          webhook_secret_hash: string | null
          webhook_url: string | null
        }
        Insert: {
          allowed_origins?: string[]
          api_key_hash: string
          api_key_prefix: string
          callback_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          metadata_json?: Json
          name: string
          slug: string
          status?: Database["public"]["Enums"]["application_status"]
          tenant_id: string
          updated_at?: string
          webhook_secret_hash?: string | null
          webhook_url?: string | null
        }
        Update: {
          allowed_origins?: string[]
          api_key_hash?: string
          api_key_prefix?: string
          callback_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          metadata_json?: Json
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["application_status"]
          tenant_id?: string
          updated_at?: string
          webhook_secret_hash?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events_2026_04: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_events_2026_05: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_events_2026_06: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_events_2026_07: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_events_2026_08: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_events_2026_09: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_events_2026_10: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_events_2026_11: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_events_2026_12: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_events_2027_01: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_events_2027_02: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_events_2027_03: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_events_default: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip: unknown
          created_at: string
          diff_json: Json
          id: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          client_ip?: unknown
          created_at?: string
          diff_json?: Json
          id?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "verification_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events_2026_04: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events_2026_05: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events_2026_06: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events_2026_07: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events_2026_08: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events_2026_09: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events_2026_10: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events_2026_11: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events_2026_12: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events_2027_01: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events_2027_02: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events_2027_03: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events_default: {
        Row: {
          application_id: string
          billable_units: number
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          billable_units?: number
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          event_type: string
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          billable_units?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          event_type?: string
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          period_month?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      consent_text_versions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          locale: string
          policy_id: string
          policy_version: number
          tenant_id: string
          text_body: string
          text_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          locale?: string
          policy_id: string
          policy_version: number
          tenant_id: string
          text_body: string
          text_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          locale?: string
          policy_id?: string
          policy_version?: number
          tenant_id?: string
          text_body?: string
          text_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_text_versions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_text_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_keys: {
        Row: {
          activated_at: string | null
          algorithm: string
          created_at: string
          id: string
          kid: string
          private_key_enc: string
          private_key_iv: string
          public_jwk_json: Json
          retired_at: string | null
          status: Database["public"]["Enums"]["crypto_key_status"]
          updated_at: string
          vault_secret_id: string | null
        }
        Insert: {
          activated_at?: string | null
          algorithm: string
          created_at?: string
          id?: string
          kid: string
          private_key_enc: string
          private_key_iv: string
          public_jwk_json: Json
          retired_at?: string | null
          status?: Database["public"]["Enums"]["crypto_key_status"]
          updated_at?: string
          vault_secret_id?: string | null
        }
        Update: {
          activated_at?: string | null
          algorithm?: string
          created_at?: string
          id?: string
          kid?: string
          private_key_enc?: string
          private_key_iv?: string
          public_jwk_json?: Json
          retired_at?: string | null
          status?: Database["public"]["Enums"]["crypto_key_status"]
          updated_at?: string
          vault_secret_id?: string | null
        }
        Relationships: []
      }
      guardian_contacts: {
        Row: {
          archived_at: string | null
          archived_reason: string | null
          consent_request_id: string
          contact_channel: string
          contact_hmac: string
          contact_masked: string
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
          vault_secret_id: string | null
          verified_at: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_reason?: string | null
          consent_request_id: string
          contact_channel: string
          contact_hmac: string
          contact_masked: string
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
          vault_secret_id?: string | null
          verified_at?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_reason?: string | null
          consent_request_id?: string
          contact_channel?: string
          contact_hmac?: string
          contact_masked?: string
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          vault_secret_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardian_contacts_consent_request_id_fkey"
            columns: ["consent_request_id"]
            isOneToOne: false
            referencedRelation: "parental_consent_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_verifications: {
        Row: {
          attempts: number
          consent_request_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          guardian_contact_id: string
          id: string
          max_attempts: number
          otp_hash: string
          tenant_id: string
        }
        Insert: {
          attempts?: number
          consent_request_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          guardian_contact_id: string
          id?: string
          max_attempts?: number
          otp_hash: string
          tenant_id: string
        }
        Update: {
          attempts?: number
          consent_request_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          guardian_contact_id?: string
          id?: string
          max_attempts?: number
          otp_hash?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_verifications_consent_request_id_fkey"
            columns: ["consent_request_id"]
            isOneToOne: true
            referencedRelation: "parental_consent_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_verifications_guardian_contact_id_fkey"
            columns: ["guardian_contact_id"]
            isOneToOne: false
            referencedRelation: "guardian_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_verifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_reputation: {
        Row: {
          expires_at: string
          ip: unknown
          last_seen_at: string
          request_count: number
          risk_score: number
          signals_json: Json
        }
        Insert: {
          expires_at?: string
          ip: unknown
          last_seen_at?: string
          request_count?: number
          risk_score?: number
          signals_json?: Json
        }
        Update: {
          expires_at?: string
          ip?: unknown
          last_seen_at?: string
          request_count?: number
          risk_score?: number
          signals_json?: Json
        }
        Relationships: []
      }
      issuer_revocations: {
        Row: {
          credential_id: string
          expires_cache_at: string
          id: string
          issuer_id: string
          reason: string | null
          revoked_at: string
        }
        Insert: {
          credential_id: string
          expires_cache_at?: string
          id?: string
          issuer_id: string
          reason?: string | null
          revoked_at: string
        }
        Update: {
          credential_id?: string
          expires_cache_at?: string
          id?: string
          issuer_id?: string
          reason?: string | null
          revoked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issuer_revocations_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "issuers"
            referencedColumns: ["id"]
          },
        ]
      }
      issuers: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          issuer_did: string
          jwks_fetched_at: string | null
          jwks_uri: string | null
          metadata_json: Json
          name: string
          public_keys_json: Json
          supports_formats: string[]
          tenant_id: string | null
          trust_status: Database["public"]["Enums"]["issuer_trust_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          issuer_did: string
          jwks_fetched_at?: string | null
          jwks_uri?: string | null
          metadata_json?: Json
          name: string
          public_keys_json?: Json
          supports_formats?: string[]
          tenant_id?: string | null
          trust_status?: Database["public"]["Enums"]["issuer_trust_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          issuer_did?: string
          jwks_fetched_at?: string | null
          jwks_uri?: string | null
          metadata_json?: Json
          name?: string
          public_keys_json?: Json
          supports_formats?: string[]
          tenant_id?: string | null
          trust_status?: Database["public"]["Enums"]["issuer_trust_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issuers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      jurisdictions: {
        Row: {
          code: string
          is_bloc: boolean
          legal_reference_url: string | null
          name_en: string
          name_pt: string
          parent_code: string | null
        }
        Insert: {
          code: string
          is_bloc?: boolean
          legal_reference_url?: string | null
          name_en: string
          name_pt: string
          parent_code?: string | null
        }
        Update: {
          code?: string
          is_bloc?: boolean
          legal_reference_url?: string | null
          name_en?: string
          name_pt?: string
          parent_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jurisdictions_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["code"]
          },
        ]
      }
      parental_consent_requests: {
        Row: {
          application_id: string
          child_ref_hmac: string
          consent_text_version_id: string
          created_at: string
          data_categories: string[]
          decided_at: string | null
          expires_at: string
          guardian_panel_token_expires_at: string
          guardian_panel_token_hash: string
          id: string
          locale: string
          policy_id: string
          policy_version_id: string
          purpose_codes: string[]
          reason_code: string | null
          redirect_url: string | null
          resource: string
          status: Database["public"]["Enums"]["parental_consent_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          application_id: string
          child_ref_hmac: string
          consent_text_version_id: string
          created_at?: string
          data_categories: string[]
          decided_at?: string | null
          expires_at?: string
          guardian_panel_token_expires_at: string
          guardian_panel_token_hash: string
          id?: string
          locale?: string
          policy_id: string
          policy_version_id: string
          purpose_codes: string[]
          reason_code?: string | null
          redirect_url?: string | null
          resource: string
          status?: Database["public"]["Enums"]["parental_consent_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          child_ref_hmac?: string
          consent_text_version_id?: string
          created_at?: string
          data_categories?: string[]
          decided_at?: string | null
          expires_at?: string
          guardian_panel_token_expires_at?: string
          guardian_panel_token_hash?: string
          id?: string
          locale?: string
          policy_id?: string
          policy_version_id?: string
          purpose_codes?: string[]
          reason_code?: string | null
          redirect_url?: string | null
          resource?: string
          status?: Database["public"]["Enums"]["parental_consent_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parental_consent_requests_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consent_requests_consent_text_version_id_fkey"
            columns: ["consent_text_version_id"]
            isOneToOne: false
            referencedRelation: "consent_text_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consent_requests_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consent_requests_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consent_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      parental_consent_revocations: {
        Row: {
          id: string
          jti: string
          parental_consent_id: string
          reason: string
          revoked_at: string
          source: string
          tenant_id: string
        }
        Insert: {
          id?: string
          jti: string
          parental_consent_id: string
          reason: string
          revoked_at?: string
          source: string
          tenant_id: string
        }
        Update: {
          id?: string
          jti?: string
          parental_consent_id?: string
          reason?: string
          revoked_at?: string
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parental_consent_revocations_parental_consent_id_fkey"
            columns: ["parental_consent_id"]
            isOneToOne: false
            referencedRelation: "parental_consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consent_revocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      parental_consent_tokens: {
        Row: {
          application_id: string
          expires_at: string
          issued_at: string
          jti: string
          kid: string
          parental_consent_id: string
          revoked_at: string | null
          revoked_reason: string | null
          tenant_id: string
        }
        Insert: {
          application_id: string
          expires_at: string
          issued_at?: string
          jti?: string
          kid: string
          parental_consent_id: string
          revoked_at?: string | null
          revoked_reason?: string | null
          tenant_id: string
        }
        Update: {
          application_id?: string
          expires_at?: string
          issued_at?: string
          jti?: string
          kid?: string
          parental_consent_id?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parental_consent_tokens_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consent_tokens_parental_consent_id_fkey"
            columns: ["parental_consent_id"]
            isOneToOne: true
            referencedRelation: "parental_consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consent_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      parental_consents: {
        Row: {
          application_id: string
          consent_assurance_level: Database["public"]["Enums"]["parental_consent_assurance_level"]
          consent_request_id: string
          consent_text_version_id: string
          created_at: string
          data_categories: string[]
          decision: string
          expires_at: string | null
          granted_at: string | null
          guardian_contact_hmac: string
          id: string
          policy_id: string
          policy_version_id: string
          purpose_codes: string[]
          reason_code: string
          revoked_at: string | null
          tenant_id: string
        }
        Insert: {
          application_id: string
          consent_assurance_level?: Database["public"]["Enums"]["parental_consent_assurance_level"]
          consent_request_id: string
          consent_text_version_id: string
          created_at?: string
          data_categories: string[]
          decision: string
          expires_at?: string | null
          granted_at?: string | null
          guardian_contact_hmac: string
          id?: string
          policy_id: string
          policy_version_id: string
          purpose_codes: string[]
          reason_code: string
          revoked_at?: string | null
          tenant_id: string
        }
        Update: {
          application_id?: string
          consent_assurance_level?: Database["public"]["Enums"]["parental_consent_assurance_level"]
          consent_request_id?: string
          consent_text_version_id?: string
          created_at?: string
          data_categories?: string[]
          decision?: string
          expires_at?: string | null
          granted_at?: string | null
          guardian_contact_hmac?: string
          id?: string
          policy_id?: string
          policy_version_id?: string
          purpose_codes?: string[]
          reason_code?: string
          revoked_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parental_consents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_consent_request_id_fkey"
            columns: ["consent_request_id"]
            isOneToOne: true
            referencedRelation: "parental_consent_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_consent_text_version_id_fkey"
            columns: ["consent_text_version_id"]
            isOneToOne: false
            referencedRelation: "consent_text_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          age_band_max: number | null
          age_band_min: number | null
          age_threshold: number
          cloned_from_id: string | null
          created_at: string
          current_version: number
          deleted_at: string | null
          description: string | null
          id: string
          is_template: boolean
          jurisdiction_code: string | null
          legal_reference_url: string | null
          method_priority_json: Json
          name: string
          required_assurance_level: Database["public"]["Enums"]["assurance_level"]
          slug: string
          status: string
          tenant_id: string | null
          token_ttl_seconds: number
          updated_at: string
        }
        Insert: {
          age_band_max?: number | null
          age_band_min?: number | null
          age_threshold: number
          cloned_from_id?: string | null
          created_at?: string
          current_version?: number
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_template?: boolean
          jurisdiction_code?: string | null
          legal_reference_url?: string | null
          method_priority_json?: Json
          name: string
          required_assurance_level?: Database["public"]["Enums"]["assurance_level"]
          slug: string
          status?: string
          tenant_id?: string | null
          token_ttl_seconds?: number
          updated_at?: string
        }
        Update: {
          age_band_max?: number | null
          age_band_min?: number | null
          age_threshold?: number
          cloned_from_id?: string | null
          created_at?: string
          current_version?: number
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_template?: boolean
          jurisdiction_code?: string | null
          legal_reference_url?: string | null
          method_priority_json?: Json
          name?: string
          required_assurance_level?: Database["public"]["Enums"]["assurance_level"]
          slug?: string
          status?: string
          tenant_id?: string | null
          token_ttl_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_cloned_from_id_fkey"
            columns: ["cloned_from_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_jurisdiction_code_fkey"
            columns: ["jurisdiction_code"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          policy_id: string
          snapshot_json: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          policy_id: string
          snapshot_json: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          policy_id?: string
          snapshot_json?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_versions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      proof_artifacts: {
        Row: {
          adapter_method: Database["public"]["Enums"]["verification_method"]
          artifact_hash: string
          created_at: string
          id: string
          issuer_id: string | null
          mime_type: string | null
          session_id: string
          size_bytes: number | null
          storage_bucket: string
          storage_path: string | null
          tenant_id: string
        }
        Insert: {
          adapter_method: Database["public"]["Enums"]["verification_method"]
          artifact_hash: string
          created_at?: string
          id?: string
          issuer_id?: string | null
          mime_type?: string | null
          session_id: string
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string | null
          tenant_id: string
        }
        Update: {
          adapter_method?: Database["public"]["Enums"]["verification_method"]
          artifact_hash?: string
          created_at?: string
          id?: string
          issuer_id?: string | null
          mime_type?: string | null
          session_id?: string
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_proof_artifacts_issuer"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "issuers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_artifacts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "verification_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_artifacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          capacity: number
          key: string
          last_refill_at: string
          refill_rate: number
          tenant_id: string | null
          tokens: number
          updated_at: string
        }
        Insert: {
          capacity?: number
          key: string
          last_refill_at?: string
          refill_rate?: number
          tenant_id?: string | null
          tokens?: number
          updated_at?: string
        }
        Update: {
          capacity?: number
          key?: string
          last_refill_at?: string
          refill_rate?: number
          tenant_id?: string | null
          tokens?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_buckets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      result_tokens: {
        Row: {
          application_id: string
          expires_at: string
          issued_at: string
          jti: string
          kid: string
          revoked_at: string | null
          revoked_reason: string | null
          session_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          expires_at: string
          issued_at?: string
          jti?: string
          kid: string
          revoked_at?: string | null
          revoked_reason?: string | null
          session_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          expires_at?: string
          issued_at?: string
          jti?: string
          kid?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          session_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_result_tokens_kid"
            columns: ["kid"]
            isOneToOne: false
            referencedRelation: "crypto_keys"
            referencedColumns: ["kid"]
          },
          {
            foreignKeyName: "result_tokens_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "verification_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      revocations: {
        Row: {
          artifact_hash: string | null
          created_at: string
          id: string
          jti: string | null
          reason: string
          revoked_by: string | null
          tenant_id: string
        }
        Insert: {
          artifact_hash?: string | null
          created_at?: string
          id?: string
          jti?: string | null
          reason: string
          revoked_by?: string | null
          tenant_id: string
        }
        Update: {
          artifact_hash?: string | null
          created_at?: string
          id?: string
          jti?: string | null
          reason?: string
          revoked_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revocations_jti_fkey"
            columns: ["jti"]
            isOneToOne: false
            referencedRelation: "result_tokens"
            referencedColumns: ["jti"]
          },
          {
            foreignKeyName: "revocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_aggregates: {
        Row: {
          aggregate_key: string
          application_id: string
          id: string
          subject_id: string
          tenant_id: string
          updated_at: string
          value: number
          window: string
        }
        Insert: {
          aggregate_key: string
          application_id: string
          id?: string
          subject_id: string
          tenant_id: string
          updated_at?: string
          value?: number
          window: string
        }
        Update: {
          aggregate_key?: string
          application_id?: string
          id?: string
          subject_id?: string
          tenant_id?: string
          updated_at?: string
          value?: number
          window?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_aggregates_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_aggregates_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "safety_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_aggregates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_alerts: {
        Row: {
          actions_taken: string[]
          actor_subject_id: string
          application_id: string
          counterparty_subject_id: string | null
          created_at: string
          id: string
          legal_hold: boolean
          parental_consent_request_id: string | null
          reason_codes: string[]
          resolved_at: string | null
          resolved_note: string | null
          retention_class: string
          risk_category: string
          rule_code: Database["public"]["Enums"]["safety_rule_code"]
          rule_id: string | null
          severity: Database["public"]["Enums"]["safety_severity"]
          status: Database["public"]["Enums"]["safety_alert_status"]
          step_up_session_id: string | null
          tenant_id: string
          triggering_event_ids: string[]
        }
        Insert: {
          actions_taken?: string[]
          actor_subject_id: string
          application_id: string
          counterparty_subject_id?: string | null
          created_at?: string
          id?: string
          legal_hold?: boolean
          parental_consent_request_id?: string | null
          reason_codes: string[]
          resolved_at?: string | null
          resolved_note?: string | null
          retention_class?: string
          risk_category: string
          rule_code: Database["public"]["Enums"]["safety_rule_code"]
          rule_id?: string | null
          severity: Database["public"]["Enums"]["safety_severity"]
          status?: Database["public"]["Enums"]["safety_alert_status"]
          step_up_session_id?: string | null
          tenant_id: string
          triggering_event_ids?: string[]
        }
        Update: {
          actions_taken?: string[]
          actor_subject_id?: string
          application_id?: string
          counterparty_subject_id?: string | null
          created_at?: string
          id?: string
          legal_hold?: boolean
          parental_consent_request_id?: string | null
          reason_codes?: string[]
          resolved_at?: string | null
          resolved_note?: string | null
          retention_class?: string
          risk_category?: string
          rule_code?: Database["public"]["Enums"]["safety_rule_code"]
          rule_id?: string | null
          severity?: Database["public"]["Enums"]["safety_severity"]
          status?: Database["public"]["Enums"]["safety_alert_status"]
          step_up_session_id?: string | null
          tenant_id?: string
          triggering_event_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "safety_alerts_actor_subject_id_fkey"
            columns: ["actor_subject_id"]
            isOneToOne: false
            referencedRelation: "safety_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_alerts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_alerts_counterparty_subject_id_fkey"
            columns: ["counterparty_subject_id"]
            isOneToOne: false
            referencedRelation: "safety_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "safety_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_events: {
        Row: {
          application_id: string
          content_hash: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["safety_event_type"]
          id: string
          interaction_id: string | null
          legal_hold: boolean
          metadata_jsonb: Json
          occurred_at: string
          payload_hash: string
          retention_class: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          content_hash?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["safety_event_type"]
          id?: string
          interaction_id?: string | null
          legal_hold?: boolean
          metadata_jsonb?: Json
          occurred_at?: string
          payload_hash: string
          retention_class?: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          content_hash?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["safety_event_type"]
          id?: string
          interaction_id?: string | null
          legal_hold?: boolean
          metadata_jsonb?: Json
          occurred_at?: string
          payload_hash?: string
          retention_class?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_events_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "safety_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_evidence_artifacts: {
        Row: {
          alert_id: string
          artifact_hash: string
          created_at: string
          id: string
          legal_hold: boolean
          mime_type: string | null
          retention_class: string
          size_bytes: number | null
          storage_bucket: string | null
          storage_path: string | null
          tenant_id: string
        }
        Insert: {
          alert_id: string
          artifact_hash: string
          created_at?: string
          id?: string
          legal_hold?: boolean
          mime_type?: string | null
          retention_class?: string
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          tenant_id: string
        }
        Update: {
          alert_id?: string
          artifact_hash?: string
          created_at?: string
          id?: string
          legal_hold?: boolean
          mime_type?: string | null
          retention_class?: string
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_evidence_artifacts_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "safety_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_evidence_artifacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_interactions: {
        Row: {
          actor_subject_id: string
          application_id: string
          counterparty_subject_id: string | null
          events_count: number
          first_seen_at: string
          id: string
          last_seen_at: string
          relationship: string
          reports_count: number
          tenant_id: string
        }
        Insert: {
          actor_subject_id: string
          application_id: string
          counterparty_subject_id?: string | null
          events_count?: number
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          relationship: string
          reports_count?: number
          tenant_id: string
        }
        Update: {
          actor_subject_id?: string
          application_id?: string
          counterparty_subject_id?: string | null
          events_count?: number
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          relationship?: string
          reports_count?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_interactions_actor_subject_id_fkey"
            columns: ["actor_subject_id"]
            isOneToOne: false
            referencedRelation: "safety_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_interactions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_interactions_counterparty_subject_id_fkey"
            columns: ["counterparty_subject_id"]
            isOneToOne: false
            referencedRelation: "safety_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_interactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_model_runs: {
        Row: {
          confidence: number | null
          created_at: string
          duration_ms: number | null
          id: string
          input_hash: string
          model_id: string
          model_version: string
          output_jsonb: Json
          tenant_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          input_hash: string
          model_id: string
          model_version: string
          output_jsonb?: Json
          tenant_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          input_hash?: string
          model_id?: string
          model_version?: string
          output_jsonb?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_model_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_rules: {
        Row: {
          actions: string[]
          config_json: Json
          created_at: string
          enabled: boolean
          id: string
          rule_code: Database["public"]["Enums"]["safety_rule_code"]
          severity: Database["public"]["Enums"]["safety_severity"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          actions: string[]
          config_json?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          rule_code: Database["public"]["Enums"]["safety_rule_code"]
          severity: Database["public"]["Enums"]["safety_severity"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          actions?: string[]
          config_json?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          rule_code?: Database["public"]["Enums"]["safety_rule_code"]
          severity?: Database["public"]["Enums"]["safety_severity"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_subjects: {
        Row: {
          age_state: Database["public"]["Enums"]["safety_subject_age_state"]
          alerts_count: number
          application_id: string
          assurance_level: string | null
          created_at: string
          id: string
          last_seen_at: string
          reports_count: number
          subject_ref_hmac: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          age_state?: Database["public"]["Enums"]["safety_subject_age_state"]
          alerts_count?: number
          application_id: string
          assurance_level?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          reports_count?: number
          subject_ref_hmac: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          age_state?: Database["public"]["Enums"]["safety_subject_age_state"]
          alerts_count?: number
          application_id?: string
          assurance_level?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          reports_count?: number
          subject_ref_hmac?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_subjects_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_subjects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["tenant_user_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["tenant_user_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["tenant_user_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          branding_json: Json
          created_at: string
          custom_domain: string | null
          deleted_at: string | null
          id: string
          name: string
          plan: string
          retention_days: number
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
        }
        Insert: {
          branding_json?: Json
          created_at?: string
          custom_domain?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          plan?: string
          retention_days?: number
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Update: {
          branding_json?: Json
          created_at?: string
          custom_domain?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          plan?: string
          retention_days?: number
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Relationships: []
      }
      trust_lists: {
        Row: {
          created_at: string
          id: string
          issuer_id: string
          tenant_id: string
          trust_override: Database["public"]["Enums"]["trust_override"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          issuer_id: string
          tenant_id: string
          trust_override: Database["public"]["Enums"]["trust_override"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          issuer_id?: string
          tenant_id?: string
          trust_override?: Database["public"]["Enums"]["trust_override"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_lists_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "issuers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trust_lists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          application_id: string
          day: string
          tenant_id: string
          tokens_issued: number
          verifications_approved: number
          verifications_created: number
          verifications_denied: number
          webhooks_delivered: number
        }
        Insert: {
          application_id: string
          day: string
          tenant_id: string
          tokens_issued?: number
          verifications_approved?: number
          verifications_created?: number
          verifications_denied?: number
          webhooks_delivered?: number
        }
        Update: {
          application_id?: string
          day?: string
          tenant_id?: string
          tokens_issued?: number
          verifications_approved?: number
          verifications_created?: number
          verifications_denied?: number
          webhooks_delivered?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_challenges: {
        Row: {
          consumed_at: string | null
          expires_at: string
          id: string
          issued_at: string
          nonce: string
          session_id: string
        }
        Insert: {
          consumed_at?: string | null
          expires_at?: string
          id?: string
          issued_at?: string
          nonce: string
          session_id: string
        }
        Update: {
          consumed_at?: string | null
          expires_at?: string
          id?: string
          issued_at?: string
          nonce?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_challenges_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "verification_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_results: {
        Row: {
          assurance_level: Database["public"]["Enums"]["assurance_level"]
          created_at: string
          decision: Database["public"]["Enums"]["verification_decision"]
          evidence_json: Json
          id: string
          issuer_id: string | null
          method: Database["public"]["Enums"]["verification_method"]
          reason_code: string
          session_id: string
          signed_token_jti: string | null
          tenant_id: string
          threshold_satisfied: boolean
        }
        Insert: {
          assurance_level: Database["public"]["Enums"]["assurance_level"]
          created_at?: string
          decision: Database["public"]["Enums"]["verification_decision"]
          evidence_json?: Json
          id?: string
          issuer_id?: string | null
          method: Database["public"]["Enums"]["verification_method"]
          reason_code: string
          session_id: string
          signed_token_jti?: string | null
          tenant_id: string
          threshold_satisfied: boolean
        }
        Update: {
          assurance_level?: Database["public"]["Enums"]["assurance_level"]
          created_at?: string
          decision?: Database["public"]["Enums"]["verification_decision"]
          evidence_json?: Json
          id?: string
          issuer_id?: string | null
          method?: Database["public"]["Enums"]["verification_method"]
          reason_code?: string
          session_id?: string
          signed_token_jti?: string | null
          tenant_id?: string
          threshold_satisfied?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_vresults_issuer"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "issuers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "verification_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_sessions: {
        Row: {
          application_id: string
          cancel_url: string | null
          client_capabilities_json: Json
          client_ip: unknown
          completed_at: string | null
          created_at: string
          expires_at: string
          external_user_ref: string | null
          id: string
          locale: string
          method: Database["public"]["Enums"]["verification_method"] | null
          policy_id: string
          policy_version_id: string
          redirect_url: string | null
          status: Database["public"]["Enums"]["session_status"]
          tenant_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          application_id: string
          cancel_url?: string | null
          client_capabilities_json?: Json
          client_ip?: unknown
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          external_user_ref?: string | null
          id?: string
          locale?: string
          method?: Database["public"]["Enums"]["verification_method"] | null
          policy_id: string
          policy_version_id: string
          redirect_url?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          tenant_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          application_id?: string
          cancel_url?: string | null
          client_capabilities_json?: Json
          client_ip?: unknown
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          external_user_ref?: string | null
          id?: string
          locale?: string
          method?: Database["public"]["Enums"]["verification_method"] | null
          policy_id?: string
          policy_version_id?: string
          redirect_url?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          tenant_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_sessions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_sessions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_sessions_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          endpoint_id: string
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          last_response_code: number | null
          next_attempt_at: string
          payload_json: Json
          signature: string
          status: Database["public"]["Enums"]["webhook_delivery_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          endpoint_id: string
          event_type: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          last_response_code?: number | null
          next_attempt_at?: string
          payload_json: Json
          signature: string
          status?: Database["public"]["Enums"]["webhook_delivery_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          endpoint_id?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          last_response_code?: number | null
          next_attempt_at?: string
          payload_json?: Json
          signature?: string
          status?: Database["public"]["Enums"]["webhook_delivery_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          application_id: string
          created_at: string
          deleted_at: string | null
          events: string[]
          id: string
          name: string
          secret_hash: string
          status: Database["public"]["Enums"]["application_status"]
          tenant_id: string
          updated_at: string
          url: string
        }
        Insert: {
          application_id: string
          created_at?: string
          deleted_at?: string | null
          events?: string[]
          id?: string
          name?: string
          secret_hash: string
          status?: Database["public"]["Enums"]["application_status"]
          tenant_id: string
          updated_at?: string
          url: string
        }
        Update: {
          application_id?: string
          created_at?: string
          deleted_at?: string | null
          events?: string[]
          id?: string
          name?: string
          secret_hash?: string
          status?: Database["public"]["Enums"]["application_status"]
          tenant_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_endpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      safety_webhook_deliveries: {
        Row: {
          attempts: number | null
          created_at: string | null
          endpoint_id: string | null
          event_type: string | null
          id: string | null
          idempotency_key: string | null
          last_error: string | null
          last_response_code: number | null
          next_attempt_at: string | null
          payload_json: Json | null
          signature: string | null
          status: Database["public"]["Enums"]["webhook_delivery_status"] | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          endpoint_id?: string | null
          event_type?: string | null
          id?: string | null
          idempotency_key?: string | null
          last_error?: string | null
          last_response_code?: number | null
          next_attempt_at?: string | null
          payload_json?: Json | null
          signature?: string | null
          status?: Database["public"]["Enums"]["webhook_delivery_status"] | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          endpoint_id?: string | null
          event_type?: string | null
          id?: string | null
          idempotency_key?: string | null
          last_error?: string | null
          last_response_code?: number | null
          next_attempt_at?: string | null
          payload_json?: Json | null
          signature?: string | null
          status?: Database["public"]["Enums"]["webhook_delivery_status"] | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      build_parental_consent_event_payload: {
        Args: { p_consent_id: string; p_event_type: string }
        Returns: Json
      }
      build_safety_alert_event_payload: {
        Args: { p_alert_id: string; p_event_type: string }
        Returns: Json
      }
      build_verification_event_payload: {
        Args: { p_result_id: string }
        Returns: Json
      }
      crypto_keys_load_private: { Args: { p_kid: string }; Returns: Json }
      crypto_keys_purge_vault: { Args: { p_kid: string }; Returns: undefined }
      crypto_keys_store_private: {
        Args: { p_kid: string; p_private_jwk_json: Json }
        Returns: string
      }
      current_tenant_id: { Args: never; Returns: string }
      drop_partition: { Args: { p_child: string }; Returns: undefined }
      guardian_contacts_load: {
        Args: { p_guardian_contact_id: string }
        Returns: string
      }
      guardian_contacts_purge_vault: {
        Args: { p_guardian_contact_id: string }
        Returns: undefined
      }
      guardian_contacts_store: {
        Args: { p_consent_request_id: string; p_contact_value: string }
        Returns: string
      }
      has_role: {
        Args: { required: Database["public"]["Enums"]["tenant_user_role"] }
        Returns: boolean
      }
      list_old_partitions: {
        Args: { p_cutoff: string }
        Returns: {
          child: string
          parent: string
          range_end: string
          range_start: string
        }[]
      }
      rate_limit_consume: {
        Args: {
          p_capacity: number
          p_key: string
          p_refill_rate: number
          p_tenant_id: string
        }
        Returns: Json
      }
      safety_recompute_messages_24h: { Args: never; Returns: number }
      set_current_tenant: { Args: { tid: string }; Returns: undefined }
      set_tenant_context: { Args: { tenant_id: string }; Returns: undefined }
      sha256_hex: { Args: { val: string }; Returns: string }
      tenant_bootstrap: {
        Args: {
          p_api_key_hash: string
          p_api_key_prefix: string
          p_application_description: string
          p_application_name: string
          p_application_slug: string
          p_tenant_name: string
          p_tenant_slug: string
          p_user_id: string
          p_webhook_secret_hash: string
        }
        Returns: Json
      }
      uuid_generate_v7: { Args: never; Returns: string }
    }
    Enums: {
      application_status: "active" | "inactive" | "suspended"
      assurance_level: "low" | "substantial" | "high"
      audit_actor_type: "user" | "api_key" | "system" | "cron"
      crypto_key_status: "rotating" | "active" | "retired"
      issuer_trust_status: "trusted" | "suspended" | "untrusted"
      parental_consent_assurance_level:
        | "AAL-C0"
        | "AAL-C1"
        | "AAL-C2"
        | "AAL-C3"
        | "AAL-C4"
      parental_consent_status:
        | "pending"
        | "awaiting_guardian"
        | "awaiting_verification"
        | "awaiting_confirmation"
        | "approved"
        | "denied"
        | "expired"
        | "revoked"
      safety_alert_status:
        | "open"
        | "acknowledged"
        | "escalated"
        | "resolved"
        | "dismissed"
      safety_event_type:
        | "message_sent"
        | "message_received"
        | "media_upload"
        | "external_link_shared"
        | "profile_view"
        | "follow_request"
        | "report_filed"
        | "private_chat_started"
      safety_rule_code:
        | "UNKNOWN_TO_MINOR_PRIVATE_MESSAGE"
        | "ADULT_MINOR_HIGH_FREQUENCY_24H"
        | "MEDIA_UPLOAD_TO_MINOR"
        | "EXTERNAL_LINK_TO_MINOR"
        | "MULTIPLE_REPORTS_AGAINST_ACTOR"
      safety_severity: "info" | "low" | "medium" | "high" | "critical"
      safety_subject_age_state:
        | "minor"
        | "teen"
        | "adult"
        | "unknown"
        | "eligible_under_policy"
        | "not_eligible_under_policy"
        | "blocked_under_policy"
      session_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "expired"
        | "cancelled"
      tenant_status: "active" | "suspended" | "pending_setup" | "closed"
      tenant_user_role: "owner" | "admin" | "operator" | "auditor" | "billing"
      token_status: "active" | "revoked" | "expired"
      trust_override: "trust" | "distrust"
      verification_decision: "approved" | "denied" | "needs_review"
      verification_method: "zkp" | "vc" | "gateway" | "fallback"
      webhook_delivery_status:
        | "pending"
        | "delivered"
        | "failed"
        | "dead_letter"
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
    Enums: {
      application_status: ["active", "inactive", "suspended"],
      assurance_level: ["low", "substantial", "high"],
      audit_actor_type: ["user", "api_key", "system", "cron"],
      crypto_key_status: ["rotating", "active", "retired"],
      issuer_trust_status: ["trusted", "suspended", "untrusted"],
      parental_consent_assurance_level: [
        "AAL-C0",
        "AAL-C1",
        "AAL-C2",
        "AAL-C3",
        "AAL-C4",
      ],
      parental_consent_status: [
        "pending",
        "awaiting_guardian",
        "awaiting_verification",
        "awaiting_confirmation",
        "approved",
        "denied",
        "expired",
        "revoked",
      ],
      safety_alert_status: [
        "open",
        "acknowledged",
        "escalated",
        "resolved",
        "dismissed",
      ],
      safety_event_type: [
        "message_sent",
        "message_received",
        "media_upload",
        "external_link_shared",
        "profile_view",
        "follow_request",
        "report_filed",
        "private_chat_started",
      ],
      safety_rule_code: [
        "UNKNOWN_TO_MINOR_PRIVATE_MESSAGE",
        "ADULT_MINOR_HIGH_FREQUENCY_24H",
        "MEDIA_UPLOAD_TO_MINOR",
        "EXTERNAL_LINK_TO_MINOR",
        "MULTIPLE_REPORTS_AGAINST_ACTOR",
      ],
      safety_severity: ["info", "low", "medium", "high", "critical"],
      safety_subject_age_state: [
        "minor",
        "teen",
        "adult",
        "unknown",
        "eligible_under_policy",
        "not_eligible_under_policy",
        "blocked_under_policy",
      ],
      session_status: [
        "pending",
        "in_progress",
        "completed",
        "expired",
        "cancelled",
      ],
      tenant_status: ["active", "suspended", "pending_setup", "closed"],
      tenant_user_role: ["owner", "admin", "operator", "auditor", "billing"],
      token_status: ["active", "revoked", "expired"],
      trust_override: ["trust", "distrust"],
      verification_decision: ["approved", "denied", "needs_review"],
      verification_method: ["zkp", "vc", "gateway", "fallback"],
      webhook_delivery_status: [
        "pending",
        "delivered",
        "failed",
        "dead_letter",
      ],
    },
  },
} as const

// ============================================================
// Convenience aliases — preservam imports existentes do admin app.
// ============================================================

export type TenantRow = Database['public']['Tables']['tenants']['Row'];
export type TenantUserRow = Database['public']['Tables']['tenant_users']['Row'];
export type ApplicationRow = Database['public']['Tables']['applications']['Row'];
export type PolicyRow = Database['public']['Tables']['policies']['Row'];
export type IssuerRow = Database['public']['Tables']['issuers']['Row'];
export type VerificationSessionRow = Database['public']['Tables']['verification_sessions']['Row'];
export type VerificationResultRow = Database['public']['Tables']['verification_results']['Row'];
export type ResultTokenRow = Database['public']['Tables']['result_tokens']['Row'];
export type UsageCounterRow = Database['public']['Tables']['usage_counters']['Row'];
export type AuditEventRow = Database['public']['Tables']['audit_events']['Row'];
export type WebhookEndpointRow = Database['public']['Tables']['webhook_endpoints']['Row'];
export type WebhookDeliveryRow = Database['public']['Tables']['webhook_deliveries']['Row'];

// Consent (R3)
export type ConsentTextVersionRow = Database['public']['Tables']['consent_text_versions']['Row'];
export type ParentalConsentRequestRow = Database['public']['Tables']['parental_consent_requests']['Row'];
export type ParentalConsentRow = Database['public']['Tables']['parental_consents']['Row'];
export type ParentalConsentTokenRow = Database['public']['Tables']['parental_consent_tokens']['Row'];
export type ParentalConsentRevocationRow = Database['public']['Tables']['parental_consent_revocations']['Row'];
export type GuardianContactRow = Database['public']['Tables']['guardian_contacts']['Row'];
export type GuardianVerificationRow = Database['public']['Tables']['guardian_verifications']['Row'];

// Safety (R4)
export type SafetySubjectRow = Database['public']['Tables']['safety_subjects']['Row'];
export type SafetyInteractionRow = Database['public']['Tables']['safety_interactions']['Row'];
export type SafetyEventRow = Database['public']['Tables']['safety_events']['Row'];
export type SafetyRuleRow = Database['public']['Tables']['safety_rules']['Row'];
export type SafetyAlertRow = Database['public']['Tables']['safety_alerts']['Row'];
export type SafetyAggregateRow = Database['public']['Tables']['safety_aggregates']['Row'];
export type SafetyEvidenceArtifactRow = Database['public']['Tables']['safety_evidence_artifacts']['Row'];
export type SafetyModelRunRow = Database['public']['Tables']['safety_model_runs']['Row'];
