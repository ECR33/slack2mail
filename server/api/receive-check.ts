/**
 * GET /receive-check
 * 
 * メール受診者がメール本文のリンクをクリックして呼び出す
 * メールが受信確認されたことを更新する
 */
import { WebClient } from '@slack/web-api'
import { Database } from '~/types/database.types.ts'
import { serverSupabaseServiceRole } from '#supabase/server'
import { getSlackOauthTokenByTenantId } from '#shared/utils/slack.ts'
import { getNumberOfReceived, getTenantInfoByTenantId, updateNumberOfReceived, updateReceiveStatusToReceived } from '#shared/utils/supabase.ts'

export default defineEventHandler(async event => {
    const query = getQuery(event)
    const trackingToken = query.id as string

    const supabase = serverSupabaseServiceRole<Database>(event)

    try {
        // 受信済に更新
        const sentEmail = await updateReceiveStatusToReceived(trackingToken, supabase)
        // テナント情報取得
        const tenant = await getTenantInfoByTenantId(sentEmail.tenant_id, supabase)
        // 受信済件数取得
        const count = await getNumberOfReceived(sentEmail.email_id, supabase)
        const statusData = await updateNumberOfReceived(sentEmail.email_id, count, supabase)

        // Slack Chat 書き込み (受信確認数更新)
        const content = getSlackChatMessage(statusData)
        const slackOauthToken = await getSlackOauthTokenByTenantId(sentEmail.tenant_id, supabase)
        const web = new WebClient(slackOauthToken)
        const result = await web.chat.update(content)
        return {
            result: true,
            ...tenant
        }
    } catch (error) {
        if (error) {
            console.error(error)
            return { result: false, brand_name: '', brand_icon_url: '' }
        }
    }
})