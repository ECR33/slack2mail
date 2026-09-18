import { DateTime } from 'luxon'
import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FilterJson } from './mailutilsr';
import type { InputBlock, InputBlockElement, MultiStaticSelect, PlainTextOption, RichTextBlock, SectionBlock, ActionsBlock, DateTimepicker } from '@slack/types'

/**
 * Slack Signature を検証する。
 * Slackから呼び出された場合、呼び出し元が正しいSlackかを検証する
 * 
 * @param x_slack_request_timestamp request.headerから取得
 * @param x_slack_signature request.headerから取得
 * @param slackSigningSecret Slackアプリ作成時に取得しておく
 * @param rawBody request.bodyから取得
 * @returns 
 */
export const checkSlackSignature = (x_slack_request_timestamp: number, x_slack_signature: string, slackSigningSecret: string, rawBody: Buffer<ArrayBufferLike>) => {

    // slack signature 検証
    // パラメータ取得元の例
    // const x_slack_request_timestamp = parseInt(headers['x-slack-request-timestamp'] ?? '0')
    // const x_slack_signature = headers['x-slack-signature'] ?? ''
    // const config = useRuntimeConfig(event) as Slack2mailEnv
    // const slackSigningSecret = config.slackSigningSecret
    // const rawBody = await readRawBody(event, false)

    if (Math.abs(Date.now() / 1000 - x_slack_request_timestamp) > 60 * 5) {
        console.error('timestamp check false')
        return false
    }

    const base_string = `v0:${x_slack_request_timestamp}:${rawBody}`
    const sig = 'v0=' + crypto.createHmac('sha256', slackSigningSecret).update(base_string).digest('hex')
    const result_signcheck = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(x_slack_signature))
    if (!result_signcheck) {
        console.error('signature check false')
        return false
    }

    return true

}

/**
 * Base62エンコードする
 * @param n 
 * @returns 
 */
const toBase62 = (n: number) => {
    if (n === 0) {
        return "0";
    }
    var digits = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var result = "";
    while (n > 0) {
        result = digits[n % digits.length] + result;
        // n = parseInt(n / digits.length, 10); 型エラーになる
        n = Math.floor(n / digits.length);
    }
    return result;
}

/**
 * email_idを作成する(時間からbase62文字列)
 * @returns email_id (base62)
 */
const createEmailId = () => {
    const today = new Date();
    const email_id = toBase62(today.getTime());
    return email_id;
}


/**
 * slack UI でmulti_static_selectで選択された値をパースする
 * @param values payload.view.state.values
 * @returns EventFilter型の配列 [{ column_name: "年", column_value: "1年" }] (event_nameは含まれない)
 */
const getEvetnFilter = (values: any) => {
    // const keys: string[] = Object.keys(values).filter(f => (f.includes('ex_select_')))
    const keys: string[] = Object.keys(values).filter(f => (f.includes('select_')))
    const eventFilters: EventFilter[] = []
    keys.forEach(k => {
        // const column_name = k.replace('ex_select_', '')
        const column_name = k.replace('select_', '')
        const eventFilter = values[k].multi_static_select_action.
            selected_options.map((m: { text: any, value: string }) => {
                return {
                    column_name,
                    column_value: m.value
                }
            })
        eventFilters.push(...eventFilter)
    })
    return eventFilters
}

/**
 * slack UI から渡されたpayloadデータを元にemailデータを生成する
 * @param payloadStr Webhookに渡されたstringifyされたpayload または parseされたオブジェクト
 * @param _email 編集の場合は編集前のデータベースの値をここに指定する
 * @returns emailデータ Email形式
 */
export const getSlackViewValues = (payloadStr: string | any, _email: Email | null = null) => {

    let payload
    if (typeof payloadStr == 'string') {
        payload = JSON.parse(payloadStr)
    } else {
        payload = payloadStr
    }
    const params = getMetaData(payload)
    const values = payload.view.state.values
    const email: Email = {
        email_id: params.email_id || createEmailId(),
        tenant_id: '',
        subject: values.subject.input_action.value ?? "",
        body: values.body.input_action.value ?? "",
        event_name: values.event_name.select_action.selected_option.value ?? "",
        event_filter: getEvetnFilter(values),
        status: "pending",
        approval_count: 0,
        approval_border: parseInt(values.approve_count.select_action.selected_option.value),
        approved_by: [],
        attachments: null,
        created_by: _email?.created_by ?? payload.user.id ?? "",
        created_at: _email?.created_at ?? DateTime.now().toISO(),
        team_id: _email?.team_id ?? payload.team.id ?? "",
        approval_channel: _email?.approval_channel ?? params.channel_id,
        approval_thread_ts: _email?.approval_thread_ts ?? "",
        schedule: null,
        sent_at: null,
        num_of_received: 0,
        num_of_sent: 0,
        aborted_by: null,
        aborted_at: null,
        edited_by: _email ? payload.user.id : null,
        edited_at: _email ? DateTime.now().toISO() : null,
        mail_account_id: _email?.mail_account_id ?? null,
        mail_account_name: _email?.mail_account_name ?? null
    }
    return email
}

/**
 * slackの動的選択値UIのoptionsデータを作成する
 * @param event_filter_values ["選択値1", "選択値2", ...]
 * @returns 
 */
export const createExSelectOptions = (event_filter_values: string[]) => {
    // event_filter = { "column_name": "学年", "column_values": [ "1", "4" ] }
    // [ { text: { type: "plain_text", text: "1" }, value: "1" }, ]
    return event_filter_values.map(m => {
        return {
            text: { type: "plain_text", text: m },
            value: m
        }
    })
}

/**
 * 文字列のみのブロック
 * @param block_id 
 * @param text_title 
 * @param text_value 
 * @returns 
 */
const getLabelBlock = (block_id: string, text_title: string, text_value: string | null = null) => {
    const text_block: RichTextBlock = {
        type: "rich_text",
        block_id,
        elements: [
            {
                type: "rich_text_section",
                elements: [
                    {
                        type: "text",
                        text: text_title,
                        style: {
                            bold: true
                        }
                    },
                    {
                        type: "text",
                        text: `: ${text_value}`
                    }
                ]
            }
        ]
    }
    return text_block
}

/**
 * テキスト入力形式のブロック
 * @param block_id 
 * @param text ラベル用テキスト
 * @param multiline 複数行入力かどうか(複数行ならtrue) default false
 * @param initial_value テキスト初期値
 * @returns 
 */
const getTextBlock = (block_id: string, text: string, multiline: boolean = false, initial_value: string | null = null) => {
    const element: InputBlockElement = {
        type: "plain_text_input",
        action_id: "input_action"
    }
    const text_block: InputBlock = {
        type: "input",
        block_id,
        element,
        label: {
            type: "plain_text",
            text,
            emoji: true
        },
        optional: false
    }
    if (multiline) {
        element['multiline'] = true
    }
    if (initial_value) {
        element['initial_value'] = initial_value
    }
    return text_block
}

/**
 * メールのプレビューを表示させるボタン
 * @param block_id 
 * @param text 
 * @param label 
 * @returns 
 */
const getPreviewButton = (block_id: string, text: string, label: string) => {
    // "preview", "メールの題名と本文をプレビュー", "表示"
    const block: SectionBlock = {
        type: "section",
        block_id,
        text: {
            type: "mrkdwn",
            text: text
        },
        accessory: {
            type: "button",
            text: {
                type: "plain_text",
                text: label,
                emoji: true
            },
            value: "click_me_123",
            action_id: `${block_id}_action`
        }
    }
    return block
}

/**
 * 選択肢形式
 * @param block_id event_name
 * @param text イベント名
 * @param options 選択できるイベント
 * @param dispatch_action 選択肢を選択した際にサーバへイベントを送信するかどうか
 * @param value 選択済みの値
 * @returns 
 */
type Option = {
    name: string
    value: string
}
const getSelectBlock = (block_id: string, text: string, options: string[] | Option[], dispatch_action: boolean = false, value: string | null = null) => {
    let _options: PlainTextOption[]
    let _option_mode = "Option" // or string
    if (options.length > 0 && typeof options[0] == "string") {
        _option_mode = "string"
        const __options = options as string[]
        _options = __options.map(m => {
            return {
                text: {
                    type: "plain_text",
                    text: m,
                    emoji: true
                },
                value: m
            }
        })
    } else {
        const __options = options as Option[]
        _options = __options.map(m => {
            return {
                text: {
                    type: "plain_text",
                    text: m.name,
                    emoji: true
                },
                value: m.value
            }
        })

    }
    const select_block: { [key: string]: string | any | boolean } = {
        type: "input",
        block_id,
        element: {
            type: "static_select",
            placeholder: {
                type: "plain_text",
                text,
                emoji: true
            },
            action_id: "select_action",
            options: _options
        },
        label: {
            type: "plain_text",
            text,
            emoji: true
        },
        optional: false,
        dispatch_action,
    }
    if (value) {
        if (_option_mode == "string") {
            const initial_option: PlainTextOption = {
                text: {
                    type: "plain_text",
                    text: value,
                    emoji: true
                },
                value
            }
            select_block.element['initial_option'] = initial_option
        } else {
            const __options = options as Option[]
            const option_objs = __options.filter(f => f.value == value) ?? []
            if (option_objs.length > 0 && option_objs[0] && option_objs[0].name) {
                const initial_option: PlainTextOption = {
                    text: {
                        type: "plain_text",
                        text: option_objs[0].name,
                        emoji: true
                    },
                    value: option_objs[0].value
                }
                select_block.element['initial_option'] = initial_option
            } else {
                console.error('getSelectBlock: initial_option 組立エラー', value)
            }
        }
    }
    return select_block
}

/**
 * 埋め込み用変数名の配列。本文作成時に参考になるように表示するため
 */
export type EmbededVarNames = string[]

export type ReceipientGroupMenuData = {
    column_name: string
    column_values: string[]
    // selected_values: string[] // いったん使用しない。emailから取得する
}

/**
 * 1イベント分の選択肢データを作成する。選択済み値はオプション。
 * @param receipientGroupMenuDatas ReceipientGroupMenuData カラム名と値と選択済み値のオブジェクト
 * @returns 
 */
const getMultiSelectBlocks = (receipientGroupMenuDatas: ReceipientGroupMenuData[], email: Email | null = null) => {
    if (receipientGroupMenuDatas == null || receipientGroupMenuDatas == undefined || receipientGroupMenuDatas.length == 0) {
        return null
    }
    const selectedValues: Record<string, string[]> = {}
    if (email && email.event_filter) {
        const filter = email.event_filter as FilterJson[]
        filter.forEach(f => {
            const columnName = f.column_name
            const columnValue = f.column_value
            selectedValues[columnName] ? selectedValues[columnName].push(columnValue) : selectedValues[columnName] = [columnValue]
        })
    }
    return receipientGroupMenuDatas.map(m => {
        const columnName = m.column_name
        const columnValues = m.column_values
        let options: PlainTextOption[] = columnValues.map(m => {
            return {
                text: {
                    type: "plain_text",
                    text: String(m),
                    emoji: true
                },
                value: String(m)
            }
        })
        if (options.length > 100) {
            // slackのオプション数超過 -> エラーへ置き換え
            options = [
                {
                    text: {
                        type: "plain_text",
                        text: "選択肢が多すぎます 宛先グループ列名 を見直してください",
                        emoji: true
                    },
                    value: "選択肢が多すぎます"
                }
            ]
        }
        const element: MultiStaticSelect = {
            type: "multi_static_select",
            placeholder: {
                type: "plain_text",
                text: "宛先を選択...",
                emoji: true
            },
            options,
            action_id: "multi_static_select_action"
        }
        const block: InputBlock = {
            type: "input",
            block_id: `select_${columnName}`,
            element,
            label: {
                type: "plain_text",
                text: columnName,
                emoji: true
            },
            optional: true
        }
        if (selectedValues[columnName] && selectedValues[columnName].length > 0) {
            element['initial_options'] = selectedValues[columnName].map(mm => {
                return {
                    text: {
                        type: "plain_text",
                        text: mm,
                        emoji: true
                    },
                    value: mm
                }
            })
        }
        return block
    })
}

/**
 * 未使用
 * 外部データ・複数選択形式
 * @param filter_columns ["学年", "組"]
 * @param min_query_length 最低入力文字数 default=1
 * @returns 
 */
const getExSelectBlocks = (filter_columns: string[], min_query_length: number = 1) => {
    if (filter_columns == null || filter_columns == undefined || filter_columns.length == 0) {
        return null
    }
    return filter_columns.map(m => {
        return {
            type: "input",
            block_id: `ex_select_${m}`,
            optional: true,
            element: {
                type: "multi_external_select",
                placeholder: {
                    type: "plain_text",
                    text: "Select options",
                    emoji: true
                },
                min_query_length,
                action_id: "multi_select_action"
            },
            label: {
                type: "plain_text",
                text: m,
                emoji: true
            },
        }
    })
}

/**
 * 未使用
 * チェックボックス
 * @returns 
 */
const getCheckBox = () => {
    const checkBox: ActionsBlock = {
        type: "actions",
        block_id: "check",
        elements: [
            {
                type: "checkboxes",
                options: [
                    {
                        text: {
                            type: "plain_text",
                            text: "🕒送信予約",
                            emoji: true
                        },
                        value: "true"
                    }
                ],
                action_id: "check_action"
            }
        ]
    }
    return checkBox
}

/**
 * DatetimePicker
 * @param schedule 10桁のUNIXタイムスタンプ
 * @returns 
 */
const getDatetimePicker = (schedule: number | null) => {
    let initial_date_time
    if (schedule) {
        initial_date_time = schedule
    } else {
        initial_date_time = Math.floor(Date.now() / 1000)
    }
    const element: DateTimepicker = {
        type: "datetimepicker",
        action_id: "schedule_action",
        initial_date_time
    }
    return {
        type: "input",
        block_id: "schedule_pick",
        element,
        label: {
            type: "plain_text",
            text: "送信日時",
            emoji: true
        },
        optional: false,
        dispatch_action: true
    }
}

/**
 * slack2mailのモーダルに表示する基本的な部品
 * @param event_names ["event1", "event2"]
 * @param selected_event_name 選択したイベント
 * @param receipient_groups 選択したイベントに対応する宛先グループ選択肢を表示するためのデータ
 * @param embeded_var_names 埋め込みマーカーとして使用する文字列(埋込み項目列名) ["変数名", "変数名"...]
 * @param email データベース上の値。すでに登録済みの情報を編集する際に指定する
 * @param schedule_mode 送信日時モード
 * @param schedule 送信日時 10桁UNIXタイムスタンプ
 * @returns block kit 形式
 */
export const createBlocks = (event_names: string[], selected_event_name: string | null = null, receipient_groups: ReceipientGroupMenuData[] | null = null, embeded_var_names: EmbededVarNames | null = null, email: Email | null = null, schedule_mode: boolean = false, schedule: number | null) => {
    const blocks = []
    blocks.push(getTextBlock("subject", "件名", false, email?.subject ?? null))
    blocks.push(getTextBlock("body", "本文", true, email?.body ?? null))
    blocks.push(getPreviewButton("preview", "メールの題名と本文をプレビュー", "表示"))
    blocks.push(getSelectBlock("event_name", "イベント", event_names, true, selected_event_name))
    if (embeded_var_names && embeded_var_names.length > 0) {
        blocks.push(getLabelBlock("embeded_vars", "埋込み文字", embeded_var_names.map(m => {
            return `((( ${m} )))`
        }).join(' , ')))
    }
    if (receipient_groups) {
        const multi_select = getMultiSelectBlocks(receipient_groups, email)
        multi_select?.map(m => {
            blocks.push(m)
        })
    }
    const approve_options = [...Array(5).keys()].map(m => `${5 - m}`)
    const initial_value = '' + (email?.approval_border ?? "3")
    const schedule_modes: Option[] = [{ name: "自動設定(確認5分後)", value: "0" }, { name: "指定の日時", value: "1" }]
    blocks.push(getSelectBlock("schedule_mode", "送信予定", schedule_modes, true, schedule_mode ? "1" : "0"))
    if (schedule_mode) {
        blocks.push(getDatetimePicker(schedule))
    }
    blocks.push(getSelectBlock("approve_count", "確認者数", approve_options, false, initial_value))
    return blocks
}

/**
 * DEPRECATED
 * slack2mailのモーダルに表示する基本的な部品 external selct版
 * @param event_names ["event1", "event2"]
 * @param event_filter_columns ["学年", "組"]
 * @param selected_event_name 選択したイベント
 * @returns block kit 形式
 */
export const createBlocksEx = (event_names: string[], event_filter_columns: string[] = [], selected_event_name: string) => {
    const blocks = []
    blocks.push(getTextBlock("subject", "件名"))
    blocks.push(getTextBlock("body", "本文", true))
    blocks.push(getSelectBlock("event_name", "イベント", event_names, true, selected_event_name))
    const ex_select_blocks = getExSelectBlocks(event_filter_columns)
    if (ex_select_blocks != null) {
        ex_select_blocks.map(m => {
            blocks.push(m)
        })
    }
    const approve_options = [...Array(5).keys()].map(m => `${5 - m}`)
    blocks.push(getSelectBlock("approve_count", "確認者数", approve_options, false, "3"))
    return blocks
}

/**
 * slack2mailのモーダルを表示するためのデータ(block kit)
 * @param trigger_id slackより抽出すること
 * @param view_id slack UIから呼び出された際の payload.view.id
 * @param event_names イベント名一覧 supabase
 * @param selected_event_name メール送信対象のイベント名 イベント名一覧から選択された値 supabase
 * @param receipient_groups 選択したイベントに対応する宛先グループ選択肢を表示するためのデータ
 * @param embeded_var_names 埋め込みマーカーとして使用する文字列(埋込み項目列名) ["変数名", "変数名"...]
 * @param email データベース上の値。すでに登録済みの情報を編集する際に指定する
 * @param schedule_mode 送信日時モード
 * @param schedule 送信日時 10桁UNIXタイムスタンプ
 * @returns 
 */
export const getSlackView = (trigger_id: string, view_id: string | null = null, event_names: string[], selected_event_name: string | null = null, receipient_groups: ReceipientGroupMenuData[] | null = null, embeded_var_names: EmbededVarNames | null = null, email: Email | null = null, schedule_mode: boolean = false, schedule: number | null = null) => {
    // 総合的にslackに返却するblock kit データを作成する部分

    const blocks = createBlocks(event_names, selected_event_name, receipient_groups, embeded_var_names, email, schedule_mode, schedule)
    const dialog_title = email ? (email.email_id ? 'メール編集' : 'メール作成(コピー新規)') : 'メール作成'
    const view = {
        trigger_id,
        view: {
            type: "modal",
            callback_id: "opened_modal", // "email_create_modal" ??
            title: {
                type: "plain_text",
                text: dialog_title // メール作成 / メール編集 / メール作成(コピー新規)
            },
            submit: {
                type: "plain_text",
                text: "保存"
            },
            blocks
        }
    } as any
    if (view_id) {
        view['view_id'] = view_id
    }
    return view
}

/**
 * channel_id, email_id をprivate_metadataにセットする
 * @param view getSlackViewで作成したview
 * @param params {channel_id, email_id, event_name, schedule_mode, ....}
 * @returns 
 */
export const setMetaData = (view: any, params: any) => {
    view.view['private_metadata'] = JSON.stringify(params)
    return view
}

/**
 * private_metadataを取得する。
 * channel id, email_idが含まれる
 * @param payload パース後のオブジェクト
 * @returns 
 */
export const getMetaData = (payload: any) => {
    return JSON.parse(payload.view?.private_metadata ?? "{}")
}

/**
 * 未使用
 * slack2mailのモーダルを表示するためのデータ(block kit) 宛先グループ選択がexternal select版
 * @param trigger_id slackより抽出すること
 * @param view_id slack UIから呼び出された際の payload.view.id
 * @param callback_id 新規呼び出し: opened_modal, 編集: email_create_modal TODO: 変更が必要かみなおすこと
 * @param event_names メール送信対象のイベント名 supabase
 * @param event_filter_columns  ["学年", "組"]
 * @param selected_event_name 選択したイベント
 * @returns 
 */
export const getSlackViewEx = (trigger_id: string, view_id: string | null = null, callback_id: string, event_names: string[], event_filter_columns: string[] = [], selected_event_name: string) => {
    // 総合的にslackに返却するblock kit データを作成する部分

    const blocks = createBlocksEx(event_names, event_filter_columns, selected_event_name)
    const view: { [key: string]: string | object } = {
        trigger_id,
        view: {
            type: "modal",
            callback_id, // "opened_modal" / "email_create_modal" ??
            title: {
                type: "plain_text",
                text: "メール作成" // メール作成 / メール編集 / メール作成(コピー新規)
            },
            submit: {
                type: "plain_text",
                text: "保存"
            },
            blocks
        }
    }
    if (view_id) {
        view['view_id'] = view_id
    }
    return view
}

/**
 * メールのプレビューを表示する
 * @param trigger_id 
 * @param subject 埋込みパース済みのテキストを指定すること
 * @param body 埋込みパース済みのテキストを指定すること
 */
export const getSlackPreviewView = (trigger_id: string, subject: string, body: string) => {
    const _subject = subject ? `*${subject}*` : ''
    return {
        trigger_id,
        view: {
            type: "modal",
            callback_id: "preview_modal",
            title: {
                type: "plain_text",
                text: "メールプレビュー"
            },
            blocks: [{
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `${_subject}\n\n${body}`
                }
            }]
        }
    }
}

// chat message =================================

/**
 * メール保存後、確認待ち状態に表示するメッセージ(ボタン)
 * @param email 
 * @returns 
 */
const createActions = (email: Email) => {
    const approve = {
        type: "button",
        style: "primary",
        text: {
            type: "plain_text",
            text: `確認(${email.approval_count}/${email.approval_border})`,
            emoji: true
        },
        action_id: "approve",
        value: email.email_id,
    }
    const abort = {
        type: "button",
        style: "danger",
        text: {
            type: "plain_text",
            text: "中止",
        },
        action_id: "abort",
        value: email.email_id,
    }
    const edit = {
        type: "button",
        text: {
            type: "plain_text",
            text: "編集",
        },
        action_id: "edit",
        value: email.email_id,
    }

    const actions = {
        type: "actions",
        block_id: "actions",
        elements: [] as any,
    }

    // pending / approved / sending / sent / aborted
    switch (email.status) {
        case 'pending':
        case 'approved':
            actions.elements.push(approve)
            actions.elements.push(abort)
            actions.elements.push(edit)
            break;
        case 'sending':
            break;
        case 'sent':
            break;
        case 'aborted':
            actions.elements.push(edit)
            break;
    }
    return actions
}



/**
 * 作成者を表示するメッセージ
 * @param email 
 * @returns 
 */
const createCreateddMessage = (email: Email) => {
    return {
        type: "section",
        text: {
            type: "mrkdwn",
            text: `:envelope:<@${email.created_by}>さんにより作成されました`,
        }
    }
}

/**
 * 承認直後、送信待ち状態に表示するメッセージ
 * @param email 
 * @returns 
 */
const createApprovedMessage = (email: Email) => {
    return {
        type: "section",
        text: {
            type: "plain_text",
            text: ":tada:メールは承認されました",
            emoji: true,
        }
    }
}

/**
 * 編集された際に表示するメッセージ
 * @param email 
 * @returns 
 */
const createEditedMessage = (email: Email) => {
    return {
        type: "section",
        text: {
            type: "mrkdwn",
            text: `:memo:<@${email.edited_by}>さんにより編集されました`,
        }
    }
}

/**
 * 送信キャンセルされた際に表示するメッセージ
 * @param email 
 * @returns 
 */
const createAbortedMessage = (email: Email) => {
    return {
        type: "section",
        text: {
            type: "mrkdwn",
            text: `:warning:<@${email.aborted_by}>さんにより中止されました`,
        }
    }
}

/**
 * 承認後、送信待ち状態に表示するメッセージ
 * @param email 
 * @returns 
 */
const createScheduleMessagae = (email: Email) => {
    let dateStr = '未定'
    if (email.schedule) {
        dateStr = DateTime.fromISO(email.schedule).toFormat('yyyy/MM/dd HH:mm')
    }
    return {
        type: "section",
        text: {
            type: "plain_text",
            text: `送信予定時刻: ${dateStr}`,
            emoji: true,
        }
    }
}

/**
 * メール送信後に表示するメッセージ
 * @param email 
 * @returns 
 */
const createSentMessage = (email: Email) => {
    let dateStr = ''
    if (email.sent_at) {
        dateStr = DateTime.fromISO(email.sent_at).toFormat('yyyy/MM/dd HH:mm')
    }
    return {
        type: "section",
        text: {
            type: "plain_text",
            text: `:incoming_envelope:メールは送信されました\n送信時刻: ${dateStr}\n受信確認数: ${email.num_of_received}/${email.num_of_sent}`,
            emoji: true,
        }
    }
}

/**
 * 確認用タイトル
 * @param email 
 * @returns 
 */
const createMailTitle = (email: Email) => {
    return {
        type: "header",
        block_id: "subject",
        text: {
            type: "plain_text",
            text: `${email.event_name} メール`,
            emoji: true
        }
    }
}

/**
 * メール件名・本文
 * @param email 
 * @returns 
 */
const createMailMessage = (email: Email) => {
    return {
        type: "rich_text",
        block_id: "body",
        elements: [
            {
                type: "rich_text_preformatted",
                elements: [
                    {
                        type: "text",
                        text: email.subject
                    },
                    {
                        type: "text",
                        text: "\n"
                    },
                    {
                        type: "text",
                        text: "\n"
                    },
                    {
                        type: "text",
                        text: email.body
                    }
                ]
            }

        ]
    }


}

/**
 * 送信対象のイベント名
 * @param email 
 * @returns 
 */
const createEventNameMessage = (email: Email) => {
    return {
        type: "section",
        block_id: "event_name",
        text: {
            type: "mrkdwn",
            text: `*イベント*: ${email.event_name}`,
        }
    }
}


/**
 * 宛先グループの表示形
 * @param email
 * @returns 
 * [{
 *   "type": "mrkdwn",
 *   "text": "*学年*\n1年, 4年, 5年, 6年, 7年, 9年"
 *  },...]
 */
const createReceipientsField = (email: Email) => {
    const filters = {} as any
    const eventFilter = email.event_filter as FilterJson[]
    if (eventFilter && eventFilter.length > 0) {
        eventFilter.forEach(f => {
            if (!filters[f.column_name]) filters[f.column_name] = []
            filters[f.column_name].push(f.column_value)
        })
        return {
            type: "section",
            block_id: `receipient_groups`,
            fields: Object.keys(filters).map(m => {
                return {
                    type: "mrkdwn",
                    text: `*対象 ${m}*: ${filters[m].join(', ')}`
                }
            })
        }
    } else {
        return null
    }
}

/**
 * メール保存後にチャットとして投稿するメッセージ
 * @param email 
 * @returns 
 */
export const getSlackChatMessage = (email: Email) => {

    const blocks = []
    blocks.push(createMailTitle(email))
    blocks.push(createMailMessage(email))
    blocks.push(createEventNameMessage(email))
    const receipients = createReceipientsField(email)
    if (receipients) {
        blocks.push(receipients)
    }

    // "pending / approved / sending / expanded / sent / aborted"
    switch (email.status) {
        case "pending":
            blocks.push(createCreateddMessage(email))
            if (email.edited_by) {
                blocks.push(createEditedMessage(email))
            }
            if (email.schedule) {
                blocks.push(createScheduleMessagae(email))
            }
            blocks.push(createActions(email))
            break;
        case "approved":
            blocks.push(createApprovedMessage(email))
            blocks.push(createScheduleMessagae(email))
            blocks.push(createActions(email))
            break;
        case "sending":
            blocks.push(createApprovedMessage(email))
            blocks.push(createScheduleMessagae(email))
            break;
        case "expanded":
            blocks.push(createSentMessage(email))
            break;
        case "sent":
            blocks.push(createSentMessage(email))
            break;
        case "aborted":
            blocks.push(createCreateddMessage(email))
            blocks.push(createAbortedMessage(email))
            blocks.push(createActions(email))
            break;
        default:
            break;
    }
    return {
        channel: email.approval_channel,
        ts: email.approval_thread_ts,
        text: `<@${email.created_by}>さんのメール承認依頼`,
        blocks
    }
}

// Slack Oauth Token ============

/**
 * Slack Oauth Token を取得する。
 * tenant_idからbot_tokeを取得する
 * @param tenant_id 
 * @param supabase 
 * @returns 
 */
export const getSlackOauthTokenByTenantId = async (tenant_id: string, supabase: SupabaseClient): Promise<string> => {
    const { data: slackOauthTokens, error } = await supabase.from('slack_workspaces').select('bot_token').eq('tenant_id', tenant_id).maybeSingle()
    if (error) {
        let message = ''
        if (error instanceof Error) {
            message = error.message
        } else if (typeof error === 'string') {
            message = error
        } else {
            console.error('不明なエラー', error)
        }
        console.error('getSlackOauthTokenByTenantId: bot_token 取得失敗', error)
        throw new Error(`getSlackOauthTokenByTenantId: bot_token 取得失敗: tenant_id: ${tenant_id}: ${error.message}`)
    }
    if (slackOauthTokens) {
        return slackOauthTokens.bot_token
    } else {
        throw new Error(`getSlackOauthTokenByTenantId: tokenがありませんでした。tenant_id: ${tenant_id}`)
    }
}

/**
 * Slack Oauth Token を取得する。
 * team idから bot_tokenとtenant_idを取得する
 * @param teamId 
 * @param supabase 
 * @returns 
 */
type SlackOauthTokenByTeamId = {
    result: boolean
    bot_token: string
    tenant_id: string
}
export const getSlackOauthTokenByTeamId = async (teamId: string, supabase: SupabaseClient): Promise<SlackOauthTokenByTeamId> => {
    const ret_val = <SlackOauthTokenByTeamId>{}
    const { data: slackOauthTokens, error } = await supabase.from('slack_workspaces').select('tenant_id, bot_token').eq('team_id', teamId).maybeSingle()
    ret_val.result = true
    if (error) {
        console.error('getSlackOauthTokenByTeamId error', error.message)
        ret_val.result = false
    }
    if (!slackOauthTokens) {
        console.error('getSlackOauthTokenByTeamId: slackOauthTokens is null', slackOauthTokens)
        ret_val.result = false
    } else {
        ret_val.tenant_id = slackOauthTokens.tenant_id
        if (!slackOauthTokens.bot_token) {
            console.error('getSlackOauthTokenByTeamId: slackOauthTokens.bot_token is null', slackOauthTokens)
            ret_val.result = false
        } else {
            ret_val.bot_token = slackOauthTokens.bot_token
        }
    }
    return ret_val
}
// export for test

export const __slack_test__ = {
    getEvetnFilter,
    getTextBlock,
    getSelectBlock,
    getMultiSelectBlocks,
    getExSelectBlocks
}