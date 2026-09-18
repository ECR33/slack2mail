/**
 * POST /api/sync-eventconfig
 * 
 * イベント設定を読み込む
 * 
 */
import { google } from 'googleapis'
import { serverSupabaseUser, serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createGoogleAuth } from '#shared/utils/googleapi'
import type { Database } from '~/types/database.types'

export default defineEventHandler(async event => {

    const { tenantId } = await readBody(event)
    const user = await serverSupabaseUser(event)
    if (!user) throw createError({ statusCode: 401 })

    const adminClient = serverSupabaseServiceRole<Database>(event)
    const { data: credentialJson, error: credErr } = await adminClient.rpc('get_tenant_google_credential', { p_tenant_id: tenantId })
    if (credErr || !credentialJson) {
        console.error('Google Service Accountが未設定です', credErr, credentialJson, tenantId)
        throw createError({ statusCode: 400, message: 'Google Service Accountが未設定です' })
    }

    const auth = await createGoogleAuth(credentialJson)
    const sheets = google.sheets({ version: 'v4', auth })

    const userClient = await serverSupabaseClient(event)

    const { data: config, error } = await userClient.from('slack2mail_sheet_config').select().eq('tenant_id', tenantId).single()
    if (error) {
        console.error('slack2mail_sheet_config error:', error)
        throw createError({ statusCode: 403, message: error.message })
    }
    if (config.sheet_id == null) {
        console.error('slack2mail_sheet_config is null')
        throw createError({ statusCode: 403, message: 'slack2mail_sheet_config is null' })
    }
    const eventConfigs = await getSlack2mailConfig(config.sheet_id, sheets)

    const { error: configErr } = await userClient.rpc('sync_event_configs', {
        p_tenant_id: tenantId,
        p_configs: eventConfigs
    })

    return eventConfigs

})