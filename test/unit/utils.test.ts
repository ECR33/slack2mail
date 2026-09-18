import { describe, it, expect } from 'vitest'

import { sh2json } from '/shared/utils/index.ts'
import { readEvent, getSlack2mailConfig } from '/shared/utils/index.ts'
import { __test__ } from '/shared/utils/index.ts'
import { parseEmbeded } from '../../shared/utils'

describe('スプレッドシート変換テスト', () => {
    it('2次元配列がJsonへ変換されること', () => {
        const dummyRows = [
            ['name', 'email'],
            ['田中', 'tanaka@example.com'],
            ['鈴木', 'suzuki@example.com']
        ]

        const result = sh2json(dummyRows, 1)

        expect(result).toEqual([
            { name: '田中', email: 'tanaka@example.com' },
            { name: '鈴木', email: 'suzuki@example.com' }
        ])
    })
    it('2次元配列がJsonへ変換されること header行が2行目の場合', () => {
        const dummyRows = [
            ['タイトル', ''],
            ['name', 'email'],
            ['田中', 'tanaka@example.com'],
            ['鈴木', 'suzuki@example.com']
        ]

        const result = sh2json(dummyRows, 2)

        expect(result).toEqual([
            { name: '田中', email: 'tanaka@example.com' },
            { name: '鈴木', email: 'suzuki@example.com' }
        ])
    })
})

describe('イベントシートの読み込みテスト', () => {

    const _eventName = "会員一覧_2025"
    const _eventConfigSheet = [
        ["シートURL", "シート名", "ヘッダー行番号", "ID列名", "メールアドレス列名", "宛先グループ列名", "埋込み項目列名", "送信者名", "送信者アドレス"],
        ["https://docs.google.com/spreadsheets/d/1O7lTsLKtpEK5zl0IPUbiWAyG8afxQ55v/edit?gid=1428684260#gid=1428684260", "会員一覧", "2", "Seｑ", "メールアドレス\n（メイン）", "学年", "会員ID", "標準服リユース会", "soumu@example.com"],
        ["", "", "", "", "", "組", "保護者氏名１", "", ""]
    ]
    const _eventConfig_raw = [{
        シートURL: 'https://docs.google.com/spreadsheets/d/1O7lTsLKtpEK5zl0IPUbiWAyG8afxQ55v/edit?gid=1428684260#gid=1428684260',
        シート名: '会員一覧',
        ヘッダー行番号: '2',
        ID列名: 'Seｑ',
        メールアドレス列名: 'メールアドレス\n（メイン）',
        宛先グループ列名: '学年',
        送信者名: '標準服リユース会',
        送信者アドレス: 'soumu@example.com'
    }, {
        シートURL: '',
        シート名: '',
        ヘッダー行番号: '',
        ID列名: '',
        メールアドレス列名: '',
        宛先グループ列名: '組',
        送信者名: '',
        送信者アドレス: ''
    }]

    const _eventConfig = {
        eventName: _eventName,
        emailColumn: "メールアドレス\n（メイン）",
        filterColumns: ["学年", "組"],
        embededColumns: ["会員ID", "保護者氏名１"],
        header: 2,
        idColumn: "Seｑ",
        sheetId: "1O7lTsLKtpEK5zl0IPUbiWAyG8afxQ55v",
        sheetName: "会員一覧",
        senderName: "標準服リユース会",
        senderEmailAddr: "soumu@example.com"
    }

    const _spreadsheet_raw = [
        ["タイトル行", "", "", ""],
        ["Seｑ", "name", "学年", "組", "メールアドレス\n（メイン）", "会員ID", "保護者氏名１", "備考"],
        ["1", "name1", "1", "1", "data1@email.com", "2025-001", "名前1", ""],
        ["2", "name2", "1", "2", "data2@email.com", "2025-002", "名前2", "2番目のデータ"],
        ["3", "name3", "2", "3", "data3@email.com", "2025-003", "名前3", "コメント"],
        ["4", "name4", "2", "4", "data4@email.com", "2025-004", "名前4", ""],
    ]
    const _eventsheet = [
        { "Seｑ": "1", name: 'name1', "学年": 1, "組": 1, "メールアドレス\n（メイン）": "data1@email.com" },
        { "Seｑ": "2", name: 'name2', "学年": 1, "組": 2, "メールアドレス\n（メイン）": "data2@email.com" },
        { "Seｑ": "3", name: 'name3', "学年": 2, "組": 3, "メールアドレス\n（メイン）": "data3@email.com" },
        { "Seｑ": "4", name: 'name4', "学年": 2, "組": 4, "メールアドレス\n（メイン）": "data4@email.com" },
    ]

    const _eventData = [
        {
            "data_id": "1",
            "email_addr": "data1@email.com",
            "event_attr": {
                "学年": "1",
                "組": "1",
            },
            "embeded_attr": {
                "会員ID": "2025-001",
                "保護者氏名１": "名前1"
            },
            "event_name": _eventName,
        },
        {
            "data_id": "2",
            "email_addr": "data2@email.com",
            "event_attr": {
                "学年": "1",
                "組": "2",
            },
            "embeded_attr": {
                "会員ID": "2025-002",
                "保護者氏名１": "名前2"
            },
            "event_name": _eventName,
        },
        {
            "data_id": "3",
            "email_addr": "data3@email.com",
            "event_attr": {
                "学年": "2",
                "組": "3",
            },
            "embeded_attr": {
                "会員ID": "2025-003",
                "保護者氏名１": "名前3"
            },
            "event_name": _eventName,
        },
        {
            "data_id": "4",
            "email_addr": "data4@email.com",
            "event_attr": {
                "学年": "2",
                "組": "4",
            },
            "embeded_attr": {
                "会員ID": "2025-004",
                "保護者氏名１": "名前4"
            },
            "event_name": _eventName,
        },
    ]
    it('urlからsheet idを取得できること', () => {
        const url = 'https://docs.google.com/spreadsheets/d/1O7lTsLKtpEK5zl0IPUbiWAyG8afxQ55v/edit?gid=1428684260#gid=1428684260'
        const sheetId = __test__.getSheetId(url)
        expect(sheetId).toEqual('1O7lTsLKtpEK5zl0IPUbiWAyG8afxQ55v')
    })
    it('フィルターカラム取得', () => {
        const filterColumns = __test__.getFilterColumns(_eventConfig_raw)
        expect(filterColumns).toEqual(['学年', '組'])
    })
    it('データ変換', () => {
        const result = __test__.createEventData(10, ['学年', '組'], 'メールアドレス\n（メイン）', _eventsheet)
        expect(result[0]).toEqual({
            "column_name": "学年",
            "column_value": 1,
            "event_email_addr": "data1@email.com",
            "event_name_id": 10,
        })
        expect(result[1]).toEqual({
            "column_name": "学年",
            "column_value": 1,
            "event_email_addr": "data2@email.com",
            "event_name_id": 10,
        })
    })
})
describe('埋め込み文字列パース', () => {
    it('メール本文の埋め込み文字に変数の値を埋め込む', () => {
        const body = "((( 名前 ))) 様 あなたの番号は((( 会員ID )))です。"
        const vars = {
            "名前": "田中 哲朗",
            "会員ID": "2025-001"
        }
        const _parsed = "田中 哲朗 様 あなたの番号は2025-001です。"
        const parsed = parseEmbeded(body, vars)
        expect(parsed).toEqual(_parsed)
    })
    it('全角の埋め込みマーカーも対応する', () => {
        const body = "（（（ 名前 ））） 様 あなたの番号は（（（ 会員ID ）））です。"
        const vars = {
            "名前": "田中 哲朗",
            "会員ID": "2025-001"
        }
        const _parsed = "田中 哲朗 様 あなたの番号は2025-001です。"
        const parsed = parseEmbeded(body, vars)
        expect(parsed).toEqual(_parsed)
    })
    it('埋め込みマーカー内の空白有無にも対応', () => {
        const body = "(((名前))) 様 あなたの番号は((( 会員ID)))です。"
        const vars = {
            "名前": "田中 哲朗",
            "会員ID": "2025-001"
        }
        const _parsed = "田中 哲朗 様 あなたの番号は2025-001です。"
        const parsed = parseEmbeded(body, vars)
        expect(parsed).toEqual(_parsed)
    })
    it('変数がない時の対応。変換せずそのまま。', () => {
        const body = "(((氏名 ))) 様 あなたの番号は(((会員ID)))です。"
        const vars = {
            "名前": "田中 哲朗",
            "会員ID": "2025-001"
        }
        const _parsed = "(((氏名 ))) 様 あなたの番号は2025-001です。"
        const parsed = parseEmbeded(body, vars)
        expect(parsed).toEqual(_parsed)
    })
})