// メッセージを再投稿する
// 再投稿することによりSlack上の表示形式を新しい形式に変更する

import { WebClient } from '@slack/web-api'
import { Database } from '~/types/database.types.ts'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { getSlackOauthTokenByTenantId } from '#shared/utils/slack.ts'
import { getEmails2, getNumberOfReceived, getTenantInfoByTenantId, updateNumberOfReceived, updateReceiveStatusToReceived } from '#shared/utils/supabase.ts'

export default defineEventHandler(async event => {

    const { tenantId } = await readBody(event)
    const user = await serverSupabaseUser(event)
    if (!user) throw createError({ statusCode: 401 })

    const supabase = serverSupabaseServiceRole<Database>(event)
    const emails = await getEmails2(tenantId, supabase)

    let result = true
    for (const email of emails) {
        try {
            console.info('email', JSON.stringify(email, null, 2))
            const content = getSlackChatMessage(email)
            const slackOauthToken = await getSlackOauthTokenByTenantId(email.tenant_id, supabase)
            const web = new WebClient(slackOauthToken)
            const result = await web.chat.update(content)
        } catch (error) {
            if (error) {
                console.error(error)
                result = false
            }
        }
    }
    return { result }

    // try {
    //     // 受信済に更新
    //     const sentEmail = await updateReceiveStatusToReceived(trackingToken, supabase)
    //     // テナント情報取得
    //     const tenant = await getTenantInfoByTenantId(sentEmail.tenant_id, supabase)
    //     // 受信済件数取得
    //     const count = await getNumberOfReceived(sentEmail.email_id, supabase)
    //     const statusData = await updateNumberOfReceived(sentEmail.email_id, count, supabase)

    //     // Slack Chat 書き込み (受信確認数更新)
    //     const content = getSlackChatMessage(statusData)
    //     const slackOauthToken = await getSlackOauthTokenByTenantId(sentEmail.tenant_id, supabase)
    //     const web = new WebClient(slackOauthToken)
    //     const result = await web.chat.update(content)
    //     return {
    //         result: true,
    //         ...tenant
    //     }
    // } catch (error) {
    //     if (error) {
    //         console.error(error)
    //         return { result: false, brand_name: '', brand_icon_url: '' }
    //     }
    // }
})