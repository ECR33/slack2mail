/**
 * POST /api/get-tenant-members
 * 
 * テナントに所属しているユーザの一覧を取得する
 */
import { Database } from '~/types/database.types.ts'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async event => {
    const { tenantId } = await readBody(event)
    const user = await serverSupabaseUser(event)
    if (!user) throw createError({ statusCode: 401 })

    const adminClient = serverSupabaseServiceRole<Database>(event)
    const { data, error } = await adminClient.from('tenant_users').select().eq('tenant_id', tenantId).order('name')
    if (error) {
        console.error('get tenant members error:', error)
        throw createError({ statusCode: 403, message: error.message })
    }
    return data
})