/**
 * Supabaseにログインした際のコールバック
 * codeを受取りトークンを取得する
 * その後 画面側を/select-tenantにリダイレクトする
 */
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async event => {
    const query = getQuery(event)
    const code = query.code as string | undefined

    if (code) {
        const supabase = await serverSupabaseClient(event)
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        console.error('exchangeCodeForSession', error?.message)

        if (!error) {
            // ログイン確定後に1回だけ呼ぶ自動紐付け処理
            const { error: linkError } = await supabase.rpc('link_my_tenant_user')
            console.error('link_my_tenant_user', linkError?.message)
            if (linkError) {
                // 失敗してもRLSによる安全性は損なわれないため致命的エラーにはしない
                console.error('link_my_tenant_user failed:', linkError)
            }
            return sendRedirect(event, '/select-tenant')
        }
    }
    return sendRedirect(event, '/login?error=auth-failed')
})