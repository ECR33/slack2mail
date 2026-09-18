import { describe, it, expect } from 'vitest'
import { __slack_test__, getSlackViewValues, createExSelectOptions, getSlackView, getSlackViewEx } from '../../shared/utils/slack.js'
import { DateTime } from 'luxon'

describe('slackユーディリティのテスト', () => {
    const values = {
        "ex_select_年": {
            "multi_static_select_action": {
                "type": "multi_external_select",
                "selected_options": [
                    {
                        "text": {
                            "type": "plain_text",
                            "text": "1年",
                            "emoji": true
                        },
                        "value": "1年"
                    },
                    {
                        "text": {
                            "type": "plain_text",
                            "text": "2年",
                            "emoji": true
                        },
                        "value": "2年"
                    }
                ]
            }
        },
        "ex_select_組": {
            "multi_static_select_action": {
                "type": "multi_external_select",
                "selected_options": [
                    {
                        "text": {
                            "type": "plain_text",
                            "text": "1組",
                            "emoji": true
                        },
                        "value": "1組"
                    },
                    {
                        "text": {
                            "type": "plain_text",
                            "text": "2組",
                            "emoji": true
                        },
                        "value": "2組"
                    }
                ]
            }
        }
    }
    const _event_filter = [
        { column_name: "年", column_value: "1年" },
        { column_name: "年", column_value: "2年" },
        { column_name: "組", column_value: "1組" },
        { column_name: "組", column_value: "2組" },
    ]
    const payload = {
        "type": "view_submission",
        "team": {
            "id": "T035UT48S4U",
            "domain": "sakuraskytokyo"
        },
        "user": {
            "id": "U035SH954F5",
            "username": "kenji.o_o",
            "name": "kenji.o_o",
            "team_id": "T035UT48S4U"
        },
        "api_app_id": "A09HG5SEK7W",
        "token": "jogeAqzCqYMOSj7Uca5OM1vi",
        "trigger_id": "11439235287168.3198922298164.eaadc9b99849a014f291c986eef630cc",
        "view": {
            "id": "V0BCX6VD8AU",
            "team_id": "T035UT48S4U",
            "type": "modal",
            "blocks": [
                {
                    "type": "input",
                    "block_id": "subject",
                    "label": {
                        "type": "plain_text",
                        "text": "件名",
                        "emoji": true
                    },
                    "optional": false,
                    "dispatch_action": false,
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "plain_text_input-action",
                        "dispatch_action_config": {
                            "trigger_actions_on": [
                                "on_enter_pressed"
                            ]
                        }
                    }
                },
                {
                    "type": "input",
                    "block_id": "body",
                    "label": {
                        "type": "plain_text",
                        "text": "本文",
                        "emoji": true
                    },
                    "optional": false,
                    "dispatch_action": false,
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "plain_text_input-action",
                        "multiline": true,
                        "dispatch_action_config": {
                            "trigger_actions_on": [
                                "on_enter_pressed"
                            ]
                        }
                    }
                },
                {
                    "type": "input",
                    "block_id": "event_name",
                    "label": {
                        "type": "plain_text",
                        "text": "イベント",
                        "emoji": true
                    },
                    "optional": false,
                    "dispatch_action": false,
                    "element": {
                        "type": "static_select",
                        "action_id": "event_select-action",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Select event",
                            "emoji": true
                        },
                        "options": [
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "イベント1",
                                    "emoji": true
                                },
                                "value": "event1"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "イベント2",
                                    "emoji": true
                                },
                                "value": "event2"
                            }
                        ]
                    }
                },
                {
                    "type": "input",
                    "block_id": "ex_select1",
                    "label": {
                        "type": "plain_text",
                        "text": "宛先グループ",
                        "emoji": true
                    },
                    "optional": true,
                    "dispatch_action": false,
                    "element": {
                        "type": "multi_external_select",
                        "action_id": "multi_static_select-action",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Select options",
                            "emoji": true
                        },
                        "min_query_length": 2
                    }
                },
                {
                    "type": "input",
                    "block_id": "approve_count",
                    "label": {
                        "type": "plain_text",
                        "text": "イベント",
                        "emoji": true
                    },
                    "optional": false,
                    "dispatch_action": false,
                    "element": {
                        "type": "static_select",
                        "action_id": "approve_count_select_action",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "確認者数",
                            "emoji": true
                        },
                        "initial_option": {
                            "text": {
                                "type": "plain_text",
                                "text": "3",
                                "emoji": true
                            },
                            "value": "3"
                        },
                        "options": [
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "5",
                                    "emoji": true
                                },
                                "value": "5"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "4",
                                    "emoji": true
                                },
                                "value": "4"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "3",
                                    "emoji": true
                                },
                                "value": "3"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "2",
                                    "emoji": true
                                },
                                "value": "2"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "1",
                                    "emoji": true
                                },
                                "value": "1"
                            }
                        ]
                    }
                }
            ],
            "private_metadata": JSON.stringify({ email_id: "a", channel_id: "b" }),
            "callback_id": "opened_modal",
            "state": {
                "values": {
                    "subject": {
                        "subject_input_action": {
                            "type": "plain_text_input",
                            "value": "タイトルテキスト"
                        }
                    },
                    "body": {
                        "body_input_action": {
                            "type": "plain_text_input",
                            "value": "メールの本文\n改行もしてみました"
                        }
                    },
                    "event_name": {
                        "event_select_action": {
                            "type": "static_select",
                            "selected_option": {
                                "text": {
                                    "type": "plain_text",
                                    "text": "イベント1",
                                    "emoji": true
                                },
                                "value": "event1"
                            }
                        }
                    },
                    "ex_select_年": {
                        "multi_static_select_action": {
                            "type": "multi_external_select",
                            "selected_options": [
                                {
                                    "text": {
                                        "type": "plain_text",
                                        "text": "1年",
                                        "emoji": true
                                    },
                                    "value": "1年"
                                },
                                {
                                    "text": {
                                        "type": "plain_text",
                                        "text": "2年",
                                        "emoji": true
                                    },
                                    "value": "2年"
                                }
                            ]
                        }
                    },
                    "ex_select_組": {
                        "multi_static_select_action": {
                            "type": "multi_external_select",
                            "selected_options": [
                                {
                                    "text": {
                                        "type": "plain_text",
                                        "text": "1組",
                                        "emoji": true
                                    },
                                    "value": "1組"
                                },
                                {
                                    "text": {
                                        "type": "plain_text",
                                        "text": "2組",
                                        "emoji": true
                                    },
                                    "value": "2組"
                                }
                            ]
                        }
                    },
                    "approve_count": {
                        "approve_count_select_action": {
                            "type": "static_select",
                            "selected_option": {
                                "text": {
                                    "type": "plain_text",
                                    "text": "3",
                                    "emoji": true
                                },
                                "value": "3"
                            }
                        }
                    }
                }
            },
            "hash": "1782053777.p7aWGR4Q",
            "title": {
                "type": "plain_text",
                "text": "メール作成",
                "emoji": true
            },
            "clear_on_close": false,
            "notify_on_close": false,
            "close": null,
            "submit": {
                "type": "plain_text",
                "text": "送信",
                "emoji": true
            },
            "previous_view_id": null,
            "root_view_id": "V0BCX6VD8AU",
            "app_id": "A09HG5SEK7W",
            "external_id": "",
            "app_installed_team_id": "T035UT48S4U",
            "bot_id": "B09H88LKDEH"
        },
        "response_urls": [],
        "is_enterprise_install": false,
        "enterprise": null
    }

    const _mail = {
        email_id: "",
        subject: "タイトルテキスト",
        body: "メールの本文\n改行もしてみました",
        event_name: "event1",
        event_filter: _event_filter,
        status: "pending",
        approval_count: 0,
        approval_border: 3,
        approved_by: [""],
        attachments: null,
        created_by: "U035SH954F5",
        created_at: DateTime.now(),
        team_id: "T035UT48S4U",
        approval_channel: "",
        approval_thread_ts: "",
        schedule: null,
        sent_at: null,
        num_of_received: 0,
        num_of_sent: 0
    }

    const _subject_block = {
        "type": "input",
        "block_id": "subject",
        "element": {
            "type": "plain_text_input",
            "action_id": "input_action"
        },
        "label": {
            "type": "plain_text",
            "text": "件名",
            "emoji": true
        },
        "optional": false
    }
    const _body_block = {
        "type": "input",
        "block_id": "body",
        "element": {
            "type": "plain_text_input",
            "multiline": true,
            "action_id": "input_action"
        },
        "label": {
            "type": "plain_text",
            "text": "本文",
            "emoji": true
        },
        "optional": false
    }
    // preview block
    const _preview_block = {
        type: "section",
        block_id: "preview",
        text: {
            type: "mrkdwn",
            text: "メールの題名と本文をプレビュー"
        },
        accessory: {
            type: "button",
            text: {
                type: "plain_text",
                text: "表示",
                emoji: true
            },
            value: "click_me_123",
            action_id: "preview_action"
        }
    }
    // select_block
    const _event_names = ['会員一覧_2025', '謝恩会']
    const _select_block = {
        "type": "input",
        "block_id": "event_name",
        "element": {
            "type": "static_select",
            "placeholder": {
                "type": "plain_text",
                "text": "イベント",
                "emoji": true
            },
            "action_id": "select_action",
            "options": [
                {
                    "text": {
                        "type": "plain_text",
                        "text": "会員一覧_2025",
                        "emoji": true
                    },
                    "value": "会員一覧_2025"
                },
                {
                    "text": {
                        "type": "plain_text",
                        "text": "謝恩会",
                        "emoji": true
                    },
                    "value": "謝恩会"
                },
            ],
        },
        "label": {
            "type": "plain_text",
            "text": "イベント",
            "emoji": true
        },
        "optional": false,
        "dispatch_action": false

    }
    // multi_static_select
    const _multi_select = [
        {
            column_name: '学年',
            column_values: ['1', '3']
        },
        {
            column_name: '組',
            column_values: ['1', '4']
        }
    ]
    const _multi_select_blocks = [
        {
            "block_id": "select_学年",
            "element": {
                "action_id": "multi_static_select_action",
                "options": [
                    {
                        "text": {
                            "emoji": true,
                            "text": "1",
                            "type": "plain_text",
                        },
                        "value": "1",
                    },
                    {
                        "text": {
                            "emoji": true,
                            "text": "3",
                            "type": "plain_text",
                        },
                        "value": "3",
                    },
                ],
                "placeholder": {
                    "emoji": true,
                    "text": "宛先を選択...",
                    "type": "plain_text",
                },
                "type": "multi_static_select",
            },
            "label": {
                "emoji": true,
                "text": "学年",
                "type": "plain_text",
            },
            "optional": true,
            "type": "input",
        },
        {
            "block_id": "select_組",
            "element": {
                "action_id": "multi_static_select_action",
                "options": [
                    {
                        "text": {
                            "emoji": true,
                            "text": "1",
                            "type": "plain_text",
                        },
                        "value": "1",
                    },
                    {
                        "text": {
                            "emoji": true,
                            "text": "4",
                            "type": "plain_text",
                        },
                        "value": "4",
                    },
                ],
                "placeholder": {
                    "emoji": true,
                    "text": "宛先を選択...",
                    "type": "plain_text",
                },
                "type": "multi_static_select",
            },
            "label": {
                "emoji": true,
                "text": "組",
                "type": "plain_text",
            },
            "optional": true,
            "type": "input",
        },
    ]

    // ex multi select
    const _filter_columns = ["学年", "組"]
    const _ex_select_blocks = [
        {
            "type": "input",
            "block_id": "ex_select_学年",
            "optional": true,
            "element": {
                "type": "multi_external_select",
                "placeholder": {
                    "type": "plain_text",
                    "text": "Select options",
                    "emoji": true
                },
                "min_query_length": 1,
                "action_id": "multi_select_action"
            },
            "label": {
                "type": "plain_text",
                "text": "学年",
                "emoji": true
            }
        },
        {
            "type": "input",
            "block_id": "ex_select_組",
            "optional": true,
            "element": {
                "type": "multi_external_select",
                "placeholder": {
                    "type": "plain_text",
                    "text": "Select options",
                    "emoji": true
                },
                "min_query_length": 1,
                "action_id": "multi_select_action"
            },
            "label": {
                "type": "plain_text",
                "text": "組",
                "emoji": true
            }
        }
    ]
    const _blocks2 =
    {
        "type": "input",
        "block_id": "approve_count",
        "element": {
            "type": "static_select",
            "placeholder": {
                "type": "plain_text",
                "text": "確認者数",
                "emoji": true
            },
            "action_id": "select_action",
            "options": [
                {
                    "text": {
                        "type": "plain_text",
                        "text": "5",
                        "emoji": true
                    },
                    "value": "5"
                },
                {
                    "text": {
                        "type": "plain_text",
                        "text": "4",
                        "emoji": true
                    },
                    "value": "4"
                },
                {
                    "text": {
                        "type": "plain_text",
                        "text": "3",
                        "emoji": true
                    },
                    "value": "3"
                },
                {
                    "text": {
                        "type": "plain_text",
                        "text": "2",
                        "emoji": true
                    },
                    "value": "2"
                },
                {
                    "text": {
                        "type": "plain_text",
                        "text": "1",
                        "emoji": true
                    },
                    "value": "1"
                },
            ],
            "initial_option": {
                "text": {
                    "type": "plain_text",
                    "text": "3",
                    "emoji": true
                },
                "value": "3"
            }
        },
        "label": {
            "type": "plain_text",
            "text": "確認者数",
            "emoji": true
        },
        "optional": false,
        "dispatch_action": false
    }

    const _blocks = []
    _blocks.push(_subject_block)
    _blocks.push(_body_block)
    _blocks.push(_preview_block)
    _blocks.push(_select_block)
    _blocks.push(_blocks2)
    const _initial_option = {
        "text": {
            "type": "plain_text",
            "text": "会員一覧_2025",
            "emoji": true
        },
        "value": "会員一覧_2025"
    }
    const _view = {
        trigger_id: "dummy_trigger_id",
        view: {
            type: "modal",
            callback_id: "opened_modal",
            title: {
                type: "plain_text",
                text: "メール作成"
            },
            submit: {
                type: "plain_text",
                text: "保存"
            },
            blocks: _blocks
        }
    }

    const _event_filter_values = ["1", "3"]
    const _ex_select_options = [
        {
            text: {
                type: "plain_text",
                "text": "1"
            },
            value: "1"
        },
        {
            text: {
                type: "plain_text",
                "text": "3"
            },
            value: "3"
        },
    ]

    // external select 廃止
    // it('external selectからfilter objectを取得', () => {
    //     const event_filter = __slack_test__.getEvetnFilter(values)
    //     expect(event_filter).toEqual(_event_filter)
    // })
    it('1行テキスト入力欄生成 getTextBlock', () => {
        const input_block = __slack_test__.getTextBlock('subject', '件名')
        expect(input_block).toEqual(_subject_block)
    })
    it('複数行テキスト入力欄生成 getTextBlock', () => {
        const input_block = __slack_test__.getTextBlock('body', '本文', true)
        expect(input_block).toEqual(_body_block)
    })
    it('単数選択肢の生成 getSelectBlock', () => {
        const select_block = __slack_test__.getSelectBlock('event_name', 'イベント', _event_names)
        expect(select_block).toEqual(_select_block)
    })
    it('単数選択肢の生成 dispatchあり getSelectBlock', () => {
        _select_block.dispatch_action = true
        const select_block = __slack_test__.getSelectBlock('event_name', 'イベント', _event_names, true)
        expect(select_block).toEqual(_select_block)
    })
    it('複数選択肢の複数生成 static', () => {
        const select_blocks = __slack_test__.getMultiSelectBlocks(_multi_select)
        expect(select_blocks).toEqual(_multi_select_blocks)
    })
    // TODO: external selectからstaticに変更したことによる生成結果の変更の取り込み
    // it('複数選択肢の複数生成 static 選択済み値あり', () => {
    //     _multi_select[0].selected_values = ['1', '3']
    //     _multi_select_blocks[0].element['initial_options'] = [
    //         {
    //             "text": {
    //                 "emoji": true,
    //                 "text": "1",
    //                 "type": "plain_text",
    //             },
    //             "value": "1",
    //         },
    //         {
    //             "text": {
    //                 "emoji": true,
    //                 "text": "3",
    //                 "type": "plain_text",
    //             },
    //             "value": "3",
    //         }
    //     ]
    //     _multi_select[1].selected_values = ['4']
    //     _multi_select_blocks[1].element['initial_options'] = [
    //         {
    //             "text": {
    //                 "emoji": true,
    //                 "text": "4",
    //                 "type": "plain_text",
    //             },
    //             "value": "4",
    //         },
    //     ]
    //     const select_blocks = __slack_test__.getMultiSelectBlocks(_multi_select)
    //     expect(select_blocks).toEqual(_multi_select_blocks)
    // })
    it('複数選択肢の複数生成 external', () => {
        const ex_select_blocks = __slack_test__.getExSelectBlocks(_filter_columns)
        expect(ex_select_blocks).toEqual(_ex_select_blocks)
    })
    // TODO: 形式変更によるテストの変更
    // it('slackのviewデータからemailデータを作成する', () => {
    //     const email = getSlackViewValues(JSON.stringify(payload))
    //     email.created_at = null
    //     _mail.created_at = null
    //     expect(email).toEqual(_mail)
    // })
    // TODO: external select版は凍結中
    // it('slackのviewの初期値を返却する external select版', () => {
    //     // slash commandによる呼び出し時を想定
    //     // イベントが未選択=宛先グループがなし
    //     const trigger_id = 'dummy_trigger_id'
    //     const callback_id = 'opened_modal'
    //     const view = getSlackViewEx(trigger_id, null, callback_id, _event_names)
    //     expect(view).toEqual(_view)
    // })
    it('単数選択肢の生成 選択済み値あり getSelectBlock', () => {
        const selected_value = '会員一覧_2025'
        const select_block = __slack_test__.getSelectBlock('event_name', 'イベント', _event_names, true, selected_value)
        _select_block.element['initial_option'] = _initial_option
        expect(select_block).toEqual(_select_block)
    })
    it('slackのviewの値を返却する external select版 イベント選択済み', () => {
        // イベントが選択済みの場合
        // イベントが選択されたため宛先グループ選択肢も出現
        const trigger_id = 'dummy_trigger_id'
        const view_id = 'dummy_view_id'
        const callback_id = 'opened_modal'
        const view = getSlackViewEx(trigger_id, view_id, callback_id, _event_names, _filter_columns, _event_names[0])
        // 配列内の順序が異なると一致しないため抜き出して検査する
        const ex_select_学年 = view.view.blocks.filter(f => (f.block_id == 'ex_select_学年'))
        expect(ex_select_学年).toEqual([_ex_select_blocks[0]])
        const ex_select_組 = view.view.blocks.filter(f => (f.block_id == 'ex_select_組'))
    })
    it('slackのexternal_multiselectのoptionsを取得する', () => {
        // UIに検索文字が入力された際に返却する値
        const ex_select_options = createExSelectOptions(_event_filter_values)
        expect(ex_select_options).toEqual(_ex_select_options)
    })
    const static_select_view = {
        "trigger_id": "dummy_trigger_id",
        "view": {
            "type": "modal",
            "callback_id": "opened_modal",
            "title": {
                "type": "plain_text",
                "text": "メール作成"
            },
            "submit": {
                "type": "plain_text",
                "text": "保存"
            },
            "blocks": [
                {
                    "type": "input",
                    "block_id": "subject",
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "input_action"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "件名",
                        "emoji": true
                    },
                    "optional": false
                },
                {
                    "type": "input",
                    "block_id": "body",
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "input_action",
                        "multiline": true
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "本文",
                        "emoji": true
                    },
                    "optional": false
                },
                {
                    "type": "section",
                    "block_id": "preview",
                    "text": {
                        "type": "mrkdwn",
                        "text": "メールの題名と本文をプレビュー"
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "表示",
                            "emoji": true
                        },
                        "value": "click_me_123",
                        "action_id": "preview_action"
                    }
                },
                {
                    "type": "input",
                    "block_id": "event_name",
                    "element": {
                        "type": "static_select",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "イベント",
                            "emoji": true
                        },
                        "action_id": "select_action",
                        "options": [
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "会員一覧_2025",
                                    "emoji": true
                                },
                                "value": "会員一覧_2025"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "謝恩会",
                                    "emoji": true
                                },
                                "value": "謝恩会"
                            }
                        ],
                        "initial_option": {
                            "text": {
                                "type": "plain_text",
                                "text": "会員一覧_2025",
                                "emoji": true
                            },
                            "value": "会員一覧_2025"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "イベント",
                        "emoji": true
                    },
                    "optional": false,
                    "dispatch_action": true
                },
                {
                    "type": "input",
                    "block_id": "schedule_mode",
                    "element": {
                        "type": "static_select",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "送信予定",
                            "emoji": true
                        },
                        "action_id": "select_action",
                        "options": [
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "自動設定(確認5分後)",
                                    "emoji": true
                                },
                                "value": "0"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "指定の日時",
                                    "emoji": true
                                },
                                "value": "1"
                            }
                        ],
                        "initial_option": {
                            "text": {
                                "type": "plain_text",
                                "text": "自動設定(確認5分後)",
                                "emoji": true
                            },
                            "value": "0"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "送信予定",
                        "emoji": true
                    },
                    "optional": false,
                    "dispatch_action": true
                },
                {
                    "type": "input",
                    "block_id": "approve_count",
                    "element": {
                        "type": "static_select",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "確認者数",
                            "emoji": true
                        },
                        "action_id": "select_action",
                        "options": [
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "5",
                                    "emoji": true
                                },
                                "value": "5"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "4",
                                    "emoji": true
                                },
                                "value": "4"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "3",
                                    "emoji": true
                                },
                                "value": "3"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "2",
                                    "emoji": true
                                },
                                "value": "2"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "1",
                                    "emoji": true
                                },
                                "value": "1"
                            }
                        ],
                        "initial_option": {
                            "text": {
                                "type": "plain_text",
                                "text": "3",
                                "emoji": true
                            },
                            "value": "3"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "確認者数",
                        "emoji": true
                    },
                    "optional": false,
                    "dispatch_action": false
                }
            ]
        }
    }
    it('slackのviewを返却する イベント選択済み static_select版', () => {
        // multi_statick_select版
        const trigger_id = 'dummy_trigger_id'
        const selected_value = '会員一覧_2025'
        const view = getSlackView(trigger_id, null, _event_names, selected_value)
        expect(view).toEqual(static_select_view)
    })
})
