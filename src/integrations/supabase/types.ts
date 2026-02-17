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
      bookings: {
        Row: {
          created_at: string
          discount_amount: number
          duration_hours: number
          end_time: string
          final_price: number
          hardware_triggered: boolean
          id: string
          original_price: number
          payment_id: string | null
          payment_method: string | null
          price: number
          promo_id: string | null
          start_time: string
          status: string
          table_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          duration_hours: number
          end_time: string
          final_price?: number
          hardware_triggered?: boolean
          id?: string
          original_price?: number
          payment_id?: string | null
          payment_method?: string | null
          price: number
          promo_id?: string | null
          start_time: string
          status?: string
          table_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          discount_amount?: number
          duration_hours?: number
          end_time?: string
          final_price?: number
          hardware_triggered?: boolean
          id?: string
          original_price?: number
          payment_id?: string | null
          payment_method?: string | null
          price?: number
          promo_id?: string | null
          start_time?: string
          status?: string
          table_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          applies_to_table_id: string | null
          applies_to_weekdays: string[]
          created_at: string
          end_time: string
          hourly_rate: number
          id: string
          is_active: boolean
          name: string
          priority: number
          specific_date: string | null
          start_time: string
        }
        Insert: {
          applies_to_table_id?: string | null
          applies_to_weekdays?: string[]
          created_at?: string
          end_time: string
          hourly_rate: number
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          specific_date?: string | null
          start_time: string
        }
        Update: {
          applies_to_table_id?: string | null
          applies_to_weekdays?: string[]
          created_at?: string
          end_time?: string
          hourly_rate?: number
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          specific_date?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_applies_to_table_id_fkey"
            columns: ["applies_to_table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_verified: boolean
          created_at: string
          date_of_birth: string | null
          email: string
          id: string
          name: string
          phone: string | null
          reward_points: number
          singpass_id: string | null
          singpass_verified: boolean
          total_spent: number
          user_id: string
          wallet_balance: number
        }
        Insert: {
          age_verified?: boolean
          created_at?: string
          date_of_birth?: string | null
          email: string
          id?: string
          name: string
          phone?: string | null
          reward_points?: number
          singpass_id?: string | null
          singpass_verified?: boolean
          total_spent?: number
          user_id: string
          wallet_balance?: number
        }
        Update: {
          age_verified?: boolean
          created_at?: string
          date_of_birth?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          reward_points?: number
          singpass_id?: string | null
          singpass_verified?: boolean
          total_spent?: number
          user_id?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          applies_to_table_id: string | null
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expiry_date: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          minimum_spend: number | null
          per_user_limit: number | null
          usage_limit: number | null
        }
        Insert: {
          applies_to_table_id?: string | null
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          minimum_spend?: number | null
          per_user_limit?: number | null
          usage_limit?: number | null
        }
        Update: {
          applies_to_table_id?: string | null
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          minimum_spend?: number | null
          per_user_limit?: number | null
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_applies_to_table_id_fkey"
            columns: ["applies_to_table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_usage: {
        Row: {
          booking_id: string
          created_at: string
          discount_amount: number
          id: string
          promo_id: string
          user_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          discount_amount: number
          id?: string
          promo_id: string
          user_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          discount_amount?: number
          id?: string
          promo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_usage_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_usage_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_transactions: {
        Row: {
          created_at: string
          id: string
          points: number
          related_booking_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          related_booking_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          related_booking_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_transactions_related_booking_id_fkey"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          created_at: string
          hardware_id: string | null
          hourly_rate: number | null
          id: string
          status: string
          table_number: number
          timer_started_at: string | null
        }
        Insert: {
          created_at?: string
          hardware_id?: string | null
          hourly_rate?: number | null
          id?: string
          status?: string
          table_number: number
          timer_started_at?: string | null
        }
        Update: {
          created_at?: string
          hardware_id?: string | null
          hourly_rate?: number | null
          id?: string
          status?: string
          table_number?: number
          timer_started_at?: string | null
        }
        Relationships: []
      }
      terms_conditions: {
        Row: {
          content: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      timer_sessions: {
        Row: {
          created_at: string
          duration_seconds: number
          ended_at: string
          hourly_rate: number
          id: string
          notes: string | null
          started_at: string
          table_id: string
          total_cost: number
        }
        Insert: {
          created_at?: string
          duration_seconds: number
          ended_at?: string
          hourly_rate: number
          id?: string
          notes?: string | null
          started_at: string
          table_id: string
          total_cost: number
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string
          hourly_rate?: number
          id?: string
          notes?: string | null
          started_at?: string
          table_id?: string
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "timer_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          related_booking_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          related_booking_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          related_booking_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_related_booking_id_fkey"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: "customer" | "admin"
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
      app_role: ["customer", "admin"],
    },
  },
} as const
