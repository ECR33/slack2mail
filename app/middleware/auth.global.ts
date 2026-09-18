import { defineNuxtRouteMiddleware, navigateTo } from "nuxt/app"

const publicRoutes = ['/', '/login', '/unauthorized', '/api/slack/oauth/callback', '/received']

export default defineNuxtRouteMiddleware(async (to) => {
    if (publicRoutes.includes(to.path)) {
        return
    }

    const user = useSupabaseUser()
    if (process.env.NODE_ENV != 'production') {
        console.debug('auth middleware: user', user)
    }
    if (!user.value) {
        return navigateTo('/login')
    }

    const currentTenant = useCurrentTenant()

    if (to.path === '/select-tenant') {
        // テナント選択画面にいる間は「現在のテナント」を確定させない
        currentTenant.value = null
        return
    }

    const tenantSlug = to.params.tenant as string | undefined
    if (!tenantSlug) {
        return navigateTo('/select-tenant')
    }

    const supabase = useSupabaseClient()
    const { data: membership, error } = await supabase
        .from('tenant_users')
        .select('tenant_id, tenants!inner(name, slug, brand_name, brand_icon_url)')
        // .eq('user_id', user.value.id)
        .eq('tenants.slug', tenantSlug)
        .maybeSingle()

    if (error || !membership) {
        currentTenant.value = null
        return navigateTo('/unauthorized')
    }
    // 所属チェックのために取得済みの値をそのまま保存する(再取得しない)
    currentTenant.value = {
        tenant_id: membership.tenant_id,
        slug: membership.tenants!.slug,
        name: membership.tenants!.name,
        brand_name: membership.tenants!.brand_name ?? membership.tenants!.name,
        brand_icon_url: membership.tenants!.brand_icon_url,
    }
})