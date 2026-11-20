// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import EventData from '../../app/components/EventData.vue'

const records = [
    {
        id: 1,
        event_name: '春のイベント',
        data_id: '1',
        email_addr: 'data1@email.com',
        event_attr: { 学年: '1', 組: '1' },
        embeded_values: { 会員ID: '2025-001' }
    },
    {
        id: 2,
        event_name: '秋のイベント',
        data_id: '2',
        email_addr: 'tanaka@example.com',
        event_attr: null,
        embeded_values: {}
    }
] as any[]

const mountAt = async (width: number, props: any = { records }) => {
    window.innerWidth = width
    const vuetify = createVuetify({ components, directives, ssr: false })
    // attachToしないとonMountedが呼ばれず、レスポンシブ判定が切り替わらない
    const wrapper = mount(EventData, { props, attachTo: document.body, global: { plugins: [vuetify] } })
    // onMounted後の再描画を待つ
    await nextTick()
    return wrapper
}

describe('イベントデータ一覧のレスポンシブ表示', () => {
    it('狭い画面(モバイル)ではレコード単位のカード表示になる', async () => {
        const wrapper = await mountAt(360)
        expect(wrapper.findAll('.v-card').length).toBe(2)
        expect(wrapper.find('table').exists()).toBe(false)
        expect(wrapper.text()).toContain('春のイベント')
        // マスクされたメールアドレス
        expect(wrapper.text()).toContain('d...1@email.com')
        // 属性がchipsとして表示される
        expect(wrapper.text()).toContain('学年: 1')
        expect(wrapper.text()).toContain('会員ID: 2025-001')
    })

    it('広い画面では従来のテーブル表示になる', async () => {
        const wrapper = await mountAt(1280)
        expect(wrapper.find('table').exists()).toBe(true)
        expect(wrapper.findAll('.v-card').length).toBe(0)
        expect(wrapper.findAll('tbody tr').length).toBe(2)
        expect(wrapper.text()).toContain('組: 1')
    })

    it('属性がnull/空の項目は「指定なし」と表示する', async () => {
        const wrapper = await mountAt(360)
        expect(wrapper.text()).toContain('指定なし')
    })

    it('シート由来の文字列がHTMLとして解釈されない(v-html不使用)', async () => {
        const injection = [{
            id: 3,
            event_name: 'x',
            data_id: '3',
            email_addr: 'a@b.c',
            event_attr: { 備考: '<b>bold</b>' },
            embeded_values: {}
        }] as any[]
        const wrapper = await mountAt(360, { records: injection })
        expect(wrapper.find('b').exists()).toBe(false)
        expect(wrapper.text()).toContain('<b>bold</b>')
        wrapper.unmount()
    })
})
