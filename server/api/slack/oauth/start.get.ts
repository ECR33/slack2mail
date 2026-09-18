/**
 * GET /api/slack/oauth/start?tenant=<slug>
 *
 * `/[tenant]/admin` の「Slackと連携」ボタンから呼ばれる。
 * 1. ログイン済みユーザが対象テナントに所属しているか再確認する
 *    (admin画面の表示時点とボタン押下時でタイムラグがあり得るため、ここでも必ず確認する)
 * 2. tenant_id を署名付きstateに詰めて Slack の認可URLへリダイレクトする
 *
 * 実際の team_id / bot_token 等の取得・保存は
 * /api/slack/oauth/callback (このあと実装) で行う。
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
// createSlackOAuthState / createPkcePair 等 server/utils 配下の関数はNitroの自動importに任せる
import type { Database } from '~/types/database.types'

const SLACK_AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize'

// manifestのoauth_config.scopes.botと必ず一致させること(ズレるとSlack側で
// 「未申請スコープ」としてエラーになる、または過剰スコープを要求してしまう)。
// files:read等のコメントアウト中のスコープを使い始めたら、こちらとmanifest両方を更新する。
const BOT_SCOPES = [
  'chat:write',
  'chat:write.public',
  'commands',
  'users:read',
] as const

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const slug = typeof query.tenant === 'string' ? query.tenant : null

  if (!slug) {
    throw createError({ statusCode: 400, message: 'tenant is required' })
  }

  // --- 1. 認証チェック ---
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'login required' })
  }

  const client = await serverSupabaseClient<Database>(event)

  // slugからtenant_idを引く。RLS(is_member_of_tenant)により、
  // 所属していないテナントのslugは「存在しない」のと同じ結果(0件)になる。
  // これによりURLのslug方式と同様、存在有無を外部から推測できないようにする。
  const { data: tenant, error: tenantError } = await client
    .from('tenants')
    .select('tenant_id')
    .eq('slug', slug)
    .maybeSingle()

  if (tenantError) {
    throw createError({ statusCode: 500, message: 'failed to resolve tenant' })
  }
  if (!tenant) {
    // 存在しないslug/未所属slugを区別しない(既存のmiddleware方針と統一)
    throw createError({ statusCode: 404, message: 'not found' })
  }

  // 上のselectがRLSで既に絞られているため冗長ではあるが、
  // 「このAPIが将来service_role経由に変わっても安全であるように」
  // 明示的にもう一段チェックしておく(Google認証情報のupsert関数と同じ考え方)。
  const { data: isMember, error: memberError } = await client
    .rpc('is_member_of_tenant', { check_tenant_id: tenant.tenant_id })

  if (memberError || !isMember) {
    throw createError({ statusCode: 404, message: 'not found' })
  }

  // --- 2. 署名付きstateを発行してSlackへリダイレクト ---
  const clientId = process.env.NUXT_SLACK_CLIENT_ID
  const redirectUri = process.env.NUXT_SLACK_REDIRECT_URI // 例: https://app.example.com/api/slack/oauth/callback
  if (!clientId || !redirectUri) {
    throw createError({ statusCode: 500, message: 'slack oauth is not configured' })
  }

  const state = createSlackOAuthState(tenant.tenant_id, user.sub) // user.id

  // --- PKCE: code_verifierを生成し、callbackで使うためCookieに一時保存する ---
  // stateのように署名して往復させる方式も取れるが、code_verifierはSlackへは渡さず
  // 手元(サーバ)だけで保持すればよい値なので、短命なhttpOnly Cookieに保存する方式にする。
  const { verifier, challenge } = createPkcePair()
  setCookie(event, SLACK_PKCE_COOKIE_NAME, verifier, {
    httpOnly: true,
    secure: true,
    // Slackからのcallbackはトップレベルの遷移(通常のリダイレクト)としてCookieが送られる
    // 必要があるため、'strict'ではなく'lax'にする('strict'だと外部サイトからの遷移時に送られない)
    sameSite: 'lax',
    maxAge: SLACK_PKCE_COOKIE_MAX_AGE_SECONDS,
    path: '/api/slack/oauth', // start/callback配下でのみ送信されればよい
  })

  const authorizeUrl = new URL(SLACK_AUTHORIZE_URL)
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('scope', BOT_SCOPES.join(','))
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('code_challenge', challenge)
  authorizeUrl.searchParams.set('code_challenge_method', 'S256')

  return sendRedirect(event, authorizeUrl.toString())
})
