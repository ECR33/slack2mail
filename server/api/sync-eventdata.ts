/**
 * POST /api/sync-eventdata
 * 
 * イベントシートを読み込む
 * 
 * body: { tenantId: string, eventNames?: string[] }
 *  - eventNames を指定した場合: そのイベントのみを読み込む
 *  - eventNames を省略または空配列にした場合: 全イベントを読み込む(従来の動作)
 * 
 * 戻り値: イベント単位の読込み結果
 *  { requestedAll, notFound, results: [{ event_name, status, rows, message }] }
 *  status: 'synced' | 'skipped' | 'error'
 * 
 * 1イベントの失敗は results に記録して他のイベントの読込みを継続します。
 * (Google Service Account未取得などの事前エラーは従来通り例外として返します)
 * 
 */
import { google } from 'googleapis'
import { Database, Json } from '~/types/database.types.ts'
import { serverSupabaseUser, serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createGoogleAuth } from '#shared/utils/googleapi.ts'
import * as XLSX from 'xlsx'
import type { SyncEventDataResult, SyncEventDataResponse } from '#shared/types/index.ts'

export default defineEventHandler(async event => {

    const body = await readBody(event)
    const tenantId = body?.tenantId
    const user = await serverSupabaseUser(event)
    if (!user) throw createError({ statusCode: 401 })

    const adminClient = serverSupabaseServiceRole<Database>(event)
    const { data: credentialJson, error: credErr } = await adminClient.rpc('get_tenant_google_credential', { p_tenant_id: tenantId })
    if (credErr || !credentialJson) {
        throw createError({ statusCode: 400, message: 'Google Service Accountが未設定です' })
    }

    const auth = await createGoogleAuth(credentialJson)
    const sheets = google.sheets({ version: 'v4', auth })
    const drive = google.drive({ version: 'v3', auth })

    const userClient = await serverSupabaseClient(event)

    const { data: eventConfigs, error } = await userClient.from('event_config').select().eq('tenant_id', tenantId)
    if (error) {
        console.error('error', error)
        throw createError({ statusCode: 400, message: error.message })
    }

    // 指定されたイベント名のみを対象にする(未指定・空配列の場合は全件)
    const { targets, requestedAll, notFound } = selectEventConfigs(eventConfigs, body?.eventNames)

    const results: SyncEventDataResult[] = []

    for (const eventConfig of targets) {

        if (eventConfig.sheet_id == null) {
            console.warn('sync-eventdata: eventConfig.sheet_id is null. data skipped.')
            results.push({ event_name: eventConfig.event_name, status: 'skipped', rows: 0, message: 'シートIDが未設定のためスキップしました' })
            continue
        }

        try {
            const fileMetadata = await drive.files.get({
                fileId: eventConfig.sheet_id,
                fields: 'mimeType, name'
            })

            const mimeType = fileMetadata.data.mimeType

            let eventData: Record<string, unknown>[]

            if (mimeType == 'application/vnd.google-apps.spreadsheet') {
                // Google spreadsheet
                const rows = await readEvent(eventConfig, sheets)
                if (rows == undefined) {
                    console.warn('sync-eventdata: eventData is undefined. data skipped.')
                    results.push({ event_name: eventConfig.event_name, status: 'skipped', rows: 0, message: 'シートを読み込めませんでした' })
                    continue
                }
                eventData = rows
            } else if (mimeType == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                // Excel
                const fileResponse = await drive.files.get(
                    { fileId: eventConfig.sheet_id, alt: 'media' },
                    { responseType: 'arraybuffer' }
                ) as any
                const wb = XLSX.read(new Uint8Array(fileResponse.data), { type: 'array' })
                if (eventConfig.sheet_name == null) {
                    console.error('sync-eventdata: eventConfig.sheet_name is null')
                    results.push({ event_name: eventConfig.event_name, status: 'skipped', rows: 0, message: 'シート名が未設定のためスキップしました' })
                    continue
                }
                if (eventConfig.header == null) {
                    console.error('sync-eventdata: eventConfig.header is null')
                    results.push({ event_name: eventConfig.event_name, status: 'skipped', rows: 0, message: 'ヘッダー行番号が未設定のためスキップしました' })
                    continue
                }
                const ws = wb.Sheets[eventConfig.sheet_name]
                if (ws == undefined) {
                    console.error('sync-eventdata: worksheet is undefined', eventConfig.sheet_name)
                    results.push({ event_name: eventConfig.event_name, status: 'skipped', rows: 0, message: `シート「${eventConfig.sheet_name}」が見つかりませんでした` })
                    continue
                }
                const sheetData = XLSX.utils.sheet_to_json(ws, { range: eventConfig.header - 1 }) as Record<string, any>[]
                eventData = readEventFromJson(sheetData, eventConfig)
            } else {
                console.error('mimeType error: unknown document format', mimeType)
                results.push({ event_name: eventConfig.event_name, status: 'error', rows: 0, message: `対応していないファイル形式です(MIME: ${mimeType})` })
                continue
            }

            const { data: dataResult, error: dataErr } = await userClient.rpc('sync_event_data', {
                p_tenant_id: tenantId,
                p_event_name: eventConfig.event_name,
                p_rows: eventData as Json,
            })
            if (dataErr) {
                console.error('sync-eventdata: rpc(sync_event_data) dataErr', dataErr)
                results.push({ event_name: eventConfig.event_name, status: 'error', rows: 0, message: dataErr.message })
                continue
            }

            results.push({
                event_name: eventConfig.event_name,
                status: 'synced',
                rows: eventData.length,
                message: dataResult?.length ? `更新${dataResult.filter(r => r.action === 'synced').length}件/削除${dataResult.filter(r => r.action === 'removed').length}件` : undefined
            })
        } catch (e) {
            console.error('sync-eventdata: failed to load event', eventConfig.event_name, e)
            results.push({
                event_name: eventConfig.event_name,
                status: 'error',
                rows: 0,
                message: e instanceof Error ? e.message : String(e)
            })
        }
    }

    const response: SyncEventDataResponse = { requestedAll, notFound, results }
    return response

})
