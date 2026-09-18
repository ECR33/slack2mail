/**
 * POST /webhook/slack2mail
 * 
 * Slackからの要求を受け付けるAPI
 * ModalやChatを返却する
 * 
 */
import { WebClient } from '@slack/web-api'
import { checkSlackSignature, getMetaData, getSlackView, getSlackViewValues, getSlackPreviewView, setMetaData, getSlackOauthTokenByTeamId } from '#shared/utils/slack'
import { getEmail, getEmailByTs, getReceipientGroupMenuData, getEmbededVarNames, saveEmail, getSampleEventData } from '#shared/utils/supabase'
import { serverSupabaseServiceRole } from '#supabase/server'
import { DateTime } from 'luxon'
import type { Database } from '~/types/database.types'
import { EmailInsert } from '~~/shared/types'

export default defineEventHandler(async (event) => {
    const headers = getRequestHeaders(event)
    const rawBody = await readRawBody(event, false)
    if (rawBody == undefined) {
        console.error('slack2mail: rawBody is undefined. event:', event, 'headers:', headers)
        return false
    }
    const body = await readBody(event)

    // slack signature 検証
    const x_slack_request_timestamp = parseInt(headers['x-slack-request-timestamp'] ?? '0')
    const x_slack_signature = headers['x-slack-signature'] ?? ''
    const config = useRuntimeConfig(event)
    const slackSigningSecret = config.slackSigningSecret

    const result_signcheck = checkSlackSignature(x_slack_request_timestamp, x_slack_signature, slackSigningSecret, rawBody)
    if (!result_signcheck) {
        console.error('slack2mail: Invalid Slack Signature.', x_slack_signature, x_slack_request_timestamp)
        console.error('slack2mail: headers', headers)
        console.error('slack2mail: rawBody', rawBody)
        console.error('slack2mail: body', JSON.stringify(body, null, 2))
        return false
    }

    if (body.ssl_check == "1") {
        // Slackからの存在チェックに応答する
        return true
    }

    // Main

    const command: string = body.command ?? ""
    const trigger_id: string = body.trigger_id ?? ""
    const payload: any = body.payload ? JSON.parse(body.payload) : null
    const channel_id: string = body.channel_id ?? ""
    const team_id: string = body.team_id ?? payload.team.id ?? ""
    if (!team_id) {
        console.error('slack2mail: team_id is null body', body, 'payload', JSON.stringify(payload, null, 2))
        return false
    }

    const supabase = serverSupabaseServiceRole<Database>(event)

    // tenant_id, bot_token 取得 
    const slackOauthTokens = await getSlackOauthTokenByTeamId(team_id, supabase)
    if (!slackOauthTokens.result) {
        return false
    }
    const tenant_id = slackOauthTokens.tenant_id

    // Slack WebClient作成
    const web = new WebClient(slackOauthTokens.bot_token)
    let view: any  // Slack送信用view

    if (command && (command == "/slack2mail" || command == "/slack2mail_dev")) {

        try {
            const event_names = await getEventNames(tenant_id, supabase)
            const view_id = null // スラッシュコマンドの時点ではview_idはない
            const _view = getSlackView(trigger_id, view_id, event_names, null, null, null, null, false)
            view = setMetaData(_view, { channel_id })
            const result = await web.views.open(view)
        } catch (error) {
            console.error('slack2mail: /command response error', error)
            throw createError({
                statusCode: 500,
                message: `Slack送信失敗: ${error}`
            })
        }

    } else {
        try {
            // 画面間引き継ぎデータ抽出
            const params = getMetaData(payload)
            let channel_id = params.channel_id ?? ""
            let email_id = params.email_id ?? null
            let selected_event_name = params.selected_event_name ?? ""
            let schedule_mode = params.schedule_mode ?? false
            let schedule = params.schedule ?? null


            if (payload.type == "block_suggestion") {
                // 宛先グループの検索
                const event_name = payload.view.state.values.event_name.select_action.selected_option.value ?? ''
                const ex_event_filter_name = payload.block_id.replace('ex_select_', '') ?? ''
                const ex_event_filter_keyword = payload.value
                const data = await getReceipientGroupValues(event_name, ex_event_filter_name, supabase)
                const options = createExSelectOptions(data)
                return { options }
            } else if (payload.type == "block_actions") {
                // イベント名の選択
                const actions = payload.actions
                const block_id = actions[0].block_id
                if (block_id == 'event_name') {
                    // イベントが選択されたことを確認後..
                    const selected_event_name = actions[0].selected_option.value
                    const receipient_groups = await getReceipientGroupMenuData(tenant_id, selected_event_name, supabase)
                    const embeded_var_names = await getEmbededVarNames(tenant_id, selected_event_name, supabase)
                    const event_names = await getEventNames(tenant_id, supabase)
                    const _view = getSlackView(payload.trigger_id, payload.view.id, event_names, selected_event_name, receipient_groups, embeded_var_names, null, schedule_mode, schedule)
                    view = setMetaData(_view, { channel_id, email_id, selected_event_name, schedule_mode, schedule })
                    const result = await web.views.update(view)
                } else if (block_id == 'preview') {
                    // previewボタン押下
                    const subject = payload.view.state.values.subject.input_action.value ?? ""
                    const body = payload.view.state.values.body.input_action.value ?? ""
                    const event_name = payload.view.state.values.event_name.select_action.selected_option?.value ?? ""

                    const eventData = await getSampleEventData(tenant_id, event_name, supabase)
                    let _subject
                    let _body
                    if (eventData) {
                        _subject = parseEmbeded(subject, eventData.embeded_values)
                        _body = parseEmbeded(body, eventData.embeded_values)
                    } else {
                        _subject = subject
                        _body = body
                    }
                    view = getSlackPreviewView(payload.trigger_id, _subject, _body)
                    // cast to any to satisfy ViewsPushArguments type requirements
                    const result = await web.views.push(view as any)

                } else if (block_id == 'actions') {
                    const action_id = payload.actions[0].action_id
                    if (action_id == 'edit') {
                        // 編集ボタン押下
                        const email_id = payload.actions[0].value
                        const email = await getEmail(email_id, supabase)
                        channel_id = payload.channel.id
                        const event_names = await getEventNames(tenant_id, supabase)
                        selected_event_name = email.event_name ?? ''
                        schedule_mode = false
                        schedule = null
                        if (email.schedule) {
                            schedule_mode = true
                            schedule = DateTime.fromISO(email.schedule).toUnixInteger()
                        }
                        const receipient_groups = await getReceipientGroupMenuData(tenant_id, selected_event_name, supabase)
                        const embeded_var_names = await getEmbededVarNames(tenant_id, selected_event_name, supabase)
                        const _view = getSlackView(payload.trigger_id, null, event_names, selected_event_name, receipient_groups, embeded_var_names, email, schedule_mode, schedule)
                        view = setMetaData(_view, { channel_id, email_id, selected_event_name, schedule_mode, schedule })
                        const result = await web.views.open(view)
                    } else if (action_id == 'abort') {
                        // 中止ボタン押下
                        const email_id = payload.actions[0].value
                        const email = await getEmail(email_id, supabase)
                        email.aborted_by = payload.user.id
                        email.aborted_at = DateTime.now().toISO()
                        email.status = 'aborted'
                        email.approval_count = 0
                        email.approved_by = []
                        await saveEmail(email, supabase)
                        const content = getSlackChatMessage(email)
                        const result = await web.chat.update(content)
                    } else if (action_id == 'approve') {
                        // 確認ボタン押下
                        const email_id = payload.actions[0].value
                        const user_id = payload.user.id
                        const email = await getEmail(email_id, supabase)
                        const approved_by = email.approved_by ?? []
                        if (!approved_by.includes(user_id)) {
                            approved_by.push(user_id)
                            email.approved_by = approved_by
                            email.approval_count = approved_by.length
                            if (email.approval_count >= email.approval_border) {
                                email.status = 'approved'
                                if (email.schedule && email.schedule < DateTime.now().plus({ minutes: 5 }).toISO()) {
                                    // 既にスケジユールがあり、現在時刻よりも5分以上未来の場合
                                    // 予定通りとし、日時を修正しない。
                                } else {
                                    // スケジュールがないか、現在時刻に近すぎる場合
                                    if (email.approval_count > email.approval_border) {
                                        // オーバーコミットの時、すでに確認済みなので既に設定された時刻のままとする
                                    } else {
                                        email.schedule = DateTime.now().plus({ minutes: 5 }).toISO()
                                    }
                                }
                            }
                            await saveEmail(email, supabase)
                            const content = getSlackChatMessage(email)
                            const result = await web.chat.update(content)
                        } else {
                            // 既に確認済みのユーザで、更に確認
                            // 何もしない
                        }
                    }
                } else if (block_id == 'schedule_mode') {
                    const selected_mode_value = actions[0].selected_option.value
                    schedule_mode = selected_mode_value == "1" ? true : false
                    if (schedule_mode && !schedule) {
                        schedule = DateTime.now().toUnixInteger()
                    }
                    const receipient_groups = await getReceipientGroupMenuData(tenant_id, selected_event_name, supabase)
                    const embeded_var_names = await getEmbededVarNames(tenant_id, selected_event_name, supabase)
                    const event_names = await getEventNames(tenant_id, supabase)
                    const _view = getSlackView(payload.trigger_id, payload.view.id, event_names, selected_event_name, receipient_groups, embeded_var_names, null, schedule_mode)
                    view = setMetaData(_view, { channel_id, email_id, selected_event_name, schedule_mode, schedule })
                    const result = await web.views.update(view)
                } else if (block_id == 'schedule_pick') {
                    schedule = actions[0].selected_date_time
                    const receipient_groups = await getReceipientGroupMenuData(tenant_id, selected_event_name, supabase)
                    const embeded_var_names = await getEmbededVarNames(tenant_id, selected_event_name, supabase)
                    const event_names = await getEventNames(tenant_id, supabase)
                    const _view = getSlackView(payload.trigger_id, payload.view.id, event_names, selected_event_name, receipient_groups, embeded_var_names, null, schedule_mode)
                    view = setMetaData(_view, { channel_id, email_id, selected_event_name, schedule_mode, schedule })
                    const result = await web.views.update(view)
                } else {
                    console.error('未対応のblock', block_id)
                }
            } else if (payload.type == "view_submission") {
                // modalにて保存ボタン押下
                const _email = email_id ? await getEmail(email_id, supabase) : null
                const mail = getSlackViewValues(payload, _email)
                mail.tenant_id = tenant_id
                if (schedule_mode) {
                    mail.schedule = DateTime.fromSeconds(schedule).toISO()
                } else {
                    mail.schedule = null
                }
                const db_email = await saveEmail(mail, supabase)
                const content = getSlackChatMessage(db_email)
                if (db_email.approval_thread_ts) {
                    // 修正
                    const result = await web.chat.update(content)
                } else {
                    // 新規
                    const result = await web.chat.postMessage(content)
                    if (result.ts) {
                        db_email.approval_thread_ts = result.ts
                    } else {
                        throw Error('view_submission: ts not found in result of postMessage')
                    }
                    await saveEmail(db_email, supabase)
                }
            } else if (payload.type == "message_action") {
                // ** Message Shortcut - ここから新しいメールを作成 **
                if (payload.callback_id == "create_a_mail_from_message") {
                    // ここから新しいメールを作成
                    channel_id = payload.channel.id
                    const message_ts = payload.message_ts
                    let email = await getEmailByTs(tenant_id, channel_id, message_ts, supabase)
                    if (!email) {
                        email = {
                            email_id: '',
                            tenant_id: tenant_id,
                            subject: '',
                            body: payload.message.text,
                            event_name: '',
                        } as any
                    }
                    email.email_id = ''
                    email_id = ''

                    selected_event_name = email.event_name || ''
                    const receipient_groups = await getReceipientGroupMenuData(tenant_id, selected_event_name, supabase)
                    const embeded_var_names = await getEmbededVarNames(tenant_id, selected_event_name, supabase)

                    const trigger_id = payload.trigger_id
                    const view_id = null
                    const event_names = await getEventNames(tenant_id, supabase)
                    const _view = getSlackView(trigger_id, view_id, event_names, selected_event_name, receipient_groups, embeded_var_names, email)
                    schedule_mode = false
                    schedule = null
                    view = setMetaData(_view, { channel_id, email_id, selected_event_name, schedule_mode, schedule })
                    const result = await web.views.open(view)
                } else {
                    console.error('未対応のpayload.callback_id', payload.type, payload.callback_id)
                    return false
                }
            } else {
                console.error('未対応のpayload.type', payload.type)
                return false
            }
        } catch (error) {
            console.error('slack2mail: Interactiviey error', error)
            console.error('payload', JSON.stringify(payload, null, 2))
            console.error('view', JSON.stringify(view, null, 2))
            throw createError({
                statusCode: 500,
                message: `Slack Modal失敗: ${error}`
            })
        }
    }
}
)