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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      generated_images: {
        Row: {
          attempt_number: number
          created_at: string
          error: string | null
          generation_ms: number | null
          id: string
          image_url: string | null
          label: string
          launch_id: string
          model_used: string | null
          original_url: string | null
          photo_angle: string
          preview_url: string | null
          prompt: string
          prompt_used: string | null
          raw_url: string | null
          status: string
          type: string
          upscaled: boolean
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          error?: string | null
          generation_ms?: number | null
          id?: string
          image_url?: string | null
          label: string
          launch_id: string
          model_used?: string | null
          original_url?: string | null
          photo_angle: string
          preview_url?: string | null
          prompt?: string
          prompt_used?: string | null
          raw_url?: string | null
          status?: string
          type: string
          upscaled?: boolean
        }
        Update: {
          attempt_number?: number
          created_at?: string
          error?: string | null
          generation_ms?: number | null
          id?: string
          image_url?: string | null
          label?: string
          launch_id?: string
          model_used?: string | null
          original_url?: string | null
          photo_angle?: string
          preview_url?: string | null
          prompt?: string
          prompt_used?: string | null
          raw_url?: string | null
          status?: string
          type?: string
          upscaled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "generated_images_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "weekly_launches"
            referencedColumns: ["id"]
          },
        ]
      }
      model_profiles: {
        Row: {
          bust_cm: number | null
          created_at: string
          display_name: string
          face_image_url: string | null
          facial_features: string | null
          guidance_scale: number | null
          hair_description: string | null
          height_cm: number | null
          hip_cm: number | null
          id: string
          lora_scale: number | null
          lora_trigger_word: string | null
          lora_url: string | null
          prompt_seed: string
          skin_tone: string | null
          slug: string
          updated_at: string
          waist_cm: number | null
        }
        Insert: {
          bust_cm?: number | null
          created_at?: string
          display_name: string
          face_image_url?: string | null
          facial_features?: string | null
          guidance_scale?: number | null
          hair_description?: string | null
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          lora_scale?: number | null
          lora_trigger_word?: string | null
          lora_url?: string | null
          prompt_seed: string
          skin_tone?: string | null
          slug: string
          updated_at?: string
          waist_cm?: number | null
        }
        Update: {
          bust_cm?: number | null
          created_at?: string
          display_name?: string
          face_image_url?: string | null
          facial_features?: string | null
          guidance_scale?: number | null
          hair_description?: string | null
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          lora_scale?: number | null
          lora_trigger_word?: string | null
          lora_url?: string | null
          prompt_seed?: string
          skin_tone?: string | null
          slug?: string
          updated_at?: string
          waist_cm?: number | null
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          analysis_raw: string | null
          color_name: string
          combo_piece_role: string | null
          created_at: string
          fabric_texture: string | null
          garment_analysis: Json | null
          garment_length: string | null
          garment_length_cm: number | null
          garment_type: string | null
          hem_below_knee_cm: number | null
          id: string
          product_id: string
          proportion_json: Json | null
          reference_photos_bottom: string[] | null
          reference_photos_top: string[] | null
          shoulder_width_cm: number | null
          sleeve_length_cm: number | null
          sleeve_type: string | null
          sort_order: number
          tr_badge_location: string | null
          uploaded_images: string[] | null
          waist_position_cm: number | null
        }
        Insert: {
          analysis_raw?: string | null
          color_name?: string
          combo_piece_role?: string | null
          created_at?: string
          fabric_texture?: string | null
          garment_analysis?: Json | null
          garment_length?: string | null
          garment_length_cm?: number | null
          garment_type?: string | null
          hem_below_knee_cm?: number | null
          id?: string
          product_id: string
          proportion_json?: Json | null
          reference_photos_bottom?: string[] | null
          reference_photos_top?: string[] | null
          shoulder_width_cm?: number | null
          sleeve_length_cm?: number | null
          sleeve_type?: string | null
          sort_order?: number
          tr_badge_location?: string | null
          uploaded_images?: string[] | null
          waist_position_cm?: number | null
        }
        Update: {
          analysis_raw?: string | null
          color_name?: string
          combo_piece_role?: string | null
          created_at?: string
          fabric_texture?: string | null
          garment_analysis?: Json | null
          garment_length?: string | null
          garment_length_cm?: number | null
          garment_type?: string | null
          hem_below_knee_cm?: number | null
          id?: string
          product_id?: string
          proportion_json?: Json | null
          reference_photos_bottom?: string[] | null
          reference_photos_top?: string[] | null
          shoulder_width_cm?: number | null
          sleeve_length_cm?: number | null
          sleeve_type?: string | null
          sort_order?: number
          tr_badge_location?: string | null
          uploaded_images?: string[] | null
          waist_position_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          featured_piece: string | null
          garment_analysis: Json | null
          id: string
          is_combo: boolean
          mannequin_arm_cm: number | null
          mannequin_bust_cm: number | null
          mannequin_height_cm: number | null
          mannequin_hip_cm: number | null
          mannequin_torso_cm: number | null
          mannequin_waist_cm: number | null
          manual_prompt: string | null
          model_profile: Json | null
          name: string
          reference_photos: string[] | null
          selected_presets: Json | null
          updated_at: string
          uploaded_images: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          featured_piece?: string | null
          garment_analysis?: Json | null
          id?: string
          is_combo?: boolean
          mannequin_arm_cm?: number | null
          mannequin_bust_cm?: number | null
          mannequin_height_cm?: number | null
          mannequin_hip_cm?: number | null
          mannequin_torso_cm?: number | null
          mannequin_waist_cm?: number | null
          manual_prompt?: string | null
          model_profile?: Json | null
          name: string
          reference_photos?: string[] | null
          selected_presets?: Json | null
          updated_at?: string
          uploaded_images?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          featured_piece?: string | null
          garment_analysis?: Json | null
          id?: string
          is_combo?: boolean
          mannequin_arm_cm?: number | null
          mannequin_bust_cm?: number | null
          mannequin_height_cm?: number | null
          mannequin_hip_cm?: number | null
          mannequin_torso_cm?: number | null
          mannequin_waist_cm?: number | null
          manual_prompt?: string | null
          model_profile?: Json | null
          name?: string
          reference_photos?: string[] | null
          selected_presets?: Json | null
          updated_at?: string
          uploaded_images?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_launches: {
        Row: {
          created_at: string
          engine_used: string
          id: string
          label: string
          mannequin_arm_cm: number | null
          mannequin_bust_cm: number | null
          mannequin_height_cm: number | null
          mannequin_hip_cm: number | null
          mannequin_torso_cm: number | null
          mannequin_waist_cm: number | null
          product_id: string
          reference_photos: string[] | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          engine_used?: string
          id?: string
          label: string
          mannequin_arm_cm?: number | null
          mannequin_bust_cm?: number | null
          mannequin_height_cm?: number | null
          mannequin_hip_cm?: number | null
          mannequin_torso_cm?: number | null
          mannequin_waist_cm?: number | null
          product_id: string
          reference_photos?: string[] | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          engine_used?: string
          id?: string
          label?: string
          mannequin_arm_cm?: number | null
          mannequin_bust_cm?: number | null
          mannequin_height_cm?: number | null
          mannequin_hip_cm?: number | null
          mannequin_torso_cm?: number | null
          mannequin_waist_cm?: number | null
          product_id?: string
          reference_photos?: string[] | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_launches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_launches_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
