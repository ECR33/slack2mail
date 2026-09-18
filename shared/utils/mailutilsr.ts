import nodemailer from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer/index.js'
import { ImapFlow, type ImapFlowOptions } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PostgrestError } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import type { Email, EmailInsert, EmailUpdate, SentEmailInsert } from '#shared/types'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

/**
 * IMAPを操作するクライアントを作成する
 * @param imapflowOptions
 * @returns imapclient
 */
export const createImapClient = async (imapflowOptions: ImapFlowOptions) => {

    const imapClient = new ImapFlow(imapflowOptions)
    return imapClient
}

export type MailMessage = {
    from: string
    to: string
    subject: string
    text: string
    replyTo: string
}


/**
 * IMAP Sentフォルダを取得する。なければ作成する
 * @param imapClient 
 * @returns 
 */
export const getSentFolder = async (imapClient: ImapFlow) => {
    const mailboxes = await imapClient.list()
    const sentFolderObject = mailboxes.find(box => box.specialUse && box.specialUse.toLowerCase() === '\\sent')

    let targetFolder: string

    if (sentFolderObject) {
        targetFolder = sentFolderObject.path
        // console.info('Sent folder found.', targetFolder)
    } else {
        targetFolder = 'Sent'
        try {
            await imapClient.mailboxCreate(targetFolder)
        } catch (error: any) {
            if (error.responseText == 'CREATE failed. Mailbox Sent already exists.') {
                // 既にあるので無視
                console.warn('Sent folder already exist.')
            } else {
                console.error('getSentFolder: error', error)
                throw new Error('getSentFolder: Sent folder create error')
            }
        }
    }
    return targetFolder
}

/**
 * RFC822形式メッセージを作成する。send mailとimap.appendの両方に使用する
 * @param mailMessage 
 * @returns 
 */
export const createRawMessage = async (mailMessage: MailMessage) => {
    const composer = new MailComposer(mailMessage);
    let rawMessageBuffer
    try {
        rawMessageBuffer = await composer.compile().build()
    } catch (error) {
        let message = ''
        if (error instanceof Error) {
            message = error.message
        } else if (typeof error === 'string') {
            message = error
        } else {
            console.error('不明なエラー', error)
        }
        console.error('createRawMessage: appendMessage composer.compile error', message)
        throw error
    }
    return rawMessageBuffer
}

/**
 * Message-IDを取得する。(送信時の情報としてデータベースに保管する)
 * @param rawMessageBuffer 
 * @returns 
 */
export const getMessageId = async (rawMessageBuffer: Buffer<ArrayBufferLike>) => {
    try {
        const parsed = await simpleParser(rawMessageBuffer)
        return parsed.messageId
    } catch (error) {
        let message = ''
        if (error instanceof Error) {
            message = error.message
        } else if (typeof error === 'string') {
            message = error
        } else {
            console.error('不明なエラー', error)
        }
        console.error('getMessageId: Message-IDの抽出に失敗しました', message)
        throw error
    }
}

/**
 * メールの受信確認用リンクを作成する
 * @param app_url 
 * @param event_mail_id ULID (12桁のユニークID), tracking_token
 * @returns 
 */
export const getTrailerLink = (app_url: string, event_mail_id: string) => {
    return `\n\n\n※受信確認\n　メールを受信されたら以下のリンクをクリックしてください。\n　${app_url}/received?id=${event_mail_id}`
}

/**
 * 送信済みメールの保管・更新
 * @param email_status 
 * @param supabase 
 */
export const upsertSentMail = async (email_status: SentEmailInsert, supabase: SupabaseClient) => {
    const { data, error } = await supabase.from('sent_emails').upsert(email_status, { onConflict: 'tracking_token' })
    if (error) {
        console.error('upsertSentMail: 送信済みメールの更新に失敗しました', error.message)
        throw error
    }
}

/**
 * 指定したメールをIMAP Sentフォルダに格納する
 * @param rawMessageBuffer 
 * @param targetFolder 
 * @param imapClient 
 * @returns 
 */
export const appendMessage = async (rawMessageBuffer: Buffer<ArrayBufferLike>, targetFolder: string, imapClient: ImapFlow) => {

    return await imapClient.append(targetFolder, rawMessageBuffer, ['\\Seen'])

}

/**
 * 送信したメール数を取得する
 * @param email_id 
 * @param supabase 
 * @returns 
 */
export const getNumberOfSent = async (email_id: string, supabase: SupabaseClient): Promise<number> => {
    const { count, error } = await supabase.from('sent_emails')
        .select('*', { count: 'exact', head: true })
        .eq('email_id', email_id)
        .eq('status', 'sent')
    if (error) {
        console.error('getNumberOfSent: 送信済みメール数の取得に失敗しました', error.message)
        throw error
    }
    return count
}

/**
 * サーバへの接続テスト(IMAP)
 * @param imapConfig 
 * @returns 
 */
export const validateImapConfig = async (imapflowOptions: ImapFlowOptions) => {
    const client = await createImapClient(imapflowOptions)
    try {
        await client.connect()
        await client.logout()
        return true
    } catch (e) {
        console.error('validateImapConfig', e)
        return false
    }
}

// =Send Mail===================

/**
 * 送信用サーバオブジェクトを作成する
 * @returns 
 */
export const createTransporter = (transportOptions: SMTPTransport.Options) => {
    const transporter = nodemailer.createTransport(transportOptions)
    return transporter
}

export const validateSmtpConfig = async (transportOptions: SMTPTransport.Options) => {
    const transporter = await createTransporter(transportOptions)
    try {
        await transporter.verify()
        return true
    } catch (e) {
        console.error('validateSmtpConfig', e)
        return false
    }
}

// =送信者関連情報=========

/**
 * メール送信に必要なオブジェクトと情報を返却する
 * @param tenant_id 
 * @param event_name 
 * @param supabase 
 * @returns transporter: Transporter, imapClient: ImapFlow, sender_mail_addr: 送信者のメールアドレス, sender_name: 送信者の名前
 */
export const getEmailClients = async (tenant_id: string, event_name: string, supabase: SupabaseClient) => {
    // 送信アカウント決定
    let sender_mail_addr = ''
    let sender_password = ''
    let sender_name = ''

    // イベントで指定されたメールアカウント
    const { data: event_config_sender, error: event_config_error } = await supabase.from('event_config')
        .select('sender_name, sender_email_addr')
        .eq('event_name', event_name)
        .eq('tenant_id', tenant_id).single()

    if (event_config_error) {
        throw new Error(`getEmailClients: event_config: ${event_config_error.message} : ${event_name} ${tenant_id}`)
    }

    // イベントで指定されたメールアカウントのアカウント情報
    const { data: user_mail_data, error: mail_account_error } = await supabase.from('mail_account')
        .select('name, email_addr, password')
        .eq('email_addr', event_config_sender.sender_email_addr)
        .eq('tenant_id', tenant_id).maybeSingle()

    if (mail_account_error) {
        throw new Error(`getEmailClients: mail_account(email_addr): ${mail_account_error.message} : ${event_config_sender.sender_email_addr} ${tenant_id}`)
    }

    // システムのデフォルトアカウント
    const { data: default_user, error: default_user_error } = await supabase.from('mail_account')
        .select('name, email_addr, password')
        .eq('default', true)
        .eq('tenant_id', tenant_id).single()

    if (default_user_error) {
        throw new Error(`getEmailClients: mail_account(default): ${default_user_error.message} : ${tenant_id}`)
    }

    // 値設定 event_config <- mail_account <- default account
    sender_name = event_config_sender.sender_name || user_mail_data?.name || default_user.name || '送信者未設定'
    sender_mail_addr = event_config_sender.sender_email_addr || user_mail_data?.email_addr || default_user.email_addr || 'info@example.com'
    sender_password = user_mail_data?.password || default_user.password || ''

    // メールサーバの情報
    const { data, error } = await supabase.from('mail_server')
        .select()
        .eq('available', true)
        .eq('tenant_id', tenant_id).single()

    if (error) {
        throw new Error(`getEmailClients: mail_server(available): ${error.message} : ${tenant_id}`)
    }

    // smtp
    const transportOptions: SMTPTransport.Options = {
        host: data.smtp_server,
        port: data.smtp_port,
        secure: data.smtp_secure,
        auth: {
            user: sender_mail_addr,
            pass: sender_password
        }
    }

    // imap
    const imapflowOptions: ImapFlowOptions = {
        host: data.imap_server,
        port: data.imap_port,
        secure: data.imap_secure,
        auth: {
            user: sender_mail_addr,
            pass: sender_password,
        },
        logger: false
    }
    // 送信メールサーバ作成(transporter)
    const transporter = createTransporter(transportOptions)

    // IMAPクライアント作成
    const imapClient = await createImapClient(imapflowOptions)

    return { transporter, imapClient, sender_mail_addr, sender_name }
}


// =送信メール=============

export type EmailResult = {
    result: boolean
    message: string
    emails: Email[] | null
}

/**
 * 送信対象となっているメール一覧を取得する((approved,expanded) & 時刻チェック)。
 * テナントに関わらずすべて。
 * @param supabase adminClient
 * @returns 
 */
export const getEmails = async (supabase: SupabaseClient): Promise<EmailResult> => {
    const { data: queueMails, error: fetchError } = await supabase.from('emails')
        .select()
        .or('status.eq.approved, status.eq.expanded')
        .lte('schedule', DateTime.now())

    if (fetchError) {
        return { result: false, message: fetchError.message, emails: null }
    }
    if (!queueMails || queueMails.length === 0) {
        return { result: false, message: 'getEmails: 展開・送信対象のメールはありませんでした。', emails: null }
    } else {
        return { result: true, message: '', emails: queueMails }
    }

    // TODO: sent_emails対応
    // 'approved'で送信予定時刻を過ぎたもの、および前回中断した'sending'を両方拾う
    // const nowIso = DateTime.now().toISO()
    // const { data: emails, error } = await supabase
    //     .from('emails')
    //     .select('*')
    //     .or(`and(status.eq.approved,schedule.lte.${nowIso}),status.eq.sending`)

    // if (error) {
    //     return { result: false, message: error.message, emails: null }
    // }
    // if (!emails || emails.length === 0) {
    //     return { result: false, message: '送信対象のメールはありません', emails: null }
    // }
    // return { result: true, message: '', emails }


}

function clean<T extends Record<string, any>>(obj: T): T {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    ) as T;
}

/**
 * emailテーブルを更新(upsert)する
 * @param email 
 * @param supabase 
 */
export const upsertEmail = async (email: EmailUpdate, supabase: SupabaseClient): Promise<Email> => {
    const { data, error } = await supabase.from('emails').upsert(clean(email), { onConflict: 'email_id' }).select().single()
    if (error) {
        const message = error.message
        console.error('upsertEmail: メールの更新に失敗しました', message)
        console.error('upsertEmail: メールの更新に失敗しました', JSON.stringify(email, null, 2))
        throw error
    }
    return data
}

/**
 * emailテーブルを更新(update)する
 * @param email 
 * @param supabase 
 * @returns 
 */
export const updateEmail = async (email: EmailUpdate, supabase: SupabaseClient): Promise<Email> => {
    const { data, error } = await supabase.from('emails').update(email).eq('email_id', email.email_id).eq('tenant_id', email.tenant_id).select().single()
    if (error) {
        console.error('updateEmail: メールの更新に失敗しました', error.message)
        console.error('updateEmail: メールの更新に失敗しました', JSON.stringify(email, null, 2))
        throw error
    }
    return data
}

export type FilterJson = {
    column_name: string
    column_value: string
}

// TODO: deprecated
export const getTargetEmails = async (tenant_id: string, event_name: string, filterJson: FilterJson[], supabase: SupabaseClient) => {
    // 宛先データ取得クエリ作成
    let query = supabase.from('event_data')
        .select('email_addr,embeded_values')
        .eq('event_name', event_name)
        .eq('tenant_id', tenant_id)

    // 1. column_name ごとにグループ化
    const groups: Record<string, string[]> = {};
    for (const c of filterJson) {
        if (!groups[c.column_name]) groups[c.column_name] = [];
        groups[c.column_name]?.push(c.column_value);
    }

    // 2. 各グループを OR 条件に変換
    const orBlocks = Object.entries(groups).map(([col, values]) => {
        const orList = values
            .map(v => `event_attr->>${col}.eq.${v}`)
            .join(",");
        return orList;
    });

    // 3. Supabase クエリに AND でつなぐ
    for (const block of orBlocks) {
        query = query.or(block);
    }

    const { data: email_addrs, error } = await query
    if (error) {
        console.error('getTargetEmails: email_data データ取得失敗', error.message)
        throw error
    }
    return email_addrs
}


// TODO: たぶん使わない
export const resolveEmailTargets = async (
    email: Email,
    supabase: SupabaseClient
): Promise<{ shouldProcess: boolean; targets: SentEmail[] }> => {

    console.log('email.status', email.status)

    if (email.status === 'approved') {
        // まだ展開されていない -> emailsレベルのclaim + sent_emails展開
        const { data, error } = await supabase.rpc('claim_and_expand_email_targets', {
            p_tenant_id: email.tenant_id,
            p_email_id: email.email_id,
            p_event_name: email.event_name,
            p_filter: email.event_filter,
        })
        if (error) throw error
        const result = data as { claimed: boolean }
        if (!result.claimed) {
            // 他の実行が既にemailsレベルでclaim済み
            return { shouldProcess: false, targets: [] }
        }
        // この時点ではsent_emailsは全て'approved'として挿入されているだけ。
        // 実際に送信してよいかは、次のclaim_pending_sent_targetsで改めて判定する
    } else if (email.status !== 'sending') {
        // 'sent'/'aborted'等は対象外
        return { shouldProcess: false, targets: [] }
    }

    // ここが唯一の「宛先ごとの送信可否」を決める場所。
    // email.statusが'approved'由来でも'sending'(前回中断)由来でも、
    // 経路を問わずこの1関数だけが宛先行を排他的にclaimする
    const { data: claimedTargets, error: claimError } = await supabase.rpc('claim_pending_sent_targets', {
        p_tenant_id: email.tenant_id,
        p_email_id: email.email_id,
    })
    console.log('claimError', claimError)
    console.log('claimedTargets', claimedTargets)
    // TODO: sent_eamils が sending ステータスで止まった場合リカバリされない
    if (claimError) throw claimError

    return { shouldProcess: true, targets: claimedTargets ?? [] }
}

/**
 * 登録されたメールを送信対象単位へ展開する
 * @param email 
 * @param supabase 
 * @returns 
 */
export const expandEmailTargets = async (email: Email, supabase: SupabaseClient): Promise<{ shouldProcess: boolean; targetLength: number }> => {
    console.log('email.status', email.status)

    let result = { claimed: false, targets: [] }
    if (email.status === 'approved') {
        // まだ展開されていない -> sent_emails展開
        const { data, error } = await supabase.rpc('claim_and_expand_email_targets', {
            p_tenant_id: email.tenant_id,
            p_email_id: email.email_id,
            p_event_name: email.event_name,
            p_filter: email.event_filter,
        })
        if (error) throw error
        result = data as { claimed: boolean, targets: [] }
        // この時点ではsent_emailsは全て'approved'として挿入されているだけ。
        // 実際に送信してよいかは、次のclaim_pending_sent_targetsで改めて判定する
    }
    return { shouldProcess: result.claimed, targetLength: result.targets.length }

}

/**
 * 指定されたemailの送信待ちデータ(sent_emails)を取得する
 * @param email 
 * @param supabase 
 * @returns 
 */
export const getWaitingEmails = async (email: Email, supabase: SupabaseClient): Promise<SentEmail[]> => {
    const { data: claimedTargets, error: claimError } = await supabase.rpc('claim_pending_sent_targets', {
        p_tenant_id: email.tenant_id,
        p_email_id: email.email_id,
    })
    if (claimError) throw claimError

    return claimedTargets ?? []
}

/**
 * 送信中状態で時間がたったもの(おそらく送信エラー)を抽出する。
 * 送信中(sending)のまま(sending_at)から15分たったものを抽出対象とする。
 * 100件ずつ抽出する
 * @param email 
 * @param supabase 
 * @returns 
 */
export const getTimeoutEmails = async (email: Email, supabase: SupabaseClient): Promise<SentEmail[]> => {
    const { data, error } = await supabase.from('sent_emails').select()
        .eq('email_id', email.email_id)
        .eq('tenant_id', email.tenant_id)
        .eq('status', 'sending')
        .lte('sending_at', DateTime.now().plus({ minutes: -15 }))
        .limit(100)
    if (error) {
        throw error
    }
    return data ?? []
}

export type SentEmailUpdate = Partial<Pick<SentEmail, 'status' | 'sent_at' | 'sending_at' | 'receive_checked_at' | 'received' | 'imap_written_at' | 'message_id'>>

/**
 * sent_emailsの既存行(tracking_tokenで特定)を部分更新する。
 * claim_and_expand_email_targets / claim_pending_sent_targets で
 * 既に行が作成・claim済みであることが前提のため、insertは行わずupdateのみ行う
 * @param tracking_token 更新対象の行を特定するキー
 * @param tenant_id RLSに関係なくservice_roleで呼ぶが、誤って他テナントの行を更新しないための二重チェック
 * @param updates 更新するカラムと値
 * @param supabase
 */
export const updateSentEmail = async (
    tracking_token: string,
    tenant_id: string,
    updates: SentEmailUpdate,
    supabase: SupabaseClient
) => {
    const { data, error } = await supabase
        .from('sent_emails')
        .update(clean(updates))
        .eq('tracking_token', tracking_token)
        .eq('tenant_id', tenant_id)
        .select()
        .single()

    if (error) {
        console.error('updateSentEmail: sent_emailsの更新に失敗しました', error.message, tracking_token)
        throw error
    }
    return data
}