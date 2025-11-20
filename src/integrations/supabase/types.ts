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
          engine: string | null
          generator_request: Json | null
          generator_response: Json | null
          id: string
          image_url: string
          is_selected: boolean | null
          payload: Json | null
          price_range_max: number
          price_range_min: number
          rank_score: number | null
          request_id: string
          scores: Json | null
          seed: number | null
          seed_class: number | null
          spec_json: Json
          stage: number | null
          variant: string
        }
        Insert: {
          badges?: string[] | null
          created_at?: string
          engine?: string | null
          generator_request?: Json | null
          generator_response?: Json | null
          id?: string
          image_url: string
          is_selected?: boolean | null
          payload?: Json | null
          price_range_max: number
          price_range_min: number
          rank_score?: number | null
          request_id: string
          scores?: Json | null
          seed?: number | null
          seed_class?: number | null
          spec_json: Json
          stage?: number | null
          variant: string
        }
        Update: {
          badges?: string[] | null
          created_at?: string
          engine?: string | null
          generator_request?: Json | null
          generator_response?: Json | null
          id?: string
          image_url?: string
          is_selected?: boolean | null
          payload?: Json | null
          price_range_max?: number
          price_range_min?: number
          rank_score?: number | null
          request_id?: string
          scores?: Json | null
          seed?: number | null
          seed_class?: number | null
          spec_json?: Json
          stage?: number | null
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
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          customer_notes: string | null
          id: string
          parsed_slots: Json | null
          payment_amount: number | null
          payment_provider: string | null
          payment_reference: string | null
          payment_status: string
          qbo_estimate_id: string | null
          qbo_estimate_url: string | null
          qbo_sync_status: string | null
          selected_proposal_id: string | null
          size_category_id: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_status: string | null
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
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_notes?: string | null
          id?: string
          parsed_slots?: Json | null
          payment_amount?: number | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          qbo_estimate_id?: string | null
          qbo_estimate_url?: string | null
          qbo_sync_status?: string | null
          selected_proposal_id?: string | null
          size_category_id: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_status?: string | null
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
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_notes?: string | null
          id?: string
          parsed_slots?: Json | null
          payment_amount?: number | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          qbo_estimate_id?: string | null
          qbo_estimate_url?: string | null
          qbo_sync_status?: string | null
          selected_proposal_id?: string | null
          size_category_id?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_status?: string | null
          stylepack_id?: string
          updated_at?: string
          user_images?: string[] | null
          user_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_selected_proposal_id_fkey"
            columns: ["selected_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
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
      stage1_cache: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          result: Json
          size_category_id: string
          stylepack_id: string
          user_text_hash: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          result: Json
          size_category_id: string
          stylepack_id: string
          user_text_hash: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          result?: Json
          size_category_id?: string
          stylepack_id?: string
          user_text_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage1_cache_size_category_id_fkey"
            columns: ["size_category_id"]
            isOneToOne: false
            referencedRelation: "size_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage1_cache_stylepack_id_fkey"
            columns: ["stylepack_id"]
            isOneToOne: false
            referencedRelation: "stylepacks"
            referencedColumns: ["id"]
          },
        ]
      }
      stylepack_ref_images: {
        Row: {
          created_at: string
          density: string | null
          embedding: string | null
          height: number | null
          id: string
          key: string
          mask_thumbnail_path: string | null
          meta: Json | null
          mime: string
          palette: Json | null
          size_bytes: number
          stylepack_id: string
          texture_tags: string[] | null
          uploaded_by: string | null
          url: string
          width: number | null
        }
        Insert: {
          created_at?: string
          density?: string | null
          embedding?: string | null
          height?: number | null
          id?: string
          key: string
          mask_thumbnail_path?: string | null
          meta?: Json | null
          mime: string
          palette?: Json | null
          size_bytes: number
          stylepack_id: string
          texture_tags?: string[] | null
          uploaded_by?: string | null
          url: string
          width?: number | null
        }
        Update: {
          created_at?: string
          density?: string | null
          embedding?: string | null
          height?: number | null
          id?: string
          key?: string
          mask_thumbnail_path?: string | null
          meta?: Json | null
          mime?: string
          palette?: Json | null
          size_bytes?: number
          stylepack_id?: string
          texture_tags?: string[] | null
          uploaded_by?: string | null
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
          fitness_scores: Json | null
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
          ref_image_count: number | null
          reference_stats: Json | null
          shape_template: string | null
          sharpness: number | null
          style_strength: number | null
          trend_keywords: string[] | null
          trend_techniques: string[] | null
          uniformity: number | null
          updated_at: string
        }
        Insert: {
          allowed_accents?: string[] | null
          banned_terms?: string[] | null
          complexity?: number | null
          created_at?: string
          description?: string | null
          fitness_scores?: Json | null
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
          ref_image_count?: number | null
          reference_stats?: Json | null
          shape_template?: string | null
          sharpness?: number | null
          style_strength?: number | null
          trend_keywords?: string[] | null
          trend_techniques?: string[] | null
          uniformity?: number | null
          updated_at?: string
        }
        Update: {
          allowed_accents?: string[] | null
          banned_terms?: string[] | null
          complexity?: number | null
          created_at?: string
          description?: string | null
          fitness_scores?: Json | null
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
          ref_image_count?: number | null
          reference_stats?: Json | null
          shape_template?: string | null
          sharpness?: number | null
          style_strength?: number | null
          trend_keywords?: string[] | null
          trend_techniques?: string[] | null
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
      trend_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          source_type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          source_type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          source_type?: string | null
        }
        Relationships: []
      }
      trend_image_stylepack_mappings: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          stylepack_id: string | null
          trend_image_id: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          stylepack_id?: string | null
          trend_image_id?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          stylepack_id?: string | null
          trend_image_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_image_stylepack_mappings_stylepack_id_fkey"
            columns: ["stylepack_id"]
            isOneToOne: false
            referencedRelation: "stylepacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_image_stylepack_mappings_trend_image_id_fkey"
            columns: ["trend_image_id"]
            isOneToOne: false
            referencedRelation: "trend_images"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_images: {
        Row: {
          approved_for_stylepack_id: string | null
          attribution_required: boolean | null
          attribution_text: string | null
          caption: string | null
          category_suggestions: Json | null
          copyright_notes: string | null
          copyright_status: string | null
          created_at: string | null
          density: string | null
          embedding: string | null
          engagement_score: number | null
          id: string
          image_path: string
          is_approved: boolean | null
          original_url: string | null
          palette: Json | null
          posted_at: string | null
          source_id: string | null
          texture_tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          approved_for_stylepack_id?: string | null
          attribution_required?: boolean | null
          attribution_text?: string | null
          caption?: string | null
          category_suggestions?: Json | null
          copyright_notes?: string | null
          copyright_status?: string | null
          created_at?: string | null
          density?: string | null
          embedding?: string | null
          engagement_score?: number | null
          id?: string
          image_path: string
          is_approved?: boolean | null
          original_url?: string | null
          palette?: Json | null
          posted_at?: string | null
          source_id?: string | null
          texture_tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          approved_for_stylepack_id?: string | null
          attribution_required?: boolean | null
          attribution_text?: string | null
          caption?: string | null
          category_suggestions?: Json | null
          copyright_notes?: string | null
          copyright_status?: string | null
          created_at?: string | null
          density?: string | null
          embedding?: string | null
          engagement_score?: number | null
          id?: string
          image_path?: string
          is_approved?: boolean | null
          original_url?: string | null
          palette?: Json | null
          posted_at?: string | null
          source_id?: string | null
          texture_tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_images_approved_for_stylepack_id_fkey"
            columns: ["approved_for_stylepack_id"]
            isOneToOne: false
            referencedRelation: "stylepacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_images_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "trend_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_keywords: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          keyword: string
          palette_preset: Json | null
          popularity_score: number | null
          related_keywords: Json | null
          trend_period: unknown
          visual_examples: Json | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          keyword: string
          palette_preset?: Json | null
          popularity_score?: number | null
          related_keywords?: Json | null
          trend_period?: unknown
          visual_examples?: Json | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          keyword?: string
          palette_preset?: Json | null
          popularity_score?: number | null
          related_keywords?: Json | null
          trend_period?: unknown
          visual_examples?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_keywords_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "trend_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_sources: {
        Row: {
          account_handle: string | null
          created_at: string | null
          credibility_score: number | null
          follower_count: number | null
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          name: string
          notes: string | null
          platform: string | null
        }
        Insert: {
          account_handle?: string | null
          created_at?: string | null
          credibility_score?: number | null
          follower_count?: number | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          name: string
          notes?: string | null
          platform?: string | null
        }
        Update: {
          account_handle?: string | null
          created_at?: string | null
          credibility_score?: number | null
          follower_count?: number | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          name?: string
          notes?: string | null
          platform?: string | null
        }
        Relationships: []
      }
      trend_stylepack_mappings: {
        Row: {
          created_at: string | null
          id: string
          relevance_score: number | null
          stylepack_id: string | null
          trend_keyword_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          relevance_score?: number | null
          stylepack_id?: string | null
          trend_keyword_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          relevance_score?: number | null
          stylepack_id?: string | null
          trend_keyword_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_stylepack_mappings_stylepack_id_fkey"
            columns: ["stylepack_id"]
            isOneToOne: false
            referencedRelation: "stylepacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_stylepack_mappings_trend_keyword_id_fkey"
            columns: ["trend_keyword_id"]
            isOneToOne: false
            referencedRelation: "trend_keywords"
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
      match_stylepacks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          id: string
          name: string
          similarity: number
        }[]
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
