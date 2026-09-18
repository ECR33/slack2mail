// server/api/debug-env.ts
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const cfEnv = event.context.cloudflare?.env

  if (process.env.NODE_ENV != 'production') {
    console.info('Runtime Config', config)
  }

  return {
    timestamp: new Date().toISOString(),
    // RuntimeConfig のチェック（値自体は出さず、存在の有無だけ判定）
    runtimeConfig: {
      hasSupabaseUrl: !!config.public?.supabase?.url || !!config.supabaseUrl,
      hasSupabaseKey: !!config.supabaseServiceKey,
    },
    // Cloudflare Workers 直接バインド環境変数のチェック
    cloudflareEnvKeys: cfEnv ? Object.keys(cfEnv) : [],
    // nodejs_compat が有効かどうかの簡易確認
    hasProcessEnv: typeof process !== 'undefined' && !!process.env,
  }
})