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
      keywords: {
        Row: {
          category: Database["public"]["Enums"]["keyword_category"]
          created_at: string | null
          id: string
          keyword: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["keyword_category"]
          created_at?: string | null
          id?: string
          keyword: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["keyword_category"]
          created_at?: string | null
          id?: string
          keyword?: string
          updated_at?: string | null
          weight?: number | null
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
          name: string
          updated_at: string | null
        }
        Insert: {
          billing_status?: string | null
          created_at?: string | null
          domain: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          billing_status?: string | null
          created_at?: string | null
          domain?: string
          id?: string
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
          published_date: string | null
          score: number | null
          search_vector: unknown
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
          published_date?: string | null
          score?: number | null
          search_vector?: unknown
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
          published_date?: string | null
          score?: number | null
          search_vector?: unknown
          title?: string
        }
        Relationships: []
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
      create_org_for_user: {
        Args: { org_domain: string; org_name: string }
        Returns: string
      }
      get_user_organization: { Args: { user_id: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
      partner_combination_type: "solo" | "lead_partner" | "partner_led"
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
      partner_combination_type: ["solo", "lead_partner", "partner_led"],
    },
  },
} as const
