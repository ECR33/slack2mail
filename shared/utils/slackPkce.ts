/**
 * Slack OAuthのPKCE(Proof Key for Code Exchange)対応。
 *
 * PKCEはauthorization codeの横取り攻撃対策。
 * - start: code_verifierを生成し、そのSHA256ハッシュ(code_challenge)を認可URLに乗せる
 * - callback: token交換時にcode_verifierをそのまま渡す。Slack側でcode_challengeと
 *   一致するか検証される
 *
 * `state`(tenant_idの署名)とは別の仕組み。stateは「どのテナント向けか」の改ざん防止、
 * PKCEは「認可コードの横取り」対策であり、役割が異なるため両方必要。
 */
import { randomBytes, createHash } from 'node:crypto'

// callback側でも同じCookie名を参照するため、ここで一元管理する
export const SLACK_PKCE_COOKIE_NAME = 'slack_oauth_pkce_verifier'
// stateの有効期限(5分)と合わせる
export const SLACK_PKCE_COOKIE_MAX_AGE_SECONDS = 5 * 60

export interface PkcePair {
  verifier: string
  challenge: string
}

/**
 * RFC7636準拠のcode_verifier(43〜128文字の範囲)とそのS256ハッシュのペアを生成する。
 */
export function createPkcePair(): PkcePair {
  // 32byte -> base64url化すると43文字になり、RFC7636の下限(43文字)をちょうど満たす
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}
