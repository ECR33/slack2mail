// test/login/login-to-top-flow.test.ts
//
// 前提: `supabase start` でローカルSupabaseが起動していること
// 実行: npx vitest run test/login/login-to-top-flow.test.ts
//
// 検証する流れ:
//   1. (事前準備) テナント作成 + オーナーのメール事前登録(手動運用を模倣)
//   2. Googleログイン相当(ここではemail/passwordで実ログインしJWTを取得)
//   3. /auth/callback 相当: link_my_tenant_user() 呼び出し
//   4. /select-tenant 相当: 所属テナント一覧取得 → 1件なら自動遷移先slugが確定
//   5. middleware 相当: slugに対応するテナントへの所属チェック
//   6. トップ画面表示相当: brand_name/brand_icon_urlのフォールバック処理

import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// supabase start 直後に `supabase status` で表示される値。
// ローカル固定値のため通常は変更不要(必要なら環境変数で上書き可能)
const SUPABASE_URL = process.env.NUXT_SUPABASE_PROJECT_URL ?? 'http://localhost:54321'
const PUBLISHABLE_KEY = process.env.NUXT_SUPABASE_PUBLISHABLE_KEY ?? ''
const SERVICE_ROLE_KEY = process.env.NUXT_SUPABASE_SERVICE_ROLE ?? ''

const TEST_EMAIL = 'owner_flow_test@example.com'
const TEST_PASSWORD = 'test-password-12345'

let admin: SupabaseClient       // service_role: セットアップ/後片付け・RLSバイパス確認用
let tenantId: string
let authUserId: string

describe('初回ログイン〜トップ画面表示までの流れ', { sequential: true }, () => {

    beforeAll(async () => {
        admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

        // --- 0. 前回テストデータ削除
        await admin.from('tenant_users').delete().eq('email_addr', TEST_EMAIL)
        const { error } = await admin.from('tenants').delete().eq('slug', 'pta-flow-test')
        if (error) { console.error('delete', error) }
        const { data: list, error: listerror } = await admin.auth.admin.listUsers()
        const user_id = list.users.filter(f => f.email == TEST_EMAIL)[0]?.id
        if (user_id) await admin.auth.admin.deleteUser(user_id)


        // --- 1. テナント作成 + オーナーの事前登録(手動運用を模倣) ---
        const { data: tenant, error: tenantError } = await admin
            .from('tenants')
            .insert({ name: 'PTA Flow Test', slug: 'pta-flow-test' })
            .select()
            .single()
        if (tenantError) {
            throw tenantError
        }
        tenantId = tenant.tenant_id

        const { error: preRegError } = await admin
            .from('tenant_users')
            .insert({ tenant_id: tenantId, name: 'テストオーナー', email_addr: TEST_EMAIL })
        if (preRegError) {
            throw preRegError
        }

        // --- 2. Googleログイン相当の実ユーザー作成(admin API) ---
        const { data: created, error: createUserError } = await admin.auth.admin.createUser({
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
            email_confirm: true,
        })
        if (createUserError) {
            throw createUserError
        }
        authUserId = created.user!.id
    })

    afterAll(async () => {
        // 後片付け(逆順)
        return
        await admin.from('tenant_users').delete().eq('tenant_id', tenantId)
        await admin.from('tenants').delete().eq('tenant_id', tenantId)
        if (authUserId) await admin.auth.admin.deleteUser(authUserId)
    })

    it('一連の流れを最初から最後まで確認する', async () => {
        // --- 2. 実ログイン(Google OAuth完了後にセッションが張られた状態に相当) ---
        const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY)
        const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
        })
        expect(signInError).toBeNull()
        expect(signInData.user?.id).toBe(authUserId)

        // --- 3. /auth/callback 相当: link_my_tenant_user() ---
        const { error: linkError } = await client.rpc('link_my_tenant_user')
        expect(linkError).toBeNull()

        // user_idが実際に埋まったことを確認(service_roleでRLSバイパスして検証)
        const { data: linkedRow } = await admin
            .from('tenant_users')
            .select('user_id')
            .eq('tenant_id', tenantId)
            .eq('email_addr', TEST_EMAIL)
            .single()
        expect(linkedRow?.user_id).toBe(authUserId)

        // --- 4. /select-tenant 相当: 所属テナント一覧取得 ---
        const { data: myTenants, error: myTenantsError } = await client
            .from('tenant_users')
            .select('tenant_id, tenants(name, slug, brand_name, brand_icon_url)')
            .eq('user_id', authUserId)
        expect(myTenantsError).toBeNull()
        expect(myTenants).toHaveLength(1)

        const resolvedSlug = (myTenants![0].tenants as any).slug
        expect(resolvedSlug).toBe('pta-flow-test')

        // --- 5. middleware 相当: slugに対応するテナントへの所属チェック ---
        const { data: membership, error: membershipError } = await client
            .from('tenant_users')
            .select('tenant_id, tenants!inner(name, slug, brand_name, brand_icon_url)')
            .eq('user_id', authUserId)
            .eq('tenants.slug', resolvedSlug)
            .maybeSingle()
        expect(membershipError).toBeNull()
        expect(membership).not.toBeNull()
        expect(membership!.tenant_id).toBe(tenantId)

        // --- 6. トップ画面表示相当: brand_name/brand_icon_urlのフォールバック ---
        const tenantInfo = membership!.tenants as any
        const displayName = tenantInfo.brand_name ?? tenantInfo.name
        expect(displayName).toBe('PTA Flow Test')   // brand_name未設定時はnameにフォールバック
        expect(tenantInfo.brand_icon_url).toBeNull()

        await client.auth.signOut()
    })

    it('所属していないslugへのアクセスは membership が null になる(unauthorized相当)', async () => {
        const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY)
        await client.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD })

        const { data: membership } = await client
            .from('tenant_users')
            .select('tenant_id, tenants!inner(slug)')
            .eq('user_id', authUserId)
            .eq('tenants.slug', 'no-such-tenant')
            .maybeSingle()

        expect(membership).toBeNull()

        await client.auth.signOut()
    })
})