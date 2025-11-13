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
      allowed_admin_emails: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      logs_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          note: string | null
          request_id: string | null
          rule_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          note?: string | null
          request_id?: string | null
          rule_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          note?: string | null
          request_id?: string | null
          rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_audit_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_audit_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules_reality"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          badges: string[] | null
          created_at: string
          generator_request: Json | null
          generator_response: Json | null
          id: string
          image_url: string
          is_selected: boolean | null
          price_range_max: number
          price_range_min: number
          request_id: string
          seed: number | null
          spec_json: Json
          variant: string
        }
        Insert: {
          badges?: string[] | null
          created_at?: string
          generator_request?: Json | null
          generator_response?: Json | null
          id?: string
          image_url: string
          is_selected?: boolean | null
          price_range_max: number
          price_range_min: number
          request_id: string
          seed?: number | null
          spec_json: Json
          variant: string
        }
        Update: {
          badges?: string[] | null
          created_at?: string
          generator_request?: Json | null
          generator_response?: Json | null
          id?: string
          image_url?: string
          is_selected?: boolean | null
          price_range_max?: number
          price_range_min?: number
          request_id?: string
          seed?: number | null
          spec_json?: Json
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          access_token: string
          consent_marketing: boolean | null
          consent_terms: boolean | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          parsed_slots: Json | null
          payment_provider: string | null
          payment_reference: string | null
          payment_status: string
          size_category_id: string
          status: string
          stylepack_id: string
          updated_at: string
          user_images: string[] | null
          user_text: string | null
        }
        Insert: {
          access_token: string
          consent_marketing?: boolean | null
          consent_terms?: boolean | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          parsed_slots?: Json | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          size_category_id: string
          status?: string
          stylepack_id: string
          updated_at?: string
          user_images?: string[] | null
          user_text?: string | null
        }
        Update: {
          access_token?: string
          consent_marketing?: boolean | null
          consent_terms?: boolean | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          parsed_slots?: Json | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          size_category_id?: string
          status?: string
          stylepack_id?: string
          updated_at?: string
          user_images?: string[] | null
          user_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_size_category_id_fkey"
            columns: ["size_category_id"]
            isOneToOne: false
            referencedRelation: "size_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_stylepack_id_fkey"
            columns: ["stylepack_id"]
            isOneToOne: false
            referencedRelation: "stylepacks"
            referencedColumns: ["id"]
          },
        ]
      }
      rules_reality: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          message: string
          severity: string
          threshold_value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          message: string
          severity: string
          threshold_value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          message?: string
          severity?: string
          threshold_value?: string | null
        }
        Relationships: []
      }
      size_categories: {
        Row: {
          base_price_max: number
          base_price_min: number
          code: string
          created_at: string
          delivery_radius_miles: number | null
          id: string
          is_active: boolean
          lead_time_days: number
          name: string
          serving_max: number
          serving_min: number
          tiers_spec: Json
          updated_at: string
        }
        Insert: {
          base_price_max: number
          base_price_min: number
          code: string
          created_at?: string
          delivery_radius_miles?: number | null
          id?: string
          is_active?: boolean
          lead_time_days: number
          name: string
          serving_max: number
          serving_min: number
          tiers_spec: Json
          updated_at?: string
        }
        Update: {
          base_price_max?: number
          base_price_min?: number
          code?: string
          created_at?: string
          delivery_radius_miles?: number | null
          id?: string
          is_active?: boolean
          lead_time_days?: number
          name?: string
          serving_max?: number
          serving_min?: number
          tiers_spec?: Json
          updated_at?: string
        }
        Relationships: []
      }
      stylepack_ref_images: {
        Row: {
          created_at: string
          height: number | null
          id: string
          key: string
          mime: string
          size_bytes: number
          stylepack_id: string
          uploaded_by: string
          url: string
          width: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          key: string
          mime: string
          size_bytes: number
          stylepack_id: string
          uploaded_by: string
          url: string
          width?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          key?: string
          mime?: string
          size_bytes?: number
          stylepack_id?: string
          uploaded_by?: string
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stylepack_ref_images_stylepack_id_fkey"
            columns: ["stylepack_id"]
            isOneToOne: false
            referencedRelation: "stylepacks"
            referencedColumns: ["id"]
          },
        ]
      }
      stylepacks: {
        Row: {
          allowed_accents: string[] | null
          banned_terms: string[] | null
          complexity: number | null
          created_at: string
          description: string | null
          generator_provider: string | null
          id: string
          images: string[] | null
          is_active: boolean
          is_category: boolean
          lora_ref: string | null
          name: string
          palette_lock: number | null
          palette_range: Json | null
          parent_id: string | null
          performance_profile: string | null
          realism: number | null
          reference_stats: Json | null
          shape_template: string | null
          sharpness: number | null
          style_strength: number | null
          uniformity: number | null
          updated_at: string
        }
        Insert: {
          allowed_accents?: string[] | null
          banned_terms?: string[] | null
          complexity?: number | null
          created_at?: string
          description?: string | null
          generator_provider?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          is_category?: boolean
          lora_ref?: string | null
          name: string
          palette_lock?: number | null
          palette_range?: Json | null
          parent_id?: string | null
          performance_profile?: string | null
          realism?: number | null
          reference_stats?: Json | null
          shape_template?: string | null
          sharpness?: number | null
          style_strength?: number | null
          uniformity?: number | null
          updated_at?: string
        }
        Update: {
          allowed_accents?: string[] | null
          banned_terms?: string[] | null
          complexity?: number | null
          created_at?: string
          description?: string | null
          generator_provider?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          is_category?: boolean
          lora_ref?: string | null
          name?: string
          palette_lock?: number | null
          palette_range?: Json | null
          parent_id?: string | null
          performance_profile?: string | null
          realism?: number | null
          reference_stats?: Json | null
          shape_template?: string | null
          sharpness?: number | null
          style_strength?: number | null
          uniformity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylepacks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "stylepacks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
