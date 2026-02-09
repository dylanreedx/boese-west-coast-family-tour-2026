export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          role: Database["public"]["Enums"]["user_role"] | null
          trip_id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_color?: string | null
          display_name: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          trip_id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_color?: string | null
          display_name?: string
          id?: string
          joined_at?: string | null
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
      user_role: "admin" | "editor" | "viewer"
      vote_type: "up" | "heart" | "fire" | "question"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof Database },
  TableName extends T extends { schema: keyof Database }
    ? keyof (Database[T["schema"]]["Tables"] & Database[T["schema"]]["Views"])
    : never = never
> = T extends { schema: keyof Database }
  ? (Database[T["schema"]]["Tables"] & Database[T["schema"]]["Views"])[TableName] extends { Row: infer R } ? R : never
  : T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never
    : never

export type TablesInsert<
  T extends keyof DefaultSchema["Tables"] | { schema: keyof Database },
  TableName extends T extends { schema: keyof Database }
    ? keyof Database[T["schema"]]["Tables"]
    : never = never
> = T extends { schema: keyof Database }
  ? Database[T["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never
  : T extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never
    : never

export type TablesUpdate<
  T extends keyof DefaultSchema["Tables"] | { schema: keyof Database },
  TableName extends T extends { schema: keyof Database }
    ? keyof Database[T["schema"]]["Tables"]
    : never = never
> = T extends { schema: keyof Database }
  ? Database[T["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never
  : T extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never
    : never

export type Enums<
  T extends keyof DefaultSchema["Enums"] | { schema: keyof Database },
  EnumName extends T extends { schema: keyof Database }
    ? keyof Database[T["schema"]]["Enums"]
    : never = never
> = T extends { schema: keyof Database }
  ? Database[T["schema"]]["Enums"][EnumName]
  : T extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][T]
    : never
