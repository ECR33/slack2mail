// tests/onboarding-flow.test.ts
//
// 「ログイン後にメール送信ができるようになるまで」の設定フローを
// supabase local に対してsupabase-js経由で検証するVitestテスト。
// 各itはこの順で実行される前提(状態を後続stepに引き継ぐシーケンシャルテスト)。
//
// ユーザのシナリオ
// 初期ユーザ(オーナー)でサインイン
// Google Service Account登録
// members sheet config登録
// slack2mail.config登録
//
// 事前準備:
//   npm i -D vitest @supabase/supabase-js dotenv
//   supabase start
//   supabase status  ← API URL / anon key / service_role key を確認し .env.local に記載
//
// .env.test の例:
//   SUPABASE_URL=http://127.0.0.1:54321
//   SUPABASE_ANON_KEY=xxx
//   SUPABASE_SERVICE_ROLE_KEY=xxx
//
// 実行:
//   npx vitest run tests/onboarding-flow.test.ts

import 'dotenv/config'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const URL = process.env.NUXT_SUPABASE_PROJECT_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.NUXT_SUPABASE_PUBLISHABLE_KEY!
const SERVICE_ROLE_KEY = process.env.NUXT_SUPABASE_SERVICE_ROLE!

const OWNER_EMAIL = 'owner_flow@example.com'
const OWNER_PASSWORD = 'test-password-1234'

const admin = createClient(URL, SERVICE_ROLE_KEY)
let tenantId: string // 自テナント
let tenantId2: string // 他のテナント
let client: SupabaseClient
let userId: string
let mailAccountId: string
let emailId: string

describe('ログイン〜メール送信準備完了までのオンボーディングフロー', () => {

  beforeAll(async () => {
    // テナント/オーナー事前登録(管理者がSupabase Studioで行う操作を再現)
    // テストユーザー作成(Googleログインの代わり)。既にいれば作り直す
    const { data: list } = await admin.auth.admin.listUsers()
    const existing = list.users.find(u => u.email === OWNER_EMAIL)
    if (existing) {
      const { data, error } = await admin.auth.admin.deleteUser(existing.id)
      // expect(error).toBeNull()
    }
    const { error: createErr } = await admin.auth.admin.createUser({
      email: OWNER_EMAIL, password: OWNER_PASSWORD, email_confirm: true,
    })
    // expect(createErr).toBeNull()

    // テナントとテストユーザをtenant_usersに登録しておく
    //  既存確認・削除
    const { data: tenant_old, error } = await admin
      .from('tenants')
      .select('tenant_id')
      .eq('slug', 'pta-flow-test')
      .single()
    if (tenant_old) {
      await admin.from('tenants').delete().eq('tenant_id', tenant_old.tenant_id)
    }
    //  テナント作成
    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({ name: 'PTA Flow Test', slug: 'pta-flow-test' })
      .select()
      .single()
    if (tenantError) {
      throw tenantError
    }
    tenantId = tenant.tenant_id
    // ユーザ(オーナー)作成
    const { error: preRegError } = await admin
      .from('tenant_users')
      .insert({ tenant_id: tenantId, name: 'オーナー', email_addr: OWNER_EMAIL })
    if (preRegError) {
      throw preRegError
    }

    // 他テナントを登録しておく
    //  既存確認・削除
    const { data: tenant2_old, error: tenant2_old_error } = await admin
      .from('tenants')
      .select('tenant_id')
      .eq('slug', 'other')
      .single()
    if (tenant2_old) {
      await admin.from('tenants').delete().eq('tenant_id', tenant2_old.tenant_id)
    }
    //  他テナント作成
    const { data: tenant2, error: tenant2Error } = await admin
      .from('tenants')
      .insert({ name: 'PTA Flow Test 2', slug: 'other' })
      .select()
      .single()
    if (tenant2Error) {
      throw tenant2Error
    }
    tenantId2 = tenant2.tenant_id

    client = createClient(URL, ANON_KEY)
  })

  afterAll(async () => {
    return
    await client.auth.signOut()
    await admin.from('tenants').delete().eq('tenant_id', tenantId)
    const { data: list } = await admin.auth.admin.listUsers()
    const existing = list.users.find(u => u.email === OWNER_EMAIL)
    if (existing) await admin.auth.admin.deleteUser(existing.id)
  })

  it('1. ログインできる(Google OAuthの代わりにpasswordでサインイン)', async () => {
    const { data, error } = await client.auth.signInWithPassword({
      email: OWNER_EMAIL, password: OWNER_PASSWORD,
    })
    expect(error).toBeNull()
    expect(data.user?.id).toBeTruthy()
    userId = data.user!.id
  })

  it('2. /auth/callback相当: link_my_tenant_user で自動紐付けされる', async () => {
    const { error } = await client.rpc('link_my_tenant_user')
    expect(error).toBeNull()

    const { data: row, error: selErr } = await admin
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('email_addr', OWNER_EMAIL)
      .maybeSingle()
    expect(selErr).toBeNull()
    expect(row?.user_id).toBe(userId)
  })

  it('3. /select-tenant相当: 所属テナントが1件取得できる', async () => {
    const { data, error } = await client
      .from('tenant_users')
      .select('tenant_id, tenants(name, slug, brand_name, brand_icon_url)')
      .eq('user_id', userId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].tenant_id).toBe(tenantId)
  })

  it('4. /[tenant]/admin: sync_tenant_members でメンバーが同期される', async () => {
    const { data, error } = await client.rpc('sync_tenant_members', {
      p_tenant_id: tenantId,
      p_members: [
        { email: OWNER_EMAIL, name: 'オーナー' },
        { email: 'member_flow@example.com', name: 'メンバー' },
      ],
    })
    expect(error).toBeNull()
    expect(data.filter((r: any) => r.action === 'synced')).toHaveLength(2)
  })

  it('5. Google Service Accountを登録できる', async () => {
    const { error } = await client.rpc('upsert_tenant_google_credential', {
      p_tenant_id: tenantId,
      p_service_account_json: {
        client_email: 'sa-flow@dummy-project.iam.gserviceaccount.com',
        private_key_id: 'dummy-key-id',
        private_key: '-----BEGIN PRIVATE KEY-----\nDUMMY\n-----END PRIVATE KEY-----\n',
      },
    })
    expect(error).toBeNull()

    const { data: row } = await admin
      .from('tenant_google_credentials')
      .select('service_account_email')
      .eq('tenant_id', tenantId)
      .single()
    expect(row?.service_account_email).toBe('sa-flow@dummy-project.iam.gserviceaccount.com')
  })

  it('6. members_sheet_configを登録できる', async () => {
    const config = {
      tenant_id: tenantId,
      sheet_id: 'dummy sheet id',
      sheet_name: 'dummy sheet name',
      email_column_name: 'email_addr',
      name_column_name: 'user_name',
      filter_column_name: 'ステータス',
      filter_column_values: ["1", "2"]
    }
    const { data, error } = await client.from('members_sheet_config').upsert(config, { onConflict: 'tenant_id' }).select().single()
    expect(error).toBeNull()
    expect(data?.tenant_id).toBe(tenantId)
  })
  it('7. members_sheet_configを更新できる', async () => {
    const config = {
      tenant_id: tenantId,
      sheet_id: 'dummy sheet id',
      sheet_name: 'dummy sheet name2',
      email_column_name: 'email_addr',
      name_column_name: 'user_name',
      filter_column_name: 'ステータス',
      filter_column_values: ["0", "1", "2"]
    }
    const { data, error } = await client.from('members_sheet_config').upsert(config, { onConflict: 'tenant_id' }).select().single()
    expect(error).toBeNull()
    expect(data?.tenant_id).toBe(tenantId)
    expect(data?.sheet_name).toBe('dummy sheet name2')
  })
  it('8. 他のテナントのmembers_sheet_configを更新できない', async () => {
    const config = {
      tenant_id: tenantId2,
      sheet_id: 'dummy sheet id',
      email_column_name: 'email_addr',
      name_column_name: 'user_name',
      filter_column_name: 'ステータス',
      filter_column_values: ["0", "1", "2"]
    }
    const { data, error } = await client.from('members_sheet_config').upsert(config, { onConflict: 'tenant_id' }).select().single()
    expect(data).toBeNull()
    expect(error?.code).toBe("42501")
  })

  it('9. slack2mail config シートIDを登録できる', async () => {
    const config = { tenant_id: tenantId, sheet_id: 'slack2mail_config_sheet_id_old' }
    const { data, error } = await client.from('slack2mail_sheet_config').upsert(config, { onConflict: 'tenant_id' }).select().single()
    expect(error).toBeNull();
    expect(data.tenant_id).toBe(tenantId);
  })
  it('10. slack2mail config シートIDを更新できる', async () => {
    const config = { tenant_id: tenantId, sheet_id: 'slack2mail_config_sheet_id' }
    const { data, error } = await client.from('slack2mail_sheet_config').upsert(config, { onConflict: 'tenant_id' }).select().single()
    expect(error).toBeNull();
    expect(data.tenant_id).toBe(tenantId);
  })
  it('11. 他のテナントのslack2mail config シートIDを更新できない', async () => {
    const config = { tenant_id: tenantId2, sheet_id: 'slack2mail_config_sheet_id' }
    const { data, error } = await client.from('slack2mail_sheet_config').upsert(config, { onConflict: 'tenant_id' }).select().single()
    expect(data).toBeNull()
    expect(error?.code).toBe("42501")
  })

  it('12. イベント設定・参加者データを同期できる', async () => {
    const { error: configErr } = await client.rpc('sync_event_configs', {
      p_tenant_id: tenantId,
      p_configs: [{
        event_name: '夏祭り2026', sheet_id: 'sheet-x', sheet_name: '参加者',
        header: 1, id_column: 'ID', email_column: 'メール', filter_columns: ['学年'],
        embeded_columns: ['氏名'], sender_name: '総務', sender_email_addr: 'soumu@example.com',
      }],
    })
    expect(configErr).toBeNull()

    const { data: dataResult, error: dataErr } = await client.rpc('sync_event_data', {
      p_tenant_id: tenantId,
      p_event_name: '夏祭り2026',
      p_rows: [{ data_id: '1', email_addr: 'p1@example.com', event_attr: { 氏名: '参加者1' } }],
    })
    expect(dataErr).toBeNull()
    expect(dataResult.filter((r: any) => r.action === 'synced')).toHaveLength(1)
  })

  it('13. 送信アカウント・送信サーバを登録できる', async () => {
    const { data: account, error: accountErr } = await client
      .from('mail_account')
      .insert({ tenant_id: tenantId, name: '総務', email_addr: 'soumu@example.com', default: true })
      .select()
      .single()
    expect(accountErr).toBeNull()
    mailAccountId = account!.id

    const { error: serverErr } = await client
      .from('mail_server')
      .insert({
        tenant_id: tenantId, name: 'メインサーバ',
        smtp_server: 'smtp.example.com', smtp_port: '587', smtp_secure: true,
        imap_server: 'imap.example.com', imap_port: '993', imap_secure: true,
      })
    expect(serverErr).toBeNull()
  })

  it('14. メールを送信待ち状態で保存できる(=送信準備完了)', async () => {
    emailId = randomUUID()
    const { error } = await client.from('emails').insert({
      email_id: emailId,
      tenant_id: tenantId,
      subject: 'テストメール',
      body: '本文',
      event_name: '夏祭り2026',
      status: 'pending',
      mail_account_id: mailAccountId,
      approval_channel: 'C035PLBN13P',
      approval_thread_ts: '1788182997.047189'
    })
    expect(error).toBeNull()
  })

  it('15. Slackワークスペースをテナントに紐付けられる', async () => {
    const { data, error } = await client
      .from('slack_workspaces')
      .insert({
        tenant_id: tenantId,
        team_id: 'T-FLOW-TEST-0099',
        team_name: 'PTA Flow Test Workspace',
        bot_user_id: 'U-BOT-0099',
        bot_token: 'xoxb-dummy-token',
        installed_user_id: 'U-INSTALLER-0099',
        installed_at: new Date().toISOString(),
      })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data?.tenant_id).toBe(tenantId)

    // 自テナント分が読めることを確認
    const { data: rows, error: selErr } = await client
      .from('slack_workspaces')
      .select('team_id')
      .eq('tenant_id', tenantId)
    expect(selErr).toBeNull()
    expect(rows).toHaveLength(1)
    expect(rows![0].team_id).toBe('T-FLOW-TEST-0099')
  })

  it('16. team_idの重複登録は拒否される(1ワークスペース=1テナントの保証)', async () => {
    const { error } = await client
      .from('slack_workspaces')
      .insert({ tenant_id: tenantId, team_id: 'T-FLOW-TEST-0099' })
    expect(error).not.toBeNull() // unique制約違反で失敗するはず
  })

  it('17. 送達記録(sent_emails)を保存・参照できる', async () => {
    const trackingToken = randomUUID().replace(/-/g, '').slice(0, 26)

    const { error: insertErr } = await client.from('sent_emails').insert({
      tracking_token: trackingToken,
      tenant_id: tenantId,
      email_id: emailId,
      event_email_addr: 'p1@example.com',
      sent_at: new Date().toISOString(),
      received: false,
    })
    expect(insertErr).toBeNull()

    // 受信確認(リンククリック相当)の更新
    const { error: updateErr } = await client
      .from('sent_emails')
      .update({ received: true, receive_checked_at: new Date().toISOString() })
      .eq('tracking_token', trackingToken)
    expect(updateErr).toBeNull()

    const { data, error: selErr } = await client
      .from('sent_emails')
      .select('email_id, received')
      .eq('tracking_token', trackingToken)
      .single()
    expect(selErr).toBeNull()
    expect(data?.email_id).toBe(emailId)
    expect(data?.received).toBe(true)
  })


})