// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import EventConfig from '../../app/components/EventConfig.vue'

const records = [
    {
        event_name: '春のイベント',
        sheet_id: 'aaa',
        sheet_name: '会員一覧',
        header: 2,
        id_column: 'Seq',
        email_column: 'メールアドレス\n（メイン）',
        filter_columns: ['学年', '組'],
        embeded_columns: ['会員ID'],
        include_flg_column_name: '送信対象',
        include_flg_column_values: ['1'],
        sender_name: '標準服リユース会',
        sender_email_addr: 'soumu@example.com'
    },
    {
        event_name: 'シート未設定のイベント',
        sheet_id: null,
        sheet_name: null,
        header: null,
        id_column: null,
        email_column: null,
        filter_columns: null,
        embeded_columns: null,
        include_flg_column_name: null,
        include_flg_column_values: null,
        sender_name: null,
        sender_email_addr: null
    }
] as any[]

const mountAt = async (width: number) => {
    window.innerWidth = width
    const vuetify = createVuetify({ components, directives, ssr: false })
    // attachToしないとonMountedが呼ばれず、レスポンシブ判定が切り替わらない
    const wrapper = mount(EventConfig, { props: { records }, attachTo: document.body, global: { plugins: [vuetify] } })
    // onMounted後の再描画を待つ
    await nextTick()
    return wrapper
}

describe('イベント設定一覧のレスポンシブ表示', () => {
    it('狭い画面(モバイル)ではイベント単位のカード表示になる', async () => {
        const wrapper = await mountAt(360)
        const cards = wrapper.findAll('.v-card')
        expect(cards.length).toBe(2)
        expect(wrapper.find('table').exists()).toBe(false)
        expect(wrapper.text()).toContain('春のイベント')
        // カード内でchipsとして列名を表示する
        expect(wrapper.text()).toContain('学年')
    })

    it('広い画面では従来の一覧テーブル表示になる', async () => {
        const wrapper = await mountAt(1280)
        expect(wrapper.find('table').exists()).toBe(true)
        expect(wrapper.findAll('.v-card').length).toBe(0)
        expect(wrapper.findAll('tbody tr').length).toBe(2)
        // 読込みボタンはダウンロードと混同しないmdi-importを使う
        const loadIcons = wrapper.findAll('tbody tr button i')
        expect(loadIcons.length).toBe(2)
        expect(loadIcons.map(i => i.classes()).every(c => c.includes('mdi-import'))).toBe(true)
        expect(wrapper.find('.mdi-download').exists()).toBe(false)
    })

    it('カードの読込みボタンが押されるとイベント名をemitする', async () => {
        const wrapper = await mountAt(360)
        const loadButtons = wrapper.findAll('.v-card-actions button')
        expect(loadButtons.length).toBe(2)
        expect(loadButtons[0].attributes('disabled')).toBeUndefined()
        expect(loadButtons[1].attributes('disabled')).toBeDefined()
        expect(loadButtons[0].find('i').classes()).toContain('mdi-import')
        await loadButtons[0].trigger('click')
        expect(wrapper.emitted('load')?.[0]).toEqual(['春のイベント'])
    })

    it('シート未設定の値は「未設定」として表示する', async () => {
        const wrapper = await mountAt(360)
        expect(wrapper.text()).toContain('シート未設定')
        expect(wrapper.text()).toContain('判定なし(全行読込み)')
    })
})
