import type { sheets_v4 } from "googleapis"

/**
 * 埋め込み文字列をパースする 'ここを ((( 変数名 ))) 置き換えます'
 * @param body 
 * @param vars {変数名: 値, ...}
 * @returns 
 */
export const parseEmbeded = (body: string, vars: any) => {
    const replaced = body.replace(/\(\(\(\s*(.*?)\s*\)\)\)/g, (match, key) => {
        return vars[key] !== undefined ? vars[key] : match;
    }).replace(/（（（\s*(.*?)\s*）））/g, (match, key) => {
        return vars[key] !== undefined ? vars[key] : match;
    })
    return replaced
}

/**
 * Google Spreadsheetから読み出した配列をjson形式に変換する
 * @param rows 行の配列
 * @returns json形式の配列データ
 */
export const sh2json = (rows: any[][], header: number) => {
    // データが空、または行（ヘッダーのみ: headerの値）の場合は空配列を返す
    if (!rows || rows.length <= header) {
        return []
    }

    // 2. header行目（インデックス(header-1)）をヘッダー（JSONのキー名）として切り出す
    // 例: ['id', 'name', 'email']
    const headers = rows[header - 1] || [] as string[]

    // 3. header+1行目以降のデータ行をループ処理して、動的にJSONオブジェクトに変換する
    const jsonResult = rows.slice(header).map((row) => {
        const rowObject: Record<string, any> = {}

        headers.forEach((header_name: string, index: number) => {
            // スプレッドシートの右側に空セルがある場合、配列の長さが足りなくなるのを防ぐ
            const cellValue = row[index] !== undefined ? row[index] : null

            // 1行目の項目名をキーにして、セルの値を代入
            rowObject[header_name] = cellValue
        })

        return rowObject
    })

    // 4. 完成したJSON配列を返却する
    return jsonResult
}


/**
 * 
 * @param url Google SpreadsheetのURLからspreadsheetのIDを抽出する
 * @returns spreadsheetのID
 */
const getSheetId = (url: string) => {
    const matches = (url.match(/^.*\/spreadsheets\/d\/(.*)\/.*$/)) ?? []
    return matches[1] || ""
}

/**
 * slack2mail設定ファイルの1イベント(1シート)からフィルターに使用するカラム名を取得する
 * @param eventConfigs slack2mail設定ファイルの内容
 * @returns フィルターに使用するカラム名の配列
 */
const getFilterColumns = (eventConfigs: any[]): string[] => {
    const filterColumns: string[] = []
    eventConfigs.forEach(f => {
        if (f['宛先グループ列名']) {
            filterColumns.push(f['宛先グループ列名'])
        }
    })
    return filterColumns
}

/**
 * slack2mail設定ファイルの1イベント(1シート)から埋め込みに使用するカラム名を取得する
 * @param eventConfigs slack2mail設定ファイルの内容
 * @returns 埋め込みに使用するカラム名の配列
 */
const getEmbededColumns = (eventConfigs: any[]): string[] => {
    const embededColumns: string[] = []
    eventConfigs.forEach(f => {
        if (f['埋込み項目列名']) {
            embededColumns.push(f['埋込み項目列名'])
        }
    })
    return embededColumns
}

const getIncludeFlgColumnValues = (eventConfigs: any[]): string[] => {
    const includeFlgColumnValues: string[] = []
    eventConfigs.forEach(f => {
        if (f['読込判定値']) {
            includeFlgColumnValues.push(f['読込判定値'])
        }
    })
    return includeFlgColumnValues
}

/**
 * シートからフィルターカラムのデータを抽出してevent_filter形式のデータを作成する
 * @param eventId event_namesテーブルのid
 * @param filterColumns getFilterColumnsで取得したカラム名の配列
 * @param emailColumn eventConfigにて指定されたメールアドレスが格納されているカラム名
 * @param eventSheet イベントシートから読み出しsh2jsonで整形したjson object
 * @returns event_filterテーブルに登録できるjsonデータ
 */
const createEventData = (eventId: number, filterColumns: string[], emailColumn: string, eventSheet: Record<string, any>[]) => {

    // EventFilterRow.id is managed by DB, so here we build objects without 'id'
    const result: Omit<EventFilterRow, 'id'>[] = []
    // const result = Array<EventFilterRow>
    filterColumns.forEach(f => {
        const row = eventSheet.map(m => {
            return {
                event_name_id: eventId,
                column_name: f,
                column_value: m[f],
                event_email_addr: m[emailColumn]
            }
        })
        result.push(...row)
    })

    return result
}

/**
 * slack2mail設定ファイルを読み込みイベント設定を取得する
 * @param googleSlack2mailConfigSheetId slac2mail設定ファイルのID
 * @param googleSpreadsheetClient Google Spreadsheetを読み出すAPI
 * @returns eventConfis: EventConfig[]
 */
export const getSlack2mailConfig = async (googleSlack2mailConfigSheetId: string, googleSpreadsheetClient: sheets_v4.Sheets): Promise<globalThis.EventConfig[]> => {
    //NUXT_PUBLIC_GOOGLE_SLACK2MAIL_CONFIG_SHEET_ID
    const metadataResponse = await googleSpreadsheetClient.spreadsheets.get({ spreadsheetId: googleSlack2mailConfigSheetId })
    const sheetsMetadata = metadataResponse.data.sheets
    if (!sheetsMetadata) {
        throw new Error('シートが見つかりませんでした。')
    }
    const sheetNames = sheetsMetadata.map(m => m.properties?.title).filter((title): title is string => !!title)
    // シートを順番に読み込み
    const eventConfigs: EventConfig[] = []
    for (const sheetName of sheetNames) {
        const response = await googleSpreadsheetClient.spreadsheets.values.get({ spreadsheetId: googleSlack2mailConfigSheetId, range: `${sheetName}!A:Z` })
        if (!response || !response.data || !response.data.values) {
            continue
        }
        const sheetobj = sh2json(response.data.values, 1)
        if (!sheetobj || !sheetobj[0]) {
            continue
        }
        const filterColumns = getFilterColumns(sheetobj)
        const embededColumns = getEmbededColumns(sheetobj)
        const includeFlgColumnValues = getIncludeFlgColumnValues(sheetobj)
        const eventConfig: EventConfig = {
            tenant_id: '',
            event_name: sheetName,
            sheet_id: getSheetId(sheetobj[0]['シートURL']),
            sheet_name: sheetobj[0]['シート名'],
            header: parseInt(sheetobj[0]['ヘッダー行番号']),
            id_column: sheetobj[0]['ID列名'],
            email_column: sheetobj[0]['メールアドレス列名'],
            filter_columns: filterColumns,
            embeded_columns: embededColumns,
            include_flg_column_name: sheetobj[0]['読込判定列名'],
            include_flg_column_values: includeFlgColumnValues,
            sender_name: sheetobj[0]['送信者名'] ?? null,
            sender_email_addr: sheetobj[0]['送信者アドレス'] ?? null
        }
        eventConfigs.push(eventConfig)
    }
    return eventConfigs
}

// 値が数値に変換可能なら数値に、できなければそのまま文字列にする関数
const normalizeValue = (value: any): any => {
    if (value === null || value === undefined || value === '') {
        return value
    }
    // すでに数値の場合はそのまま
    if (typeof value === 'number') {
        return value
    }
    // 文字列で、かつ数値に変換できる場合（例: "1" -> 1）
    if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
        return Number(value)
    }
    return value
}

/**
 * シートオブジェクトからイベントデータ形式に変換する
 * data_idがnullのデータは除外する(データベースで)
 * @param sheetObj 
 * @param eventConfig 
 * @returns 
 */
export const readEventFromJson = (sheetObj: Record<string, any>[], eventConfig: EventConfig) => {
    // 必要なカラム名
    const filter_keys = [...(eventConfig.filter_columns as string[])]
    const embeded_keys = [...(eventConfig.embeded_columns as string[])]
    // 必要なカラムに絞って返却する
    const filter_col = eventConfig.include_flg_column_name
    const col_values = (eventConfig.include_flg_column_values as string[]).map(m => ('' + m))
    return sheetObj.filter(f => {
        if (!filter_col) {
            // include_flg_column_nameが指定されていない場合はすべて読み込む
            return true
        } else {
            // numberとstringの扱いが曖昧なため念の為どちらもstringにしてから比較している
            if (col_values.includes('' + f[filter_col])) {
                return true
            } else {
                return false
            }
        }
    }).map(m => {
        return {
            event_name: eventConfig.event_name,
            data_id: m[eventConfig.id_column ?? ''],
            email_addr: m[eventConfig.email_column ?? ''],
            event_attr: filter_keys.reduce((acc: Record<string, unknown>, key: string) => {
                if (key in m) {
                    acc[key] = normalizeValue(m[key])
                }
                return acc
            }, {}),
            embeded_values: embeded_keys.reduce((acc: Record<string, unknown>, key: string) => {
                if (key in m) {
                    acc[key] = normalizeValue(m[key])
                }
                return acc
            }, {})
        }

    }).filter(f => (f.data_id))

}

/**
 * イベント設定からイベントファイルを読み込みイベントデータを返却する
 * @param eventConfig イベント設定
 * @param googleSpreadsheetClient Google Spreadsheetを読み出すAPI
 * @returns EventData[]
 */
export const readEvent = async (eventConfig: EventConfig, googleSpreadsheetClient: sheets_v4.Sheets) => {
    if (!eventConfig.sheet_id || !eventConfig.header) {
        throw new Error('readEvent: eventConfigが正しくありませんでした')
    }
    const response = await googleSpreadsheetClient.spreadsheets.values.get({ spreadsheetId: eventConfig.sheet_id, range: `${eventConfig.sheet_name}!A:Z` })
    if (response.data.values) {
        const sheetobj = sh2json(response.data.values, eventConfig.header)
        return readEventFromJson(sheetobj, eventConfig)
    }
    return
}



// メンバーリストシート用

/**
 * Google Spreadsheetから役員シートを読み込みJsonオブジェクトを返却する
 * @param config メンバーシートに関する定義部分(members_sheet_configの値)
 * @param googleSpreadsheetClient Google Spreadsheetを読み出すAPI
 * @returns membersオブジェクト {email:string name:string}
 */
export const readMembersSheet = async (config: MembersSheetConfig, googleSpreadsheetClient: sheets_v4.Sheets) => {

    if (!config.sheet_id) {
        throw new Error('readMembersSheet: sheet_idがありませんでした')
    }
    const range = `${config.sheet_name}!A1:N50`
    const sheetResponse = await googleSpreadsheetClient.spreadsheets.values.get({
        spreadsheetId: config.sheet_id,
        range: range, // 1行目がヘッダー（email）で、2行目以降がデータ
        // valueRenderOption: 'UNFORMATTED_VALUE' // このオプションを指定しないと見た目(=string)で取得される
    })

    const rawRows = sheetResponse.data.values || []

    const members_raw = sh2json(rawRows, 1)

    const members = members_raw.filter(f => {
        const filter_col = config.filter_column_name ?? ''
        const col_values = config.filter_column_values as string[]
        // col_valuesはv-text-fieldから入力された値のため属性が判断できずすべてstringとなっている
        // そのためSpreadsheetの値を念の為stringに変換してから比較している
        if (col_values.includes('' + f[filter_col])) {
            return true
        } else {
            return false
        }
    }).map(m => {
        const row = {
            email: m[config.email_column_name ?? ''] as string,
            name: m[config.name_column_name ?? ''] as string
        }
        return row
    })

    return members
}


// Slackインタフェース用

export interface emails {
    subject: string
    body: string
    event_name: string
    event_filter: Array<EventFilter>
    status: string
    approval_count: number
    approval_border: number
    approved_by: string[]
    attachments: Buffer
    created_by: string
    created_at: Date
    team_id: string
    approval_channel: string
    approval_thread_ts: string
    schedule: Date
    sent_at: Date
    num_of_received: number
    num_of_sent: number
}


// テスト用export
export const __test__ = {
    getSheetId,
    createEventData,
    getFilterColumns,
}