export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      emails: {
        Row: {
          aborted_at: string | null
          aborted_by: string | null
          approval_border: number
          approval_channel: string
          approval_count: number
          approval_thread_ts: string
          approved_by: string[] | null
          attachments: string[] | null
          body: string | null
          created_at: string
          created_by: string | null
          edited_at: string | null
          edited_by: string | null
          email_id: string
          event_filter: Json | null
          event_name: string | null
          mail_account_id: string | null
          mail_account_name: string | null
          num_of_received: number | null
          num_of_sent: number | null
          num_of_target: number | null
          schedule: string | null
          sent_at: string | null
          status: string
          subject: string | null
          team_id: string | null
          tenant_id: string
        }
        Insert: {
          aborted_at?: string | null
          aborted_by?: string | null
          approval_border?: number
          approval_channel: string
          approval_count?: number
          approval_thread_ts: string
          approved_by?: string[] | null
          attachments?: string[] | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          edited_at?: string | null
          edited_by?: string | null
          email_id: string
          event_filter?: Json | null
          event_name?: string | null
          mail_account_id?: string | null
          mail_account_name?: string | null
          num_of_received?: number | null
          num_of_sent?: number | null
          num_of_target?: number | null
          schedule?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          team_id?: string | null
          tenant_id: string
        }
        Update: {
          aborted_at?: string | null
          aborted_by?: string | null
          approval_border?: number
          approval_channel?: string
          approval_count?: number
          approval_thread_ts?: string
          approved_by?: string[] | null
          attachments?: string[] | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          edited_at?: string | null
          edited_by?: string | null
          email_id?: string
          event_filter?: Json | null
          event_name?: string | null
          mail_account_id?: string | null
          mail_account_name?: string | null
          num_of_received?: number | null
          num_of_sent?: number | null
          num_of_target?: number | null
          schedule?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          team_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      event_config: {
        Row: {
          email_column: string | null
          embeded_columns: Json | null
          event_name: string
          filter_columns: Json | null
          header: number | null
          id_column: string | null
          include_flg_column_name: string | null
          include_flg_column_values: Json | null
          sender_email_addr: string | null
          sender_name: string | null
          sheet_id: string | null
          sheet_name: string | null
          tenant_id: string
        }
        Insert: {
          email_column?: string | null
          embeded_columns?: Json | null
          event_name: string
          filter_columns?: Json | null
          header?: number | null
          id_column?: string | null
          include_flg_column_name?: string | null
          include_flg_column_values?: Json | null
          sender_email_addr?: string | null
          sender_name?: string | null
          sheet_id?: string | null
          sheet_name?: string | null
          tenant_id: string
        }
        Update: {
          email_column?: string | null
          embeded_columns?: Json | null
          event_name?: string
          filter_columns?: Json | null
          header?: number | null
          id_column?: string | null
          include_flg_column_name?: string | null
          include_flg_column_values?: Json | null
          sender_email_addr?: string | null
          sender_name?: string | null
          sheet_id?: string | null
          sheet_name?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      event_data: {
        Row: {
          data_id: string
          email_addr: string | null
          embeded_values: Json | null
          event_attr: Json | null
          event_name: string
          id: number
          numerical_data_id: number | null
          tenant_id: string
        }
        Insert: {
          data_id: string
          email_addr?: string | null
          embeded_values?: Json | null
          event_attr?: Json | null
          event_name: string
          id?: number
          numerical_data_id?: number | null
          tenant_id: string
        }
        Update: {
          data_id?: string
          email_addr?: string | null
          embeded_values?: Json | null
          event_attr?: Json | null
          event_name?: string
          id?: number
          numerical_data_id?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_data_tenant_id_event_name_fkey"
            columns: ["tenant_id", "event_name"]
            isOneToOne: false
            referencedRelation: "event_config"
            referencedColumns: ["tenant_id", "event_name"]
          },
          {
            foreignKeyName: "event_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      mail_account: {
        Row: {
          default: boolean
          description: string | null
          email_addr: string | null
          id: string
          name: string | null
          password: string | null
          tenant_id: string
        }
        Insert: {
          default?: boolean
          description?: string | null
          email_addr?: string | null
          id?: string
          name?: string | null
          password?: string | null
          tenant_id: string
        }
        Update: {
          default?: boolean
          description?: string | null
          email_addr?: string | null
          id?: string
          name?: string | null
          password?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_account_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      mail_server: {
        Row: {
          available: boolean | null
          description: string | null
          id: string
          imap_port: number | null
          imap_secure: boolean | null
          imap_server: string | null
          name: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_server: string | null
          tenant_id: string
        }
        Insert: {
          available?: boolean | null
          description?: string | null
          id?: string
          imap_port?: number | null
          imap_secure?: boolean | null
          imap_server?: string | null
          name?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_server?: string | null
          tenant_id: string
        }
        Update: {
          available?: boolean | null
          description?: string | null
          id?: string
          imap_port?: number | null
          imap_secure?: boolean | null
          imap_server?: string | null
          name?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_server?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_server_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      members_sheet_config: {
        Row: {
          created_at: string
          created_by: string | null
          email_column_name: string | null
          filter_column_name: string | null
          filter_column_values: Json | null
          id: string
          name_column_name: string | null
          sheet_id: string | null
          sheet_name: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email_column_name?: string | null
          filter_column_name?: string | null
          filter_column_values?: Json | null
          id?: string
          name_column_name?: string | null
          sheet_id?: string | null
          sheet_name?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email_column_name?: string | null
          filter_column_name?: string | null
          filter_column_values?: Json | null
          id?: string
          name_column_name?: string | null
          sheet_id?: string | null
          sheet_name?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_sheet_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      reserved_slugs: {
        Row: {
          slug: string
        }
        Insert: {
          slug: string
        }
        Update: {
          slug?: string
        }
        Relationships: []
      }
      sent_emails: {
        Row: {
          email_id: string
          embeded_values: Json | null
          event_email_addr: string | null
          imap_written_at: string | null
          message_id: string | null
          receive_checked_at: string | null
          received: boolean
          sending_at: string | null
          sent_at: string | null
          status: string
          tenant_id: string
          tracking_token: string
        }
        Insert: {
          email_id: string
          embeded_values?: Json | null
          event_email_addr?: string | null
          imap_written_at?: string | null
          message_id?: string | null
          receive_checked_at?: string | null
          received?: boolean
          sending_at?: string | null
          sent_at?: string | null
          status?: string
          tenant_id: string
          tracking_token: string
        }
        Update: {
          email_id?: string
          embeded_values?: Json | null
          event_email_addr?: string | null
          imap_written_at?: string | null
          message_id?: string | null
          receive_checked_at?: string | null
          received?: boolean
          sending_at?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          tracking_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["email_id"]
          },
          {
            foreignKeyName: "sent_emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      slack_workspaces: {
        Row: {
          bot_token: string | null
          bot_user_id: string | null
          created_at: string
          enterprise_id: string | null
          id: string
          installed_at: string | null
          installed_user_id: string | null
          team_id: string
          team_name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bot_token?: string | null
          bot_user_id?: string | null
          created_at?: string
          enterprise_id?: string | null
          id?: string
          installed_at?: string | null
          installed_user_id?: string | null
          team_id: string
          team_name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bot_token?: string | null
          bot_user_id?: string | null
          created_at?: string
          enterprise_id?: string | null
          id?: string
          installed_at?: string | null
          installed_user_id?: string | null
          team_id?: string
          team_name?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_workspaces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      slack2mail_sheet_config: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          sheet_id: string | null
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          sheet_id?: string | null
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          sheet_id?: string | null
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slack2mail_sheet_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_google_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          private_key_id: string | null
          secret_id: string
          service_account_email: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          private_key_id?: string | null
          secret_id: string
          service_account_email?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          private_key_id?: string | null
          secret_id?: string
          service_account_email?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_google_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          created_by: string | null
          email_addr: string
          id: string
          name: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email_addr: string
          id?: string
          name?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email_addr?: string
          id?: string
          name?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenants: {
        Row: {
          brand_icon_url: string | null
          brand_name: string | null
          created_at: string
          name: string
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          brand_icon_url?: string | null
          brand_name?: string | null
          created_at?: string
          name: string
          slug: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          brand_icon_url?: string | null
          brand_name?: string | null
          created_at?: string
          name?: string
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_slug_available: {
        Args: { p_slug: string; p_tenant_id?: string }
        Returns: Json
      }
      claim_and_expand_email_targets: {
        Args: {
          p_email_id: string
          p_event_name: string
          p_filter?: Json
          p_tenant_id: string
        }
        Returns: Json
      }
      claim_pending_sent_targets: {
        Args: { p_email_id: string; p_tenant_id: string }
        Returns: {
          email_id: string
          embeded_values: Json | null
          event_email_addr: string | null
          imap_written_at: string | null
          message_id: string | null
          receive_checked_at: string | null
          received: boolean
          sending_at: string | null
          sent_at: string | null
          status: string
          tenant_id: string
          tracking_token: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sent_emails"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      delete_tenant_google_credential: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      get_event_filters: {
        Args: {
          p_event_name?: string
          p_team_id?: string
          p_tenant_id?: string
        }
        Returns: Json
      }
      get_event_names: {
        Args: { p_team_id?: string; p_tenant_id?: string }
        Returns: Json
      }
      get_tenant_google_credential: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      is_member_of_tenant: {
        Args: { check_tenant_id: string }
        Returns: boolean
      }
      link_my_tenant_user: { Args: never; Returns: undefined }
      randomize_emails: { Args: never; Returns: undefined }
      sync_event_configs: {
        Args: { p_configs: Json; p_tenant_id: string }
        Returns: {
          action: string
          event_name: string
        }[]
      }
      sync_event_data: {
        Args: { p_event_name: string; p_rows: Json; p_tenant_id: string }
        Returns: {
          action: string
          data_id: string
        }[]
      }
      sync_tenant_members: {
        Args: { p_members: Json; p_tenant_id: string }
        Returns: {
          action: string
          email_addr: string
        }[]
      }
      upsert_slack_workspace: {
        Args: {
          p_bot_token: string
          p_bot_user_id?: string
          p_enterprise_id?: string
          p_installed_user_id: string
          p_team_id: string
          p_team_name: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      upsert_tenant_google_credential: {
        Args: { p_service_account_json: Json; p_tenant_id: string }
        Returns: undefined
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

