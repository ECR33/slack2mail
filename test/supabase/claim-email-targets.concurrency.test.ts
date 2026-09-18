// tests/integration/claim-email-targets.concurrency.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import type { Database } from '~/types/database.types'

// このテストはローカルSupabase(`supabase start`)の起動を前提とします。
// pgTAPでは検証できない「本当に同時にリクエストが来た場合の排他制御」を
// 実際のネットワーク越しのRPC呼び出しで検証します。
// (前のジョブがまだ処理中の状態で次のジョブが起動しても二重送信が起きないことの確認)

const SUPABASE_URL = process.env.NUXT_SUPABASE_PROJECT_URL ?? 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.NUXT_SUPABASE_SERVICE_ROLE

describe('claim_and_expand_email_targets / claim_pending_sent_targets の並行実行安全性', () => {
  let supabase: SupabaseClient<Database>
  let tenantId: string
  const eventName = 'concurrency-test-event'
  const emailId = `email-concurrency-${randomUUID()}`
  const targetCount = 5 // event_dataの件数(=期待される宛先数)

  beforeAll(async () => {
    if (!SERVICE_ROLE_KEY) {
      throw new Error('NUXT_SUPABASE_SERVICE_ROLE が設定されていません。`supabase status`で確認してください。')
    }
    supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY)

    tenantId = randomUUID()

    const { error: tenantError } = await supabase.from('tenants').insert({
      tenant_id: tenantId,
      name: 'Concurrency Test Tenant',
      slug: `concurrency-${tenantId.slice(0, 8)}`,
    })
    if (tenantError) throw tenantError

    const { error: configError } = await supabase.from('event_config').insert({
      tenant_id: tenantId,
      event_name: eventName,
    })
    if (configError) throw configError

    const eventDataRows = Array.from({ length: targetCount }, (_, i) => ({
      tenant_id: tenantId,
      event_name: eventName,
      data_id: `${i + 1}`,
      email_addr: `addr${i + 1}@example.com`,
      event_attr: {},
      embeded_values: { index: i + 1 },
    }))
    const { error: dataError } = await supabase.from('event_data').insert(eventDataRows)
    if (dataError) throw dataError

    const { error: emailError } = await supabase.from('emails').insert({
      email_id: emailId,
      tenant_id: tenantId,
      subject: '並行実行テスト',
      body: '本文',
      event_name: eventName,
      event_filter: null,
      status: 'approved',
      approval_channel: 'C_TEST',
      approval_thread_ts: 'T_TEST',
    })
    if (emailError) throw emailError
  })

  afterAll(async () => {
    // tenants削除ですべての子テーブルがON DELETE CASCADEで一緒に消える
    // await supabase.from('tenants').delete().eq('tenant_id', tenantId)
  })

  // NOTE: この2つのテストは実行順序に依存しています(1つ目が作ったsent_emailsを2つ目が使う)。
  // vitestはdescribe内をデフォルトで宣言順に実行するため、shuffleオプションを有効にしていなければ問題ありません。

  it('claim_and_expand_email_targetsを同時に複数回呼んでも展開は1回だけ行われる', async () => {
    const concurrency = 8

    const results = await Promise.all(
      Array.from({ length: concurrency }, () =>
        supabase.rpc('claim_and_expand_email_targets', {
          p_tenant_id: tenantId,
          p_email_id: emailId,
          p_event_name: eventName,
          p_filter: null,
        })
      )
    )

    for (const { error } of results) {
      expect(error).toBeNull()
    }

    const claimedResults = results.filter((r) => (r.data as any)?.claimed === true)
    const notClaimedResults = results.filter((r) => (r.data as any)?.claimed === false)

    // 同時に呼んでも「掴めた」のはちょうど1回だけであるべき
    expect(claimedResults).toHaveLength(1)
    expect(notClaimedResults).toHaveLength(concurrency - 1)

    // 掴めた側だけが宛先を展開しているはず
    const claimedTargets = (claimedResults[0]!.data as any).targets
    expect(claimedTargets).toHaveLength(targetCount)

    // 掴めなかった側は空配列
    for (const r of notClaimedResults) {
      expect((r.data as any).targets).toEqual([])
    }

    // emailsのステータスがexpandedになっている
    const { data: emailRow, error: emailErr } = await supabase
      .from('emails')
      .select('status')
      .eq('email_id', emailId)
      .single()
    expect(emailErr).toBeNull()
    expect(emailRow?.status).toBe('expanded')

    // sent_emailsが重複展開されていない(ちょうどtargetCount件)
    const { count, error: countErr } = await supabase
      .from('sent_emails')
      .select('*', { count: 'exact', head: true })
      .eq('email_id', emailId)
    expect(countErr).toBeNull()
    expect(count).toBe(targetCount)
  })

  it('claim_pending_sent_targetsを同時に複数回呼んでも各宛先はどれか1回しかclaimされない', async () => {
    const concurrency = 8

    const results = await Promise.all(
      Array.from({ length: concurrency }, () =>
        supabase.rpc('claim_pending_sent_targets', {
          p_tenant_id: tenantId,
          p_email_id: emailId,
        })
      )
    )

    for (const { error } of results) {
      expect(error).toBeNull()
    }

    // 各呼び出しが取得したtracking_tokenを集める
    const allClaimedTokens = results.flatMap((r) => (r.data ?? []).map((row: any) => row.tracking_token))

    // 合計claimできた件数は宛先の総数と一致する(取りこぼしがない)
    expect(allClaimedTokens).toHaveLength(targetCount)

    // 重複が無い(同じ宛先が2つの呼び出しに二重にclaimされていない)
    const uniqueTokens = new Set(allClaimedTokens)
    expect(uniqueTokens.size).toBe(targetCount)

    // DB側でも全件sendingになっている
    const { data: sentRows, error: sentErr } = await supabase
      .from('sent_emails')
      .select('status')
      .eq('email_id', emailId)
    expect(sentErr).toBeNull()
    expect(sentRows?.every((row) => row.status === 'sending')).toBe(true)
  })
})