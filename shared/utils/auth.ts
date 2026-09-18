import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Googleを 使用してサインインする
 * @param appUrl アプリケーションのURL const config = useRuntimeConfig();config.public.appUrl
 * @param supabase supabase client
 */
export const loginWithGoogle = async (appUrl: string, supabase: SupabaseClient) => {
    console.info('loginWithGoogle', appUrl)
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: `${appUrl}/api/auth-callback`
        }
    })
    if (error) {
        console.error('Google Auth Error: ', error)
        throw error
    }
}