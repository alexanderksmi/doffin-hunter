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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      company_profiles: {
        Row: {
          created_at: string | null
          id: string
          is_own_profile: boolean | null
          organization_id: string
          partner_id: string | null
          profile_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_own_profile?: boolean | null
          organization_id: string
          partner_id?: string | null
          profile_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_own_profile?: boolean | null
          organization_id?: string
          partner_id?: string | null
          profile_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_profiles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      cpv_codes: {
        Row: {
          cpv_code: string
          created_at: string | null
          id: string
          profile_id: string
          updated_at: string | null
          weight: number
        }
        Insert: {
          cpv_code: string
          created_at?: string | null
          id?: string
          profile_id: string
          updated_at?: string | null
          weight?: number
        }
        Update: {
          cpv_code?: string
          created_at?: string | null
          id?: string
          profile_id?: string
          updated_at?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "cpv_codes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cpv_hierarchy: {
        Row: {
          cpv_code: string
          created_at: string
          description: string | null
          level: number
          parent_code: string | null
        }
        Insert: {
          cpv_code: string
          created_at?: string
          description?: string | null
          level: number
          parent_code?: string | null
        }
        Update: {
          cpv_code?: string
          created_at?: string
          description?: string | null
          level?: number
          parent_code?: string | null
        }
        Relationships: []
      }
      evaluation_jobs: {
        Row: {
          affected_profile_ids: string[]
          broadcast_payload: Json | null
          completed_at: string | null
          created_at: string
          dedupe_key: string
          error_code: string | null
          error_message: string | null
          id: string
          max_retries: number
          organization_id: string
          retry_count: number
          run_not_before: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          affected_profile_ids?: string[]
          broadcast_payload?: Json | null
          completed_at?: string | null
          created_at?: string
          dedupe_key: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number
          organization_id: string
          retry_count?: number
          run_not_before?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          affected_profile_ids?: string[]
          broadcast_payload?: Json | null
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number
          organization_id?: string
          retry_count?: number
          run_not_before?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      minimum_requirements: {
        Row: {
          created_at: string | null
          id: string
          keyword: string
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          keyword: string
          profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          keyword?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "minimum_requirements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      negative_keywords: {
        Row: {
          created_at: string | null
          id: string
          keyword: string
          profile_id: string
          updated_at: string | null
          weight: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          keyword: string
          profile_id: string
          updated_at?: string | null
          weight?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          keyword?: string
          profile_id?: string
          updated_at?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "negative_keywords_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_status: string | null
          created_at: string | null
          domain: string
          id: string
          last_tender_sync_at: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          billing_status?: string | null
          created_at?: string | null
          domain: string
          id?: string
          last_tender_sync_at?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          billing_status?: string | null
          created_at?: string | null
          domain?: string
          id?: string
          last_tender_sync_at?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      partner_graph: {
        Row: {
          combination_type: Database["public"]["Enums"]["partner_combination_type"]
          created_at: string | null
          id: string
          lead_profile_id: string | null
          organization_id: string
          partner_profile_id: string | null
        }
        Insert: {
          combination_type: Database["public"]["Enums"]["partner_combination_type"]
          created_at?: string | null
          id?: string
          lead_profile_id?: string | null
          organization_id: string
          partner_profile_id?: string | null
        }
        Update: {
          combination_type?: Database["public"]["Enums"]["partner_combination_type"]
          created_at?: string | null
          id?: string
          lead_profile_id?: string | null
          organization_id?: string
          partner_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_graph_lead_profile_id_fkey"
            columns: ["lead_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_graph_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_graph_partner_profile_id_fkey"
            columns: ["partner_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          partner_domain: string
          partner_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          partner_domain: string
          partner_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          partner_domain?: string
          partner_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_tenders: {
        Row: {
          activity_log: Json | null
          assigned_to: string | null
          cached_client: string | null
          cached_deadline: string | null
          cached_doffin_url: string | null
          cached_title: string | null
          combination_type: string
          comments: string | null
          created_at: string | null
          current_stage: Database["public"]["Enums"]["tender_stage"] | null
          editing_by: string | null
          editing_started_at: string | null
          evaluation_id: string
          id: string
          is_shared: boolean | null
          lead_profile_id: string | null
          notes: string | null
          organization_id: string
          partner_profile_id: string | null
          relevance_score: number | null
          saved_by: string
          stage_notes: Json | null
          status: string
          tender_id: string
          time_criticality: string | null
          updated_at: string | null
        }
        Insert: {
          activity_log?: Json | null
          assigned_to?: string | null
          cached_client?: string | null
          cached_deadline?: string | null
          cached_doffin_url?: string | null
          cached_title?: string | null
          combination_type?: string
          comments?: string | null
          created_at?: string | null
          current_stage?: Database["public"]["Enums"]["tender_stage"] | null
          editing_by?: string | null
          editing_started_at?: string | null
          evaluation_id: string
          id?: string
          is_shared?: boolean | null
          lead_profile_id?: string | null
          notes?: string | null
          organization_id: string
          partner_profile_id?: string | null
          relevance_score?: number | null
          saved_by: string
          stage_notes?: Json | null
          status?: string
          tender_id: string
          time_criticality?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_log?: Json | null
          assigned_to?: string | null
          cached_client?: string | null
          cached_deadline?: string | null
          cached_doffin_url?: string | null
          cached_title?: string | null
          combination_type?: string
          comments?: string | null
          created_at?: string | null
          current_stage?: Database["public"]["Enums"]["tender_stage"] | null
          editing_by?: string | null
          editing_started_at?: string | null
          evaluation_id?: string
          id?: string
          is_shared?: boolean | null
          lead_profile_id?: string | null
          notes?: string | null
          organization_id?: string
          partner_profile_id?: string | null
          relevance_score?: number | null
          saved_by?: string
          stage_notes?: Json | null
          status?: string
          tender_id?: string
          time_criticality?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_tenders_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "tender_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_tenders_lead_profile_fkey"
            columns: ["lead_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_tenders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_tenders_partner_profile_fkey"
            columns: ["partner_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_tenders_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_tender_links: {
        Row: {
          accepted_at: string | null
          cached_combination_type: string | null
          cached_current_stage: string | null
          cached_evaluation_id: string | null
          cached_lead_profile_id: string | null
          cached_partner_profile_id: string | null
          cached_source_org_name: string | null
          cached_stage_notes: Json | null
          cached_tender_client: string | null
          cached_tender_deadline: string | null
          cached_tender_doffin_url: string | null
          cached_tender_id: string | null
          cached_tender_title: string | null
          created_at: string | null
          id: string
          invited_at: string | null
          rejected_at: string | null
          source_organization_id: string
          source_saved_tender_id: string
          status: string
          target_organization_id: string | null
          target_saved_tender_id: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          cached_combination_type?: string | null
          cached_current_stage?: string | null
          cached_evaluation_id?: string | null
          cached_lead_profile_id?: string | null
          cached_partner_profile_id?: string | null
          cached_source_org_name?: string | null
          cached_stage_notes?: Json | null
          cached_tender_client?: string | null
          cached_tender_deadline?: string | null
          cached_tender_doffin_url?: string | null
          cached_tender_id?: string | null
          cached_tender_title?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          rejected_at?: string | null
          source_organization_id: string
          source_saved_tender_id: string
          status?: string
          target_organization_id?: string | null
          target_saved_tender_id?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          cached_combination_type?: string | null
          cached_current_stage?: string | null
          cached_evaluation_id?: string | null
          cached_lead_profile_id?: string | null
          cached_partner_profile_id?: string | null
          cached_source_org_name?: string | null
          cached_stage_notes?: Json | null
          cached_tender_client?: string | null
          cached_tender_deadline?: string | null
          cached_tender_doffin_url?: string | null
          cached_tender_id?: string | null
          cached_tender_title?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          rejected_at?: string | null
          source_organization_id?: string
          source_saved_tender_id?: string
          status?: string
          target_organization_id?: string | null
          target_saved_tender_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_tender_links_source_organization_id_fkey"
            columns: ["source_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_tender_links_source_saved_tender_id_fkey"
            columns: ["source_saved_tender_id"]
            isOneToOne: false
            referencedRelation: "saved_tenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_tender_links_target_organization_id_fkey"
            columns: ["target_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_tender_links_target_saved_tender_id_fkey"
            columns: ["target_saved_tender_id"]
            isOneToOne: false
            referencedRelation: "saved_tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      support_keywords: {
        Row: {
          created_at: string | null
          id: string
          keyword: string
          profile_id: string
          updated_at: string | null
          weight: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          keyword: string
          profile_id: string
          updated_at?: string | null
          weight?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          keyword?: string
          profile_id?: string
          updated_at?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_keywords_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tender_chat_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          reply_to_id: string | null
          saved_tender_id: string
          sender_id: string
          sender_organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          reply_to_id?: string | null
          saved_tender_id: string
          sender_id: string
          sender_organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          reply_to_id?: string | null
          saved_tender_id?: string
          sender_id?: string
          sender_organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tender_chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "tender_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tender_chat_messages_saved_tender_id_fkey"
            columns: ["saved_tender_id"]
            isOneToOne: false
            referencedRelation: "saved_tenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tender_chat_messages_sender_organization_id_fkey"
            columns: ["sender_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tender_contacts: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          role: string | null
          saved_tender_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          role?: string | null
          saved_tender_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
          saved_tender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tender_contacts_saved_tender_id_fkey"
            columns: ["saved_tender_id"]
            isOneToOne: false
            referencedRelation: "saved_tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      tender_evaluations: {
        Row: {
          all_minimum_requirements_met: boolean
          combination_id: string | null
          combination_type: string
          cpv_score: number | null
          created_at: string | null
          criteria_fingerprint: string | null
          explanation: string | null
          id: string
          is_active: boolean
          is_manual: boolean
          lead_profile_id: string | null
          matched_cpv_codes: Json | null
          matched_negative_keywords: Json | null
          matched_support_keywords: Json | null
          met_minimum_requirements: Json | null
          missing_minimum_requirements: Json | null
          negative_score: number | null
          organization_id: string
          partner_profile_id: string | null
          support_score: number | null
          synergy_bonus: number | null
          tender_id: string
          total_score: number | null
          updated_at: string | null
        }
        Insert: {
          all_minimum_requirements_met?: boolean
          combination_id?: string | null
          combination_type: string
          cpv_score?: number | null
          created_at?: string | null
          criteria_fingerprint?: string | null
          explanation?: string | null
          id?: string
          is_active?: boolean
          is_manual?: boolean
          lead_profile_id?: string | null
          matched_cpv_codes?: Json | null
          matched_negative_keywords?: Json | null
          matched_support_keywords?: Json | null
          met_minimum_requirements?: Json | null
          missing_minimum_requirements?: Json | null
          negative_score?: number | null
          organization_id: string
          partner_profile_id?: string | null
          support_score?: number | null
          synergy_bonus?: number | null
          tender_id: string
          total_score?: number | null
          updated_at?: string | null
        }
        Update: {
          all_minimum_requirements_met?: boolean
          combination_id?: string | null
          combination_type?: string
          cpv_score?: number | null
          created_at?: string | null
          criteria_fingerprint?: string | null
          explanation?: string | null
          id?: string
          is_active?: boolean
          is_manual?: boolean
          lead_profile_id?: string | null
          matched_cpv_codes?: Json | null
          matched_negative_keywords?: Json | null
          matched_support_keywords?: Json | null
          met_minimum_requirements?: Json | null
          missing_minimum_requirements?: Json | null
          negative_score?: number | null
          organization_id?: string
          partner_profile_id?: string | null
          support_score?: number | null
          synergy_bonus?: number | null
          tender_id?: string
          total_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tender_evaluations_combination_id_fkey"
            columns: ["combination_id"]
            isOneToOne: false
            referencedRelation: "partner_graph"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tender_evaluations_lead_profile_id_fkey"
            columns: ["lead_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tender_evaluations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tender_evaluations_partner_profile_id_fkey"
            columns: ["partner_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tender_evaluations_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      tender_owners: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          role: string | null
          saved_tender_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          role?: string | null
          saved_tender_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          role?: string | null
          saved_tender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tender_owners_saved_tender_id_fkey"
            columns: ["saved_tender_id"]
            isOneToOne: false
            referencedRelation: "saved_tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      tender_sync_log: {
        Row: {
          completed_at: string | null
          error_message: string | null
          fetched_count: number | null
          id: string
          saved_count: number | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          fetched_count?: number | null
          id?: string
          saved_count?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          fetched_count?: number | null
          id?: string
          saved_count?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      tender_tasks: {
        Row: {
          completed: boolean | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          owner_id: string
          saved_tender_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id: string
          saved_tender_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string
          saved_tender_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tender_tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "tender_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tender_tasks_saved_tender_id_fkey"
            columns: ["saved_tender_id"]
            isOneToOne: false
            referencedRelation: "saved_tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      tenders: {
        Row: {
          body: string | null
          client: string | null
          cpv_codes: string[] | null
          created_at: string | null
          deadline: string | null
          doffin_id: string
          doffin_url: string | null
          id: string
          matched_keywords: Json | null
          org_id: string
          published_date: string | null
          score: number | null
          search_vector: unknown
          source_updated_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          client?: string | null
          cpv_codes?: string[] | null
          created_at?: string | null
          deadline?: string | null
          doffin_id: string
          doffin_url?: string | null
          id?: string
          matched_keywords?: Json | null
          org_id: string
          published_date?: string | null
          score?: number | null
          search_vector?: unknown
          source_updated_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          client?: string | null
          cpv_codes?: string[] | null
          created_at?: string | null
          deadline?: string | null
          doffin_id?: string
          doffin_url?: string | null
          id?: string
          matched_keywords?: Json | null
          org_id?: string
          published_date?: string | null
          score?: number | null
          search_vector?: unknown
          source_updated_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_next_evaluation_job: {
        Args: never
        Returns: {
          affected_profile_ids: string[]
          job_id: string
          organization_id: string
        }[]
      }
      cpv_match_weight: {
        Args: { profile_code: string; tender_code: string }
        Returns: number
      }
      create_org_for_user: {
        Args: { org_domain: string; org_name: string }
        Returns: string
      }
      evaluate_tenders_batch: {
        Args: { _org_id: string; _profile_ids: string[] }
        Returns: {
          all_minimum_met: boolean
          criteria_fingerprint: string
          matched_keywords: Json
          profile_id: string
          tender_id: string
          total_score: number
        }[]
      }
      find_organization_by_partner_domain: {
        Args: { partner_profile_id: string }
        Returns: string
      }
      get_cpv_with_parents: { Args: { code: string }; Returns: string[] }
      get_user_organization: { Args: { user_id: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_evaluation_results_with_cleanup: {
        Args: {
          _combination_type: string
          _criteria_fingerprint: string
          _org_id: string
          _profile_id: string
          _results: Json
        }
        Returns: {
          pruned_count: number
          upserted_count: number
        }[]
      }
      user_can_edit: { Args: { _user_id: string }; Returns: boolean }
      user_has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      keyword_category: "positive" | "negative"
      partner_combination_type:
        | "solo"
        | "lead_partner"
        | "partner_led"
        | "partner_only"
      tender_stage:
        | "kvalifisering"
        | "analyse_planlegging"
        | "svarer_anbud"
        | "kvalitetssikring"
        | "godkjenning"
        | "laring"
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
      app_role: ["admin", "editor", "viewer"],
      keyword_category: ["positive", "negative"],
      partner_combination_type: [
        "solo",
        "lead_partner",
        "partner_led",
        "partner_only",
      ],
      tender_stage: [
        "kvalifisering",
        "analyse_planlegging",
        "svarer_anbud",
        "kvalitetssikring",
        "godkjenning",
        "laring",
      ],
    },
  },
} as const
