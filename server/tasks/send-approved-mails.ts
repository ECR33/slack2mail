import { defineTask } from 'nitropack/runtime'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import { getSlackChatMessage, getSlackOauthTokenByTenantId } from '#shared/utils/slack'
import { WebClient } from '@slack/web-api'
import { parseEmbeded } from '#shared/utils'
import {
    appendMessage, getSentFolder, createRawMessage, getMessageId, getEmailClients,
    getTrailerLink, getNumberOfSent, getEmails, resolveEmailTargets, updateSentEmail,
    upsertEmail,
    expandEmailTargets,
    getWaitingEmails,
    updateEmail,
    getTimeoutEmails
} from '#shared/utils/mailutilsr'
import type { Database } from '~/types/database.types'
import { SentEmail } from '~~/shared/types'

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
            return
        }

        let email_count = 0
        let target_count = 0 // 今回の処理で送信した件数 emailをまたいだ全て
        for (const email of ret.emails) {
            if (!email.event_name) {
                console.warn('イベント名がありませんでした。スキップしました。', JSON.stringify(email, null, 2))
                continue
            }
            if (!email.subject || !email.body) {
                console.warn('subject,bodyがありませんでした。スキップしました。', email.email_id)
                continue
            }

            try {
                // email 展開
                // approvedのemailをsent_emailsへ展開する
                // approved -> expanded (rpc内で遷移。失敗すると展開もステータス変更もrollbackする。)
                const expanded = await expandEmailTargets(email, supabase)
                if (expanded.shouldProcess) {
                    console.info('emailが展開されました。', email.email_id, expanded.targetLength, DateTime.now().toFormat('yyyy-MM-dd HH:mm'))
                } else {
                    console.info('展開すべきemailはありませんでした。', DateTime.now().toFormat('yyyy-MM-dd HH:mm'))
                }
                // 展開済みメールを送信する
                let targets
                try {
                    targets = await getWaitingEmails(email, supabase) as SentEmail[]
                    if (targets.length == 0) {
                        targets = await getTimeoutEmails(email, supabase) as SentEmail[]
                    }
                } catch (error) {
                    console.error('getWaitingEmails 失敗', error)
                    return
                }

                if (targets.length > 0) {
                    console.info('target emails count', email.email_id, targets.length)

                    // Slack Web Client (メールごとにSlack Workspaceが異なる)
                    const slackOauthToken = await getSlackOauthTokenByTenantId(email.tenant_id, supabase)
                    const web = new WebClient(slackOauthToken)

                    // メール用 準備 (メールごとに送信アカウント/サーバが異なる)
                    const { transporter, imapClient, sender_mail_addr, sender_name } =
                        await getEmailClients(email.tenant_id, email.event_name, supabase)

                    try {
                        await imapClient.connect()
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        console.error('call imapClient.connect() : error', message, sender_mail_addr, sender_name)
                        console.warn('このメールの送信処理は今回スキップします(sendingのまま残るため次回再試行されます)')
                        continue // このemailだけスキップ。statusは'sending'のままなので次回再開される
                    }

                    let targetFolder = ''
                    try {
                        targetFolder = await getSentFolder(imapClient)
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        console.error('call getSentFolder : error', message)
                    }

                    for (const recipient of targets) {

                        const mail_name = sender_name ?? 'slack2mail'
                        const fromHeader = `"${mail_name}" <${sender_mail_addr}>`
                        const app_url = process.env.NUXT_PUBLIC_APP_URL ?? ""
                        const mailMessage = {
                            from: fromHeader,
                            to: recipient.event_email_addr!,
                            subject: parseEmbeded(email.subject, recipient.embeded_values),
                            text: parseEmbeded(email.body, recipient.embeded_values) + getTrailerLink(app_url, recipient.tracking_token),
                            replyTo: sender_mail_addr,
                        }

                        // 送信前に送信中(sending)にステータスを変更する
                        await updateSentEmail(recipient.tracking_token, email.tenant_id, {
                            status: 'sending',
                            sending_at: DateTime.now().toISO()
                        }, supabase)

                        let rawMessageBuffer
                        try {
                            rawMessageBuffer = await createRawMessage(mailMessage)
                            await transporter.sendMail({
                                envelope: { from: sender_mail_addr, to: [recipient.event_email_addr!] },
                                raw: rawMessageBuffer,
                            })
                            const messageId = await getMessageId(rawMessageBuffer)

                            // 既存のsent_emails行(tracking_tokenで一意)をupdateする。新規insertは不要
                            await updateSentEmail(recipient.tracking_token, email.tenant_id, {
                                status: 'sent',
                                sent_at: DateTime.now().toISO(),
                                message_id: messageId,
                            }, supabase)
                            target_count++
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error)
                            console.error('送信失敗', message, recipient.tracking_token)
                            // 失敗した宛先は'failed'として記録する
                            await updateSentEmail(recipient.tracking_token, email.tenant_id, {
                                status: 'failed',
                            }, supabase)
                            // imap書込みはスキップする
                            continue
                        }
                        try {
                            const result = await appendMessage(rawMessageBuffer, targetFolder, imapClient)
                            if (result) {
                                await updateSentEmail(recipient.tracking_token, email.tenant_id, {
                                    imap_written_at: DateTime.now().toISO(),
                                }, supabase)
                            }
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error)
                            console.error('IMAP書込み失敗', message, recipient.tracking_token)
                            // smtpは成功しimapは失敗した。imapの失敗は無視する
                        }
                    }
                    try {
                        imapClient.close()
                    } catch (error) {
                        console.error('imapClient close', error)
                    }

                    // 送信後にステータス変更(emailsテーブルへ送信済みを記録)
                    const count = await getNumberOfSent(email.email_id, supabase)
                    let statusData
                    if (count == email.num_of_target) {
                        // すべて送信できた
                        statusData = await updateEmail({
                            email_id: email.email_id,
                            tenant_id: email.tenant_id,
                            status: 'sent',
                            sent_at: DateTime.now().toISO(),
                            num_of_sent: count,
                        }, supabase)
                    } else if (count > (email.num_of_target ?? 0)) {
                        // なにかおかしい
                        console.error('送信数が送信予定数を上回っています。', email.email_id, count, email.num_of_target)
                        statusData = await updateEmail({
                            email_id: email.email_id,
                            tenant_id: email.tenant_id,
                            status: 'sent',
                            sent_at: DateTime.now().toISO(),
                            num_of_sent: count,
                        }, supabase)
                    } else {
                        // まだ送信できていない
                        statusData = await updateEmail({
                            email_id: email.email_id,
                            tenant_id: email.tenant_id,
                            num_of_sent: count,
                        }, supabase)
                    }

                    // Slackへ結果書込み
                    try {
                        const content = getSlackChatMessage(statusData)
                        await web.chat.update(content)
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        console.error('Slack書込み失敗', message, email.email_id)
                    }
                } else {
                    // 送信対象がない
                    console.info('emailは処理待ちですがsent_emailに対象はありませんでした', email.email_id, email.status, DateTime.now().toFormat('yyyy-MM-dd HH:mm'))
                }
            } catch (error) {
                console.error('email送信処理失敗', email.email_id, JSON.stringify(error, null, 2))
                continue
            }
            email_count++
        }

        console.info('メール送信処理が完了しました。email数', email_count, '送信アドレス数', target_count)
    }
})