/**
 * POST /api/sync-eventdata
 * 
 * イベントシートを読み込む
 * 
 */
import { google } from 'googleapis'
import { Database, Json } from '~/types/database.types.ts'
import { serverSupabaseUser, serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createGoogleAuth } from '#shared/utils/googleapi.ts'
import * as XLSX from 'xlsx'

export default defineEventHandler(async event => {

    const { tenantId } = await readBody(event)
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

    for (const eventConfig of eventConfigs) {
        if (eventConfig.sheet_id == null) {
            console.warn('sync-eventdata: eventConfig.sheet_id is null. data skipped.')
            continue
        }
        const fileMetadata = await drive.files.get({
            fileId: eventConfig.sheet_id,
            fields: 'mimeType, name'
        })

        const mimeType = fileMetadata.data.mimeType

        if (mimeType == 'application/vnd.google-apps.spreadsheet') {
            // Google spreadsheet
            const eventData = await readEvent(eventConfig, sheets)
            if (eventData == undefined) {
                console.warn('sync-eventdata: eventData is undefined. data skipped.')
                continue
            }
            const { data: dataResult, error: dataErr } = await userClient.rpc('sync_event_data', {
                p_tenant_id: tenantId,
                p_event_name: eventConfig.event_name,
                p_rows: eventData as Json,
            })
            if (dataErr) {
                console.error('sync-eventdata: rpc(sync_event_data) dataErr', dataErr)
                throw createError({ statusCode: 400, message: dataErr.message })
            }
        } else if (mimeType == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            // Excel
            const fileResponse = await drive.files.get(
                { fileId: eventConfig.sheet_id, alt: 'media' },
                { responseType: 'arraybuffer' }
            ) as any
            const wb = XLSX.read(new Uint8Array(fileResponse.data), { type: 'array' })
            if(eventConfig.sheet_name==null){
                console.error('sync-eventdata: eventConfig.sheet_name is null')
                continue
            }
            if(eventConfig.header==null){
                console.error('sync-eventdata: eventConfig.header is null')
                continue
            }
            const ws = wb.Sheets[eventConfig.sheet_name]
            if(ws==undefined){
                console.error('sync-eventdata: worksheet is undefined', eventConfig.sheet_name)
                continue
            }
            const sheetData = XLSX.utils.sheet_to_json(ws, { range: eventConfig.header - 1 }) as Record<string,any>[]
            const eventData = readEventFromJson(sheetData, eventConfig)
            const { data: dataResult, error: dataErr } = await userClient.rpc('sync_event_data', {
                p_tenant_id: tenantId,
                p_event_name: eventConfig.event_name,
                p_rows: eventData as Json,
            })
            if (dataErr) {
                console.error('dataErr', dataErr)
                throw createError({ statusCode: 400, message: dataErr.message })
            }
        } else {
            console.error('mimeType error: unknown document format', mimeType)
            throw createError({
                statusCode: 400,
                message: `対応していないファイル形式です(MIME: ${mimeType})`
            })
        }
    }

})