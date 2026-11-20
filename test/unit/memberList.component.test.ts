// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import MemberList from '../../app/components/MemberList.vue'

const records = [
    {
        id: '11111111-1111-1111-1111-111111111111',
        tenant_id: 'tenant-1',
        user_id: '22222222-2222-2222-2222-222222222222',
        name: '田中 太郎',
        email_addr: 'tanaka@example.org'
    },
    {
        id: null,
        tenant_id: 'tenant-1',
        user_id: null,
        name: null,
        email_addr: 'suzuki@example.org'
    }
] as any[]

const mountAt = async (width: number) => {
    window.innerWidth = width
    const vuetify = createVuetify({ components, directives, ssr: false })
    // attachToしないとonMountedが呼ばれず、レスポンシブ判定が切り替わらない
    const wrapper = mount(MemberList, { props: { records }, attachTo: document.body, global: { plugins: [vuetify] } })
    // onMounted後の再描画を待つ
    await nextTick()
    return wrapper
}

describe('メンバー一覧のレスポンシブ表示', () => {
    it('狭い画面(モバイル)ではメンバー単位のカード表示になる', async () => {
        const wrapper = await mountAt(360)
        expect(wrapper.findAll('.v-card').length).toBe(2)
        expect(wrapper.find('table').exists()).toBe(false)
        expect(wrapper.text()).toContain('田中 太郎')
        expect(wrapper.text()).toContain('tanaka@example.org')
        expect(wrapper.text()).toContain('22222222-2222-2222-2222-222222222222')
    })

    it('広い画面では従来の一覧テーブル表示になる', async () => {
        const wrapper = await mountAt(1280)
        expect(wrapper.find('table').exists()).toBe(true)
        expect(wrapper.findAll('.v-card').length).toBe(0)
        expect(wrapper.findAll('tbody tr').length).toBe(2)
        expect(wrapper.text()).toContain('連携ID(user_id)')
    })

    it('未ログインのメンバーは状態を「未ログイン」と表示する', async () => {
        const wrapper = await mountAt(360)
        expect(wrapper.text()).toContain('連携済み')
        expect(wrapper.text()).toContain('未ログイン')
        expect(wrapper.text()).toContain('(名前未設定)')
        expect(wrapper.text()).toContain('未ログインのため未設定')
    })

    it('idが未取得でもemail_addrをキーにできるためkey衝突しない', async () => {
        const wrapper = await mountAt(360)
        const cards = wrapper.findAll('.v-card')
        expect(cards[1].text()).toContain('suzuki@example.org')
    })
})
