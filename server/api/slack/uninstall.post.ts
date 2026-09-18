/**
 * POST /api/slack/uninstall
 * 
 * Slack Workspaceとの連携を解除する
 * Slack側のアプリをアンインストール
 * slack2mailのslack_workspacesからレコードを削除
 * 
 */
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '~/types/database.types'

export default defineEventHandler(async (event) => {
    const { tenantId } = await readBody(event)

    const client = await serverSupabaseClient<Database>(event)
    const { data: isMember, error: memberError } = await client
        .rpc('is_member_of_tenant', { check_tenant_id: tenantId })
    if (memberError || !isMember) {
        throw createError({ statusCode: 403, message: 'not found' })
    }

    const { data: workspace, error } = await client.from('slack_workspaces').select().eq('tenant_id', tenantId).maybeSingle()
    if (error) {
        throw createError({ statusCode: 400, message: 'not found' })
    }

    if (!!workspace) {
        const res = await $fetch<{ ok: boolean; error?: string }>('https://slack.com/api/apps.uninstall', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${workspace.bot_token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: process.env.NUXT_SLACK_CLIENT_ID!,
                client_secret: process.env.NUXT_SLACK_CLIENT_SECRET!,
            }),
        })

        if (!res.ok) {
            throw createError({ statusCode: 500, message: res.error })
        } else {
            await client.from('slack_workspaces').delete().eq('tenant_id', tenantId)
        }
    }

    return { success: true }
})