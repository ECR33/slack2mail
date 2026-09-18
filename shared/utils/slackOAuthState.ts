/**
 * Slack OAuthの `state` パラメータを扱うユーティリティ。
 *
 * Slackの oauth.v2.access のレスポンスには「どのテナント向けのインストールか」という
 * 情報が一切含まれないため、認可開始時に tenant_id を state に載せて Slack 経由で
 * 往復させる。改ざん・他テナントへのなりすましを防ぐため HMAC-SHA256 で署名する。
 *
 * サーバ側でnonceを保存する必要がないステートレス方式(JWTのシンプル版に相当)。
 * 有効期限を短く(数分)取ることでリプレイのリスクを抑える。
 */
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'

interface SlackOAuthStatePayload {
  tenantId: string
  /** state発行者(=インストール操作を行ったユーザ)。監査ログ用途。必須ではない */
  userId: string
  /** リプレイ攻撃対策用の使い捨て値。現状は検証していないが将来nonce保存方式に
   *  切り替える場合に備えてペイロードには含めておく */
  nonce: string
  /** UNIX seconds */
  exp: number
}

const STATE_TTL_SECONDS = 5 * 60 // 5分。認可画面での操作時間を考慮した余裕

function getStateSecret(): string {
  const secret = process.env.NUXT_SLACK_STATE_SECRET
  if (!secret) {
    throw new Error('NUXT_SLACK_STATE_SECRET is not set')
  }
  return secret
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payloadB64: string): string {
  return createHmac('sha256', getStateSecret()).update(payloadB64).digest('base64url')
}

/**
 * tenant_id / userId から署名付きstateを生成する。
 * Slackの認可URLの `state` クエリパラメータにそのまま渡す。
 */
export function createSlackOAuthState(tenantId: string, userId: string): string {
  const payload: SlackOAuthStatePayload = {
    tenantId,
    userId,
    nonce: randomUUID(),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  }
  const payloadB64 = base64url(JSON.stringify(payload))
  const signature = sign(payloadB64)
  return `${payloadB64}.${signature}`
}

/**
 * コールバック側で使用。署名・有効期限を検証し、問題なければペイロードを返す。
 * 不正・期限切れの場合は null を返す(呼び出し側で /unauthorized 等へ誘導する)。
 */
export function verifySlackOAuthState(state: string | undefined | null): SlackOAuthStatePayload | null {
  if (!state) return null

  const parts = state.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, signature] = parts

  if (!payloadB64 || !signature) {
    return null
  }
  const expectedSignature = sign(payloadB64)

  // 長さが異なるとtimingSafeEqualが例外を投げるため事前にチェック
  const sigBuf = Buffer.from(signature, 'base64url')
  const expectedBuf = Buffer.from(expectedSignature, 'base64url')
  if (sigBuf.length !== expectedBuf.length) return null
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null

  let payload: SlackOAuthStatePayload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'))
  } catch {
    return null
  }

  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    return null // 期限切れ
  }
  if (!payload.tenantId || !payload.userId) {
    return null
  }

  return payload
}
