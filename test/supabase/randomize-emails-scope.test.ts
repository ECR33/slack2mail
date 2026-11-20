// tests/supabase/randomize-emails-scope.test.ts
//
// randomize_emails(p_tenant_id, p_event_names) のテナント単位・イベント単位限定を
// supabase local に対してsupabase-js経由で検証するVitestテスト。
//
// 事前準備:
//   supabase start
//   .env.local に NUXT_SUPABASE_PROJECT_URL / NUXT_SUPABASE_PUBLISHABLE_KEY / NUXT_SUPABASE_SERVICE_ROLE
//   新しいマイグレーションをローカルDBへ適用 (supabase db reset または docker exec ... psql)
//
// 実行:
//   npx vitest run --project supabase test/supabase/randomize-emails-scope.test.ts

import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NUXT_SUPABASE_PROJECT_URL ?? 'http://127.0.0.1:54321'
const PUBLISHABLE_KEY = process.env.NUXT_SUPABASE_PUBLISHABLE_KEY ?? ''
const SERVICE_ROLE_KEY = process.env.NUXT_SUPABASE_SERVICE_ROLE ?? ''

const MEMBER_EMAIL = 'rnd_scope_member@example.com'
const OUTSIDER_EMAIL = 'rnd_scope_outsider@example.com'
const PASSWORD = 'test-password-1234'

const SLUG_A = 'rnd-scope-a'
const SLUG_B = 'rnd-scope-b'
const EVENT_1 = '春のイベント'
const EVENT_2 = '秋のイベント'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
let client: SupabaseClient
let tenantA: string
let tenantB: string
let memberUserId: string
let outsiderUserId: string

const deleteTenantBySlug = async (slug: string) => {
    const { data } = await admin.from('tenants').select('tenant_id').eq('slug', slug).single()
    if (data) {
        await admin.from('tenants').delete().eq('tenant_id', data.tenant_id)
    }
}

const deleteAuthUser = async (email: string) => {
    const { data: list } = await admin.auth.admin.listUsers()
    const existing = list.users.find(u => u.email === email)
    if (existing) await admin.auth.admin.deleteUser(existing.id)
}

const createAuthUser = async (email: string) => {
    await deleteAuthUser(email)
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    if (error) throw error
    return data.user.id
}

describe('メールアドレス無効化(randomize_emails)のテナント・イベントスコープ', () => {

    beforeAll(async () => {
        if (!SERVICE_ROLE_KEY) throw new Error('NUXT_SUPABASE_SERVICE_ROLE が設定されていません')

        memberUserId = await createAuthUser(MEMBER_EMAIL)
        outsiderUserId = await createAuthUser(OUTSIDER_EMAIL)

        await deleteTenantBySlug(SLUG_A)
        await deleteTenantBySlug(SLUG_B)

        const { data: a, error: errA } = await admin.from('tenants').insert({ name: 'Rnd Scope A', slug: SLUG_A }).select().single()
        if (errA) throw errA
        tenantA = a.tenant_id

        const { data: b, error: errB } = await admin.from('tenants').insert({ name: 'Rnd Scope B', slug: SLUG_B }).select().single()
        if (errB) throw errB
        tenantB = b.tenant_id

        // tenantAの会員 / tenantBの会員 / どちらにも所属しない会員
        const { error: regErr } = await admin.from('tenant_users').insert([
            { tenant_id: tenantA, user_id: memberUserId, name: '会員A', email_addr: MEMBER_EMAIL },
            { tenant_id: tenantB, user_id: outsiderUserId, name: '会員B', email_addr: OUTSIDER_EMAIL }
        ])
        if (regErr) throw regErr

        // event_dataは(tenant_id, event_name)のFKがevent_configにあるため先にイベント設定を作る
        const { error: configErr } = await admin.from('event_config').insert([
            { tenant_id: tenantA, event_name: EVENT_1, sheet_id: 'sheet-a-1', sheet_name: '会員一覧', header: 1, id_column: 'id', email_column: 'email' },
            { tenant_id: tenantA, event_name: EVENT_2, sheet_id: 'sheet-a-2', sheet_name: '会員一覧', header: 1, id_column: 'id', email_column: 'email' },
            { tenant_id: tenantB, event_name: EVENT_1, sheet_id: 'sheet-b-1', sheet_name: '会員一覧', header: 1, id_column: 'id', email_column: 'email' },
            { tenant_id: tenantB, event_name: EVENT_2, sheet_id: 'sheet-b-2', sheet_name: '会員一覧', header: 1, id_column: 'id', email_column: 'email' }
        ])
        if (configErr) throw configErr

        const { error: insErr } = await admin.from('event_data').insert([
            // tenantA / EVENT_1: 無効化対象
            { tenant_id: tenantA, event_name: EVENT_1, data_id: '1', email_addr: 'tanaka@example.org' },
            { tenant_id: tenantA, event_name: EVENT_1, data_id: '2', email_addr: 'suzuki@example.org' },
            // tenantA / EVENT_1: email_addrが空なので対象外
            { tenant_id: tenantA, event_name: EVENT_1, data_id: '3', email_addr: '' },
            // tenantA / EVENT_2: 選択しなければ対象外
            { tenant_id: tenantA, event_name: EVENT_2, data_id: '4', email_addr: 'sato@example.org' },
            // tenantB: 他のテナントなので常に対象外
            { tenant_id: tenantB, event_name: EVENT_1, data_id: '5', email_addr: 'sylvester@example.org' },
            { tenant_id: tenantB, event_name: EVENT_2, data_id: '6', email_addr: 'taro@example.org' }
        ])
        if (insErr) throw insErr

        client = createClient(SUPABASE_URL, PUBLISHABLE_KEY)
        const { error: signInError } = await client.auth.signInWithPassword({ email: MEMBER_EMAIL, password: PASSWORD })
        if (signInError) throw signInError
    })

    afterAll(async () => {
        await client.auth.signOut()
        await admin.from('event_data').delete().in('tenant_id', [tenantA, tenantB])
        await admin.from('tenant_users').delete().in('tenant_id', [tenantA, tenantB])
        await deleteTenantBySlug(SLUG_A)
        await deleteTenantBySlug(SLUG_B)
        await deleteAuthUser(MEMBER_EMAIL)
        await deleteAuthUser(OUTSIDER_EMAIL)
    })

    const emailsOf = async (tenantId: string, eventName: string) => {
        const { data, error } = await admin.from('event_data').select('data_id, email_addr')
            .eq('tenant_id', tenantId).eq('event_name', eventName).order('data_id')
        if (error) throw error
        return data
    }

    /** 関数の戻り値はGROUP BY順が保証されていないのでイベント名(コードポイント順)で整列して比較する */
    const sorted = (rows: { event_name: string, changed: number }[] | null) =>
        [...(rows ?? [])].sort((a, b) => (a.event_name < b.event_name ? -1 : a.event_name > b.event_name ? 1 : 0))

    it('選択したイベントのみが無効化され、他のイベントと他テナントは変化しない', async () => {
        const before2 = await emailsOf(tenantA, EVENT_2)
        const beforeB = await emailsOf(tenantB, EVENT_1)

        const { data, error } = await client.rpc('randomize_emails', { p_tenant_id: tenantA, p_event_names: [EVENT_1] })
        expect(error).toBeNull()
        expect(sorted(data)).toEqual([{ event_name: EVENT_1, changed: 2 }])

        const after1 = await emailsOf(tenantA, EVENT_1)
        // 無効化された2件は @example.com になり、空のメールアドレスはそのまま
        expect(after1.filter(r => r.data_id === '3')[0].email_addr).toBe('')
        expect(after1.filter(r => r.data_id !== '3').every(r => (r.email_addr ?? '').endsWith('@example.com'))).toBe(true)

        expect(await emailsOf(tenantA, EVENT_2)).toEqual(before2)
        expect(await emailsOf(tenantB, EVENT_1)).toEqual(beforeB)
    })

    it('イベント名を空配列にするとそのテナントの全イベントが無効化される(他テナントは対象外)', async () => {
        const beforeB = await emailsOf(tenantB, EVENT_2)

        const { data, error } = await client.rpc('randomize_emails', { p_tenant_id: tenantA, p_event_names: [] })
        expect(error).toBeNull()
        expect(sorted(data)).toEqual([{ event_name: EVENT_1, changed: 2 }, { event_name: EVENT_2, changed: 1 }])

        const after2 = await emailsOf(tenantA, EVENT_2)
        expect(after2.every(r => (r.email_addr ?? '').endsWith('@example.com'))).toBe(true)
        expect(await emailsOf(tenantB, EVENT_2)).toEqual(beforeB)
    })

    it('イベント設定に無いイベント名を指定しても無効化されない', async () => {
        const before = await emailsOf(tenantA, EVENT_1)
        const { data, error } = await client.rpc('randomize_emails', { p_tenant_id: tenantA, p_event_names: ['存在しないイベント'] })
        expect(error).toBeNull()
        expect(sorted(data)).toEqual([])
        expect(await emailsOf(tenantA, EVENT_1)).toEqual(before)
    })

    it('他のテナントの会員は実行できない', async () => {
        await client.auth.signOut()
        const outsider = createClient(SUPABASE_URL, PUBLISHABLE_KEY)
        const { error: signInError } = await outsider.auth.signInWithPassword({ email: OUTSIDER_EMAIL, password: PASSWORD })
        if (signInError) throw signInError

        const { error } = await outsider.rpc('randomize_emails', { p_tenant_id: tenantA })
        expect(error).not.toBeNull()
        expect(error?.message).toContain('not authorized')

        // 自分のテナントは実行できる
        const { data, error: ownError } = await outsider.rpc('randomize_emails', { p_tenant_id: tenantB })
        expect(ownError).toBeNull()
        expect(data?.reduce((sum, r) => sum + (r.changed ?? 0), 0)).toBe(2)

        await outsider.auth.signOut()
        await client.auth.signInWithPassword({ email: MEMBER_EMAIL, password: PASSWORD })
    })

    it('p_tenant_idを省略するとエラーになる', async () => {
        const { error } = await client.rpc('randomize_emails', { p_tenant_id: null })
        expect(error).not.toBeNull()
        expect(error?.message).toContain('p_tenant_id is required')
    })

})
