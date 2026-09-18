import { defineTask } from 'nitropack/runtime'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import { ulid } from 'ulid'
import { getSlackChatMessage, getSlackOauthTokenByTenantId } from '#shared/utils/slack'
import { WebClient } from '@slack/web-api'
import { parseEmbeded } from '#shared/utils'
import { appendMessage, getSentFolder, createRawMessage, getMessageId, getEmailClients, getTargetEmails, getTrailerLink, upsertSentMail, getNumberOfSent } from '#shared/utils/mailutilsr'
import type { FilterJson } from '#shared/utils/mailutilsr'
import { getEmails } from '#shared/utils/mailutilsr'
import type { Database } from '~/types/database.types'

// TODO: 宛先ごとに送信管理を行うよう変更する。emails単位だと送信完了する前に次の送信が始まり二重送信になる。

export default defineTask({
    meta: {
        name: 'send-approved-mails',
        description: '承認済みのメールを抽出して自動送信およびIMAP同期を行います',
    },
    async run({ payload }) {

        const supabaseProjectUrl = process.env.NUXT_SUPABASE_PROJECT_URL ?? ""
        const supabaseServiceRole = process.env.NUXT_SUPABASE_SERVICE_ROLE ?? ""
        const supabase = createClient<Database>(supabaseProjectUrl, supabaseServiceRole)

        const ret = await getEmails(supabase)
        if (!ret.result || !ret.emails) {
            console.info(ret.message, DateTime.now().toFormat('yyyy-MM-dd HH:mm'))
            return false
        }

        for (const email of ret.emails) {
            // メールごとの送信アカウントに対応したメールクライアントを取得
            const event_name = email.event_name ?? ''
            if (!email.event_name) {
                console.warn('イベント名がありませんでした。スキップしました。', JSON.stringify(email, null, 2))
                continue
            }
            // Slack Web Client (メールごとにSlack Workspaceが異なる)
            const slackOauthToken = await getSlackOauthTokenByTenantId(email.tenant_id, supabase)
            const web = new WebClient(slackOauthToken)

            // メール用 準備
            const { transporter, imapClient, sender_mail_addr, sender_name } = await getEmailClients(email.tenant_id, event_name, supabase)

            // IMAP
            try {
                await imapClient.connect()
            } catch (error) {
                let message
                if (error instanceof Error) {
                    message = error.message
                } else if (typeof error === 'string') {
                    message = error
                } else {
                    console.error('想定外の形式のエラー imapClient.connect()')
                }
                console.error('call imapClient.connect() : error', message, error, sender_mail_addr, sender_name)
                console.warn('送信処理中止')
                return false
            }
            let targetFolder = ''
            try {
                targetFolder = await getSentFolder(imapClient)
            } catch (error) {
                let message
                if (error instanceof Error) {
                    message = error.message
                } else if (typeof error === 'string') {
                    message = error
                } else {
                    console.error('想定外の形式のエラー imapClient.connect()', error)
                }
                console.error('call getSentFolder : error', message)
            }

            // 宛先一覧
            const email_addrs = await getTargetEmails(email.tenant_id, event_name, email.event_filter as FilterJson[], supabase)

            // ここまでで、1 email_id 分のメールと対象の宛先の一覧ができている
            // メールアドレス分の送信ループ
            for (const recipient of email_addrs) {
                // メールデータ不備の場合はスキップ
                if (email.subject == null || email.body == null || email.subject == '' || email.body == '') {
                    console.warn('subject,bodyがありませんでした。スキップしました。', JSON.stringify(email, null, 2))
                    continue
                }

                // メール1件分作成
                const mail_name = sender_name ?? 'slack2mail'
                const fromHeader = `"${mail_name}" <${sender_mail_addr}>`
                const event_mail_id = ulid()
                const app_url = process.env.NUXT_PUBLIC_APP_URL ?? ""
                const mailMessage = {
                    from: fromHeader,
                    to: recipient.email_addr,
                    subject: parseEmbeded(email.subject, recipient.embeded_values),
                    text: parseEmbeded(email.body, recipient.embeded_values) + getTrailerLink(app_url, event_mail_id),
                    replyTo: sender_mail_addr
                }
                try {
                    // rowデータに変換して送信
                    const rawMessageBuffer = await createRawMessage(mailMessage)
                    const sendInfo = await transporter.sendMail({
                        envelope: {
                            from: sender_mail_addr,
                            to: [recipient.email_addr]
                        },
                        raw: rawMessageBuffer
                    })
                    // メール送信をsent_emailsテーブルへ記録(=send mail分)
                    const messageId = await getMessageId(rawMessageBuffer)
                    const email_status = {
                        tracking_token: event_mail_id,
                        tenant_id: email.tenant_id,
                        email_id: email.email_id,
                        sent_at: DateTime.now().toISO(),
                        event_email_addr: recipient.email_addr,
                        received: false,
                        message_id: messageId
                    }
                    await upsertSentMail(email_status, supabase)
                    // 送信メールを送信済みフォルダへ格納(IMAP保存)
                    const result = await appendMessage(rawMessageBuffer, targetFolder, imapClient)
                    if (result) {
                        // 送信済みフォルダへ格納したことを記録(=IMAP分)
                        const email_status = {
                            tracking_token: event_mail_id,
                            tenant_id: email.tenant_id,
                            email_id: email.email_id,
                            imap_written_at: DateTime.now().toISO()
                        }
                        await upsertSentMail(email_status, supabase)
                    }
                } catch (error) {
                    let message = ''
                    if (error instanceof Error) {
                        message = error.message
                    } else if (typeof error === 'string') {
                        message = error
                    } else {
                        console.error('不明なエラー', error)
                    }
                    console.error(message)
                    console.error('_email', JSON.stringify(recipient, null, 2))
                    console.error('email', JSON.stringify(email, null, 2))
                }
            }
            // 送信後にステータス変更(emailsテーブルへ送信済みを記録)
            const count = await getNumberOfSent(email.email_id, supabase)
            const email_sent_status = {
                email_id: email.email_id,
                tenant_id: email.tenant_id,
                status: 'sent',
                approval_channel: email.approval_channel,
                approval_thread_ts: email.approval_thread_ts,
                sent_at: DateTime.now().toISO(),
                num_of_sent: count
            }
            const statusData = await upsertEmail(email_sent_status, supabase)
            // Slack Chatを送信済み状態へ更新
            const content = getSlackChatMessage(statusData)
            const result = await web.chat.update(content)
            imapClient.close()
        }
        console.info('メールが送信されました', ret.emails.length)
    }
})
