import type { SupabaseClient } from '@supabase/supabase-js'
import type { Email, EmailInsert } from '#shared/types'
import { DateTime } from 'luxon'

/**
 * supabaseからsign outする
 * @param supabase 一般ユーザのclient
 * @returns 
 */
export const supabaseSignOut = async (supabase: SupabaseClient) => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('signOut error', error.message)
    return true
}

/**
 * イベント設定を取得する
 * @param supabase 一般ユーザ supabaseClient
 * @returns 
 */
export const getEventConfigs = async (supabase: SupabaseClient) => {
    const { data, error } = await supabase
        .from('event_config')
        .select("*").order('eventName')
    if (!error && data) {
        return data
    } else {
        console.error('error', error.message)
        throw new Error('イベント設定を取得できませんでした')
    }
}

/**
 * イベントデータを取得する
 * @param tenantId
 * @param eventNames 
 * @param selectedFilters 
 * @param offset
 * @param limit
 * @param supabase 
 * @returns 
 */
export const getEventDatas = async (tenantId: string, eventNames: string[], selectedFilters: any, offset: number, limit: number, supabase: SupabaseClient) => {
    let query = supabase.from('event_data').select().eq('tenant_id', tenantId)
    if (eventNames && eventNames.length > 0) {
        query = query.in('event_name', eventNames)
    }
    if (selectedFilters) {
        for (const key of Object.keys(selectedFilters)) {
            const stringValues = selectedFilters[key].map(String)
            query = query.in(`event_attr->>"${key}"`, stringValues)
        }
    }
    const range_to = offset + limit - 1
    const { data, error } = await query.order('event_name').order('numerical_data_id').order('data_id').range(offset, range_to)
    if (!error && data) {
        return data
    } else {
        console.error('error', error.message)
        throw new Error('イベントデータを取得できませんでした')
    }
}

/**
 * 指定した条件のレコード数を取得する
 * @param eventNames 
 * @param selectedFilters 
 * @param supabase 
 * @returns 
 */
export const getEventDataCount = async (eventNames: string[], selectedFilters: any, supabase: SupabaseClient) => {
    let query = supabase.from('event_data').select('*', { count: 'exact', head: true })
    if (eventNames && eventNames.length > 0) {
        query = query.in('event_name', eventNames)
    }
    if (selectedFilters) {
        for (const key of Object.keys(selectedFilters)) {
            const stringValues = selectedFilters[key].map(String)
            query = query.in(`event_attr->>"${key}"`, stringValues)
        }
    }
    const { count, error } = await query.order('event_name').order('data_id')
    if (!error) {
        return count as number
    } else {
        console.error('error', error.message, count)
        throw new Error('イベントデータ数を取得できませんでした')
    }
}

/**
 * イベントテーブルからイベント名の一覧を取得する
 * @param tenantId uuid
 * @param supabase supabaseClient
 * @returns 
 */
export const getEventNames = async (tenantId: string, supabase: SupabaseClient): Promise<string[]> => {
    // supabase-jsにDISTINCTはないのでサーバ関数として作成し呼び出す
    const { data, error } = await supabase.rpc('get_event_names', { p_tenant_id: tenantId, p_team_id: null })
    if (error) {
        console.error('getEventNames: error', error.message)
        throw new Error('イベント名一覧の取得に失敗しました。')
    }
    return data
}

/**
 * イベントに対する埋込み用文字列を取得する
 * @param eventName 
 * @param supabase 
 * @returns ["変数名", "変数名", ...]
 */
export const getEmbededVarNames = async (tenantId: string, eventName: string, supabase: SupabaseClient) => {
    const { data, error } = await supabase.from('event_config').select('embeded_columns')
        .eq('tenant_id', tenantId)
        .eq('event_name', eventName)
        .maybeSingle()
    if (error) {
        console.error('getEmbededVarNames error', error.message)
        throw new Error(`getEmbededVarNames: 埋込みマーカー名を取得できませんでした: ${error.message}`)
    }
    console.log('embeded_columns', data?.embeded_columns)
    return data?.embeded_columns
}

/**
 * イベントに対する宛先グループと選択肢を取得する
 * ロジックはsupabase rpc側
 * @param tenantId
 * @param eventName イベント名
 * @param supabase supabaseClient
 * @returns [{column_name: "選択肢名", column_values: ["値1", "値2"]}]
 */
export const getReceipientGroupMenuData = async (tenantId: string, eventName: string, supabase: SupabaseClient) => {
    const { data, error } = await supabase.rpc('get_event_filters', { p_tenant_id: tenantId, p_team_id: null, p_event_name: eventName })
    if (error) {
        console.error('getReceipientGroupMenuData error', error.message)
        throw new Error(`getReceipientGroupMenuData: 宛先グループ選択肢を取得できませんでした: ${error.message}`)
    }
    return data as { column_name: string, column_values: string[] }[]
}

/**
 * イベント・宛先グループに対応する選択値を取得する
 * @param eventName イベント名
 * @param eventFilterName 宛先グループ名 (学年、組 等)
 * @param supabase supabaseClient
 * @returns ["選択肢値1", "選択肢値2"]
 */
export const getReceipientGroupValues = async (eventName: string, eventFilterName: string, supabase: SupabaseClient) => {
    const { data, error } = await supabase.rpc('get_event_filter_values', { target_event_name: eventName, target_key: eventFilterName })
    if (error) {
        console.error('getReceipientGroupValues error', error.message)
        throw new Error('宛先グループ向けの選択値を取得できませんでした')
    }
    return data
}

/**
 * emailをupsertする
 * @param email 
 * @param supabase 
 * @returns 
 */
export const saveEmail = async (email: EmailInsert, supabase: SupabaseClient): Promise<Email> => {
    const { data, error } = await supabase.from('emails').upsert(email, { onConflict: 'email_id' }).select().single()
    if (error) {
        console.error('saveEmail error', error.message)
    }
    return data
}

/**
 * emailを取得する
 * @param email_id 
 * @param supabase 
 * @returns 
 */
export const getEmail = async (email_id: string, supabase: SupabaseClient): Promise<Email> => {
    const { data, error } = await supabase.from('emails').select().eq('email_id', email_id).single()
    if (error) {
        console.error('getEmail error', error.message)
    }
    return data
}

/**
 * emailを取得する(channel id, ts)。コピー新規向けを想定
 * @param tenantId
 * @param channelId 
 * @param ts 
 * @param supabase 
 * @returns 
 */
export const getEmailByTs = async (tenantId: string, channelId: string, ts: string, supabase: SupabaseClient): Promise<Email> => {
    const { data, error } = await supabase.from('emails').select()
        .eq('tenant_id', tenantId)
        .eq('approval_channel', channelId)
        .eq('approval_thread_ts', ts).maybeSingle()
    if (error) {
        console.error('getEmailByTs: error', error)
        console.error('getEmailByTs: tenantId', tenantId)
        console.error('getEmailByTs: channelId', channelId)
        console.error('getEmailByTs: ts', ts)
        throw new Error(`getEmailByTs: ${error.message}`)
    }
    return data
}

/**
 * メールサーバ設定を取得する
 * @param supabase 
 * @returns 
 */
export const getMailServerConfig = async (supabase: SupabaseClient) => {
    const { data, error } = await supabase.from('mail_server').select().order('id')
    if (!error) {
        return data
    } else {
        console.error('getMailServerConfig: error', error)
        throw new Error('メールサーバ設定を取得できませんでした')
    }
}

/**
 * メールサーバー設定を更新する
 * @param serverConfig 
 * @param supabase 
 * @returns 
 */
export const updateMailServerConfig = async (serverConfig: MailServerConfig, supabase: SupabaseClient) => {
    if (serverConfig.available) {
        // 他のサーバを未使用にする
        await supabase.from('mail_server').update({ available: false }).eq('available', true)
    }
    if (!serverConfig.id) {
        // new
        const { id, ...payload } = serverConfig
        const { data, error } = await supabase.from('mail_server').insert(payload)
        if (!error) {
            return data
        } else {
            console.error('updateMailServerConfig(insert): error', error.message)
            throw new Error('メールサーバ設定を追加できませんでした(insert)')
        }
    } else {
        // upsert
        const { data, error } = await supabase.from('mail_server').upsert(serverConfig, { onConflict: 'id' })
        if (!error) {
            return data
        } else {
            console.error('updateMailServerConfig(upsert): error', error.message)
            throw new Error('メールサーバ設定を更新できませんでした(upsert)')
        }
    }
}

/**
 * 指定したIDのレコードのみavailable=trueとする
 * @param id 
 * @param supabase 
 */
export const changeServerAvailable = async (id: string, supabase: SupabaseClient) => {
    await supabase.from('mail_server').update({ available: false }).neq('id', id)
    await supabase.from('mail_server').update({ available: true }).eq('id', id)
}

/**
 * 指定したIDのレコードを削除する
 * @param id 
 * @param supabase 
 */
export const deleteServerConfig = async (id: string, supabase: SupabaseClient) => {
    await supabase.from('mail_server').delete().eq('id', id)
}

/**
 * メールアカウント設定を取得する
 * @param supabase 
 * @returns 
 */
export const getMailAccounts = async (supabase: SupabaseClient) => {
    const { data, error } = await supabase.from('mail_account').select().order('id')
    if (error) {
        console.error('getMailAccounts: error', error.message)
        throw new Error('メールアカウント設定を取得できませんでした')
    }
    return data
}

/**
 * メールアカウント設定を更新する
 * @param mailAccount 
 * @param supabase 
 * @returns 
 */
export const updateMailAccount = async (mailAccount: MailAccountInsert, supabase: SupabaseClient) => {
    if (mailAccount.default) {
        // default on -> 他のデータのdefaultをすべてoffにする
        const { data, error } = await supabase.from('mail_account').update({ default: false }).eq('default', true)
    }
    if (!mailAccount.id) {
        // new
        const { id: _id, ...mailAccountInsert } = mailAccount
        const { data, error } = await supabase.from('mail_account').insert(mailAccountInsert)
        if (!error) {
            return data
        } else {
            console.error('updateMailAccount: error(insert)', error.message)
            throw new Error('メールアカウント設定を追加できませんでした(insert)')
        }
    } else {
        // upsert
        const { data, error } = await supabase.from('mail_account').upsert(mailAccount, { onConflict: 'id' })
        if (!error) {
            return data
        } else {
            console.error('updateMailAccount(upsert): error', error.message)
            throw new Error('メールアカウント設定を更新できませんでした(upsert)')
        }
    }
}

/**
 * メールアカウントの既定値を変更する
 * @param id 
 * @param supabase 
 */
export const changeMailAccountDefault = async (id: string, supabase: SupabaseClient) => {
    await supabase.from('mail_account').update({ default: false }).neq('id', id)
    await supabase.from('mail_account').update({ default: true }).eq('id', id)
}

/**
 * 指定したIDのメールアカウント設定を削除する
 * @param id 
 * @param supabase 
 */
export const deleteMailAccount = async (id: string, supabase: SupabaseClient) => {
    await supabase.from('mail_account').delete().eq('id', id)
}

/**
 * 送信したメールの受信状態を受信済みにする。(受信者からの確認リンククリック)
 * @param trackingToken 
 * @param supabase 
 * @returns 更新後レコード
 */
export const updateReceiveStatusToReceived = async (trackingToken: string, supabase: SupabaseClient): Promise<SentEmail> => {
    const received = {
        received: true,
        receive_checked_at: DateTime.now().toISO()
    }
    const { data, error } = await supabase.from('sent_emails').update(received).eq('tracking_token', trackingToken).select().maybeSingle()
    if (error) {
        console.error('updateReceiveStatusToReceived: 受信チェック更新失敗', error.message)
        throw error
    }
    if (!data || !data.email_id) {
        console.error('updateReceiveStatusToReceived: 受信したメールのIDを取得できませんでした', JSON.stringify(data, null, 2))
        throw new Error('updateReceiveStatusToReceived: 受信したメールのIDを取得できませんでした')
    }
    return data
}

/**
 * 送信したメールの受信件数を取得する
 * @param emailId 
 * @param supabase 
 * @returns 
 */
export const getNumberOfReceived = async (emailId: string, supabase: SupabaseClient): Promise<number> => {
    const { count, error } = await supabase.from('sent_emails').select('*', { count: 'exact', head: true }).eq('email_id', emailId).eq('received', true)
    if (error) {
        console.error('getNumberOfReceived: 受信件数取得失敗', error.message)
        throw error
    }
    if (count == null) {
        console.error('getNumberOfReceived: 受信件数がnull')
        throw error
    }
    return count

}

/**
 * 受信件数を更新する(emails)
 * @param emailId 
 * @param count 
 * @param supabase 
 * @returns 
 */
export const updateNumberOfReceived = async (emailId: string, count: number, supabase: SupabaseClient): Promise<Email> => {
    const { data, error } = await supabase.from('emails').update({ num_of_received: count }).eq('email_id', emailId).select().single()
    if (error) {
        console.error('updateNumberOfReceived: 受信件数更新失敗', error.message)
        throw error
    }
    return data
}

/**
 * テナントのブランド情報を取得する
 * @param tenantId 
 * @param supabase 
 * @returns 
 */
export const getTenantInfoByTenantId = async (tenantId: string, supabase: SupabaseClient): Promise<{ brand_name: string, brand_icon_url: string }> => {
    const { data, error } = await supabase.from('tenants').select('brand_name, brand_icon_url').eq('tenant_id', tenantId).single()
    if (error) {
        console.error('getTenantInfoByTrackingToken: テナント情報取得失敗', error.message)
        throw error
    }
    return data
}

/**
 * イベントから例として1レコード取得する
 * 
 * @param tenantId 
 * @param eventName 
 * @param supabase 
 * @returns 
 */
export const getSampleEventData = async (tenantId: string, eventName: string, supabase: SupabaseClient) => {
    const { data, error } = await supabase.from('event_data').select('embeded_values')
        .eq('tenant_id', tenantId)
        .eq('event_name', eventName)
        .limit(1).maybeSingle()
    if (error) {
        console.error('getSampleEventData: error', error.message)
        throw new Error(`getSampleEventData: ${error.message}`)
    }
    return data
}

/**
 * メンバーリストシートのIDを取得する
 * @param tenantId 
 * @param supabase 
 * @returns 
 */
export const getMemberListSheetId = async (tenantId: string, supabase: SupabaseClient): Promise<string> => {
    const { data, error } = await supabase.from('members_sheet_config').select('sheet_id')
        .eq('tenant_id', tenantId).maybeSingle()
    if (error) {
        console.error('getMemberListSheetId: error', error.message)
        throw new Error(`getMemberListSheetId: ${error.message}`)
    }
    return data?.sheet_id ?? ''
}