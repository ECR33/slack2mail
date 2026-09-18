import type { DateTime } from "luxon"
import type { UUID } from "ulid"
import type { Database } from "~/types/database.types"

export type EventFilterRow = {
    id: number
    event_name_id: number
    column_name: string
    column_value: string
    event_email_addr: string
}

export type EventFilter = {
    // event_name: string
    column_name: string
    column_values: string[]
}

export type Slack2mailEnv = {
    appHost: string
    slackAppId: string
    slackClientId: string
    slackClientSecret: string
    slackSigningSecret: string
    slackVerificationToken: string
    slackOauthTokens: string
    viteAllowedHost: string
    supabaseProjectUrl: string
    supabasePublishableKey: string
    supabaseServiceRole: string
    googleClientId: string
    googleClientSecret: string
    public: {
        appUrl: string
        supabaseUrl: string
        supabaseKey: string
    }
}

// tenant
export type Tenant = Database['public']['Tables']['tenants']['Row']

// tenant_users
export type TenantUsers = Database['public']['Tables']['tenant_users']['Row']

// mail_server
export type MailServer = Database['public']['Tables']['mail_server']['Row']
export type MailServerConfig = Database['public']['Tables']['mail_server']['Insert']

// mail_account
export type MailAccount = Database['public']['Tables']['mail_account']['Row']
export type MailAccountInsert = Database['public']['Tables']['mail_account']['Insert']

// event_config
export type EventConfig = Database['public']['Tables']['event_config']['Row']

// event_data
export type EventData = Database['public']['Tables']['event_data']['Row']

// sent_emails
export type SentEmail = Database['public']['Tables']['sent_emails']['Row']
export type SentEmailInsert = Database['public']['Tables']['sent_emails']['Insert']

// members_sheet_config
export type MembersSheetConfig = Database['public']['Tables']['members_sheet_config']['Row']

// email
export type EmailInsert = Database['public']['Tables']['emails']['Insert']
export type EmailUpdate = Database['public']['Tables']['emails']['Update']
export type Email = Database['public']['Tables']['emails']['Row']

// Slack Workspace
export type SlackWorkspace = Database['public']['Tables']['slack_workspaces']['Row']