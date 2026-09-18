/**
 * GET /api/slack/oauth/callback?code=...&state=...
 *
 * /api/slack/oauth/start からのリダイレクトを受けて、
 * 1. state(tenant_idの署名)を検証
 * 2. PKCEのcode_verifier(Cookie)を検証
 * 3. codeをSlackのoauth.v2.accessでtoken交換
 * 4. upsert_slack_workspace() でteam情報をtenant_idに紐付けて保存
 * 5. テナントのadmin画面へリダイレクト
 *
 * エラー方針:
 * - stateの署名検証に成功した時点で tenant_id は信頼できるので、以降のエラーは
 *   極力 `/[tenant]/admin?slack_oauth_error=<code>` へ穏当にリダイレクトする
 *   (SlackConnectionCard.vue がこのクエリを見てエラー文言を出し分ける)
 * - state自体が読めない/改ざんされている等、tenant_idを信頼できない段階のエラーのみ
 *   汎用エラー(createError)として扱う
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
// SLACK_PKCE_COOKIE_NAME / verifySlackOAuthState は server/utils の自動importに任せる
import type { Database } from '~/types/database.types'

interface SlackOAuthV2AccessResponse {
  ok: boolean
  error?: string
  app_id?: string
  authed_user?: { id: string }
  team?: { id: string; name: string }
  enterprise?: { id: string; name: string } | null
  bot_user_id?: string
  access_token?: string // bot token (bot scopeを要求しているのでbot用が返る)
  token_type?: string
}

/** SlackConnectionCard.vue 側で文言を出し分けるためのエラーコード */
type SlackOAuthErrorCode =
  | 'access_denied' // Slackの認可画面でユーザーがキャンセルした(Slackが返すerrorそのまま使う場合もある)
  | 'missing_pkce_verifier'
  | 'session_mismatch'
  | 'server_not_configured'
  | 'slack_token_exchange_failed'
  | 'already_linked_other_tenant'
  | 'server_error'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : null
  const stateParam = typeof query.state === 'string' ? query.state : null
  const slackError = typeof query.error === 'string' ? query.error : null

  // 検証の成否にかかわらずCookieは必ず使い捨てる(使い回し防止)
  const verifier = getCookie(event, SLACK_PKCE_COOKIE_NAME)
  deleteCookie(event, SLACK_PKCE_COOKIE_NAME, { path: '/api/slack/oauth' })

  if (!stateParam) {
    // stateが無ければtenant_idを一切信頼できないため、行き先を選びようがない
    throw createError({ statusCode: 400, message: 'missing state' })
  }

  const statePayload = verifySlackOAuthState(stateParam)
  if (!statePayload) {
    // 署名不正・期限切れ。tenant_idを信頼できないため汎用エラーのまま
    throw createError({ statusCode: 400, message: 'invalid or expired state' })
  }

  // ここから先はstatePayload.tenantIdを信頼してよい。
  // ユーザーセッションを確認しつつ、以降のエラーリダイレクト先(admin画面)のslugも
  // 併せて解決しておく(RLS越しのselectなので、なりすましユーザーには見えず
  // 自然に /select-tenant へのフォールバックになる)。
  const user = await serverSupabaseUser(event)
  const client = await serverSupabaseClient<Database>(event)

  let tenantSlug: string | null = null
  if (user && user.sub === statePayload.userId) {
    const { data: tenant } = await client
      .from('tenants')
      .select('slug')
      .eq('tenant_id', statePayload.tenantId)
      .maybeSingle()
    tenantSlug = tenant?.slug ?? null
  }

  function redirectWithError(errorCode: SlackOAuthErrorCode) {
    const base = tenantSlug ? `/${tenantSlug}/admin` : '/select-tenant'
    return sendRedirect(event, `${base}?slack_oauth_error=${encodeURIComponent(errorCode)}`)
  }

  // ユーザーが認可画面で「キャンセル」した場合など
  if (slackError) {
    console.error('slackError', slackError)
    return redirectWithError(slackError === 'access_denied' ? 'access_denied' : 'server_error')
  }

  if (!code) {
    console.error('code error -> server_error', code)
    return redirectWithError('server_error')
  }
  if (!verifier) {
    // Cookie有効期限切れ、別ブラウザ/シークレットタブでcallbackだけ開いた場合など
    console.error('verifier error -> missing_pkce_verifier', verifier)
    return redirectWithError('missing_pkce_verifier')
  }
  if (!user || user.sub !== statePayload.userId) {
    // 発行後にログアウト→別アカウントでログインし直した、等のケース
    console.error('user error -> session_mismatch', user?.sub, statePayload.userId)
    return redirectWithError('session_mismatch')
  }

  const clientId = process.env.NUXT_SLACK_CLIENT_ID
  const clientSecret = process.env.NUXT_SLACK_CLIENT_SECRET
  const redirectUri = process.env.NUXT_SLACK_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    return redirectWithError('server_not_configured')
  }

  // --- 1. codeをtokenに交換 ---
  const tokenRes = await $fetch<SlackOAuthV2AccessResponse>('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  })

  if (!tokenRes.ok || !tokenRes.access_token || !tokenRes.team || !tokenRes.authed_user) {
    return redirectWithError('slack_token_exchange_failed')
  }

  // --- 2. slack_workspacesへ保存(ユーザーのセッションクライアントで実行) ---
  // upsert_slack_workspace()内でis_member_of_tenant()チェック・他テナントへの
  // 付け替え防止ガードを行っているため、ここでは素直にRPCを呼ぶだけでよい。
  const { error: upsertError } = await client.rpc('upsert_slack_workspace', {
    p_tenant_id: statePayload.tenantId,
    p_team_id: tokenRes.team.id,
    p_team_name: tokenRes.team.name,
    p_enterprise_id: tokenRes.enterprise?.id,
    p_bot_user_id: tokenRes.bot_user_id,
    p_bot_token: tokenRes.access_token,
    p_installed_user_id: tokenRes.authed_user.id,
  })

  if (upsertError) {
    console.error('upsertError', upsertError)
    if (upsertError.message.includes('slack_team_already_linked_to_other_tenant')) {
      return redirectWithError('already_linked_other_tenant')
    }
    console.error('upsertError server_error', upsertError)
    return redirectWithError('server_error')
  }

  // --- 3. 完了。テナントのadmin画面へ戻す ---
  const redirectPath = tenantSlug ? `/${tenantSlug}/admin?slack_linked=1` : '/select-tenant?slack_linked=1'
  return sendRedirect(event, redirectPath)
})