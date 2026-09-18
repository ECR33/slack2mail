/**
 * POST /api/sync-tenant-members
 * 
 * テナントのメンバーを読み込む
 * 
 */
import { google } from 'googleapis'
import { serverSupabaseUser, serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createGoogleAuth } from '#shared/utils/googleapi.ts'
import { readMembersSheet } from '#shared/utils/index'
import type { Database } from '~/types/database.types.ts'

export default defineEventHandler(async event => {
    const { tenantId } = await readBody(event)
    const user = await serverSupabaseUser(event)
    if (!user) throw createError({ statusCode: 401 })

    const adminClient = serverSupabaseServiceRole<Database>(event)
    const { data: credentialJson, error: credErr } = await adminClient.rpc('get_tenant_google_credential', { p_tenant_id: tenantId })
    if (credErr || !credentialJson) {
        throw createError({ statusCode: 400, message: 'Google Service Accountが未設定です' })
    }

    const auth = await createGoogleAuth(credentialJson)
    const sheets = google.sheets({ version: 'v4', auth })

    const userClient = await serverSupabaseClient(event)

    const { data: config, error } = await userClient.from('members_sheet_config').select().eq('tenant_id', tenantId).single()
    if (error) {
        console.error('sync-tenant-members: members_sheet_config error:', error)
        throw createError({ statusCode: 403, message: error.message })
    }

    const members = await readMembersSheet(config, sheets)

    const { data, error: syncError } = await userClient.rpc('sync_tenant_members', {
        p_tenant_id: tenantId,
        p_members: members
    })

    if (syncError) throw createError({ statusCode: 403, message: syncError.message })

    return data
})