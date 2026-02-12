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
      activities: {
        Row: {
          booking_reference: string | null
          booking_url: string | null
          cost_currency: string | null
          cost_estimate: number | null
          created_at: string | null
          created_by: string | null
          day_id: string | null
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          image_url: string | null
          latitude: number | null
          location_address: string | null
          location_name: string | null
          longitude: number | null
          sort_order: number
          source: string
          start_time: string | null
          status: Database["public"]["Enums"]["activity_status"] | null
          title: string
          trip_id: string | null
          type: Database["public"]["Enums"]["activity_type"] | null
          updated_at: string | null
        }
        Insert: {
          booking_reference?: string | null
          booking_url?: string | null
          cost_currency?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          created_by?: string | null
          day_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          location_address?: string | null
          location_name?: string | null
          longitude?: number | null
          sort_order?: number
          source?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["activity_status"] | null
          title: string
          trip_id?: string | null
          type?: Database["public"]["Enums"]["activity_type"] | null
          updated_at?: string | null
        }
        Update: {
          booking_reference?: string | null
          booking_url?: string | null
          cost_currency?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          created_by?: string | null
          day_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          location_address?: string | null
          location_name?: string | null
          longitude?: number | null
          sort_order?: number
          source?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["activity_status"] | null
          title?: string
          trip_id?: string | null
          type?: Database["public"]["Enums"]["activity_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          trip_id: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          trip_id: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          trip_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          assigned_to: string | null
          checked_by: string | null
          checklist_id: string | null
          created_at: string | null
          id: string
          is_checked: boolean | null
          label: string
          sort_order: number | null
          source: string
        }
        Insert: {
          assigned_to?: string | null
          checked_by?: string | null
          checklist_id?: string | null
          created_at?: string | null
          id?: string
          is_checked?: boolean | null
          label: string
          sort_order?: number | null
          source?: string
        }
        Update: {
          assigned_to?: string | null
          checked_by?: string | null
          checklist_id?: string | null
          created_at?: string | null
          id?: string
          is_checked?: boolean | null
          label?: string
          sort_order?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          sort_order: number | null
          title: string
          trip_id: string | null
          type: Database["public"]["Enums"]["checklist_type"] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          sort_order?: number | null
          title: string
          trip_id?: string | null
          type?: Database["public"]["Enums"]["checklist_type"] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          sort_order?: number | null
          title?: string
          trip_id?: string | null
          type?: Database["public"]["Enums"]["checklist_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "checklists_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          activity_id: string | null
          body: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activity_id?: string | null
          body: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activity_id?: string | null
          body?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      days: {
        Row: {
          created_at: string | null
          date: string
          day_number: number
          id: string
          notes: string | null
          subtitle: string | null
          title: string | null
          trip_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          day_number: number
          id?: string
          notes?: string | null
          subtitle?: string | null
          title?: string | null
          trip_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          day_number?: number
          id?: string
          notes?: string | null
          subtitle?: string | null
          title?: string | null
          trip_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          from_member_id: string
          id: string
          method: string
          notes: string | null
          paid_at: string
          to_member_id: string
          trip_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          from_member_id: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          to_member_id: string
          trip_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          from_member_id?: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          to_member_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_payments_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_payments_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_splits: {
        Row: {
          amount: number
          created_at: string
          expense_id: string
          id: string
          member_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expense_id: string
          id?: string
          member_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expense_id?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          activity_id: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: string
          day_number: number | null
          expense_date: string | null
          id: string
          notes: string | null
          paid_by_member_id: string
          title: string
          total_amount: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          day_number?: number | null
          expense_date?: string | null
          id?: string
          notes?: string | null
          paid_by_member_id: string
          title: string
          total_amount: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          day_number?: number | null
          expense_date?: string | null
          id?: string
          notes?: string | null
          paid_by_member_id?: string
          title?: string
          total_amount?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_member_id_fkey"
            columns: ["paid_by_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          shared_action_metadata: Json | null
          shared_from_message_id: string | null
          trip_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          shared_action_metadata?: Json | null
          shared_from_message_id?: string | null
          trip_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          shared_action_metadata?: Json | null
          shared_from_message_id?: string | null
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_shared_from_message_id_fkey"
            columns: ["shared_from_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          avatar_color?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          avatar_color?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          activity_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_dismissed: boolean | null
          rating: number | null
          source_url: string | null
          suggested_by: string | null
          title: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_dismissed?: boolean | null
          rating?: number | null
          source_url?: string | null
          suggested_by?: string | null
          title: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_dismissed?: boolean | null
          rating?: number | null
          source_url?: string | null
          suggested_by?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          avatar_color: string | null
          display_name: string
          id: string
          joined_at: string | null
          last_active_at: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          trip_id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_color?: string | null
          display_name: string
          id?: string
          joined_at?: string | null
          last_active_at?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          trip_id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_color?: string | null
          display_name?: string
          id?: string
          joined_at?: string | null
          last_active_at?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          trip_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          invite_code: string
          name: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          invite_code: string
          name: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          invite_code?: string
          name?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      votes: {
        Row: {
          activity_id: string | null
          created_at: string | null
          id: string
          user_id: string | null
          vote_type: Database["public"]["Enums"]["vote_type"]
        }
        Insert: {
          activity_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
          vote_type: Database["public"]["Enums"]["vote_type"]
        }
        Update: {
          activity_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
          vote_type?: Database["public"]["Enums"]["vote_type"]
        }
        Relationships: [
          {
            foreignKeyName: "votes_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_trip_gaps: {
        Args: { p_trip_id: string }
        Returns: {
          day_id: string
          day_number: number
          gap_type: string
          message: string
        }[]
      }
      is_trip_editor: { Args: { p_trip_id: string }; Returns: boolean }
      is_trip_member: { Args: { p_trip_id: string }; Returns: boolean }
    }
    Enums: {
      activity_status: "confirmed" | "tentative" | "tbd"
      activity_type:
        | "flight"
        | "drive"
        | "hotel"
        | "restaurant"
        | "activity"
        | "sightseeing"
        | "shopping"
        | "rest"
        | "other"
      checklist_type: "packing" | "todo" | "shopping"
      expense_category:
        | "accommodation"
        | "food"
        | "transport"
        | "activities"
        | "fuel"
        | "parking"
        | "shopping"
        | "tips"
        | "other"
      user_role: "admin" | "editor" | "viewer"
      vote_type: "up" | "heart" | "fire" | "question"
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
      activity_status: ["confirmed", "tentative", "tbd"],
      activity_type: [
        "flight",
        "drive",
        "hotel",
        "restaurant",
        "activity",
        "sightseeing",
        "shopping",
        "rest",
        "other",
      ],
      checklist_type: ["packing", "todo", "shopping"],
      expense_category: [
        "accommodation",
        "food",
        "transport",
        "activities",
        "fuel",
        "parking",
        "shopping",
        "tips",
        "other",
      ],
      user_role: ["admin", "editor", "viewer"],
      vote_type: ["up", "heart", "fire", "question"],
    },
  },
} as const
