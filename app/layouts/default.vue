<template>
    <v-app-bar>
        <template v-slot:prepend>
            <v-img :src="'/slack2mail_icon.png'" width="30" height="30" />
        </template>
        <v-app-bar-title>
            <span>slack2mail</span><span v-if="slug"> - {{ currentTenant?.brand_name }}</span>
        </v-app-bar-title>
        <div v-if="currentTenant?.slug">
            <div class="d-none d-md-flex align-center">
                <v-btn to="/select-tenant" variant="text">Top</v-btn>
                <v-btn v-for="menuItem in menuItems" :keys="menuItem.link" :to="`/${slug}${menuItem.link}`">{{
                    menuItem.title
                    }}</v-btn>
                <v-btn :to="`/${slug}/admin`" variant="text"><v-icon>mdi-cog</v-icon></v-btn>
                <v-switch v-model="isDark" inset true-icon="mdi-weather-night" false-icon="mdi-weather-sunny"
                    size="small" hide-details class="ml-2" />
            </div>
            <div class="d-flex d-md-none">
                <v-menu>
                    <template v-slot:activator="{ props }">
                        <v-app-bar-nav-icon v-bind="props" />
                    </template>
                    <v-list>
                        <v-list-item to="/">Top</v-list-item>
                        <v-list-item v-for="menuItem in menuItems" :keys="menuItem.link"
                            :to="`/${slug}${menuItem.link}`">{{
                                menuItem.title }}</v-list-item>
                        <v-list-item :to="`/${slug}/admin`">設定</v-list-item>
                        <v-list-item>
                            <v-switch v-model="isDark" inset true-icon="mdi-weather-night"
                                false-icon="mdi-weather-sunny" label="テーマ" size="small" hide-details />
                        </v-list-item>
                    </v-list>
                </v-menu>
            </div>
        </div>
        <template v-slot:append>
            <v-menu>
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" icon="mdi-dots-vertical"></v-btn>
                </template>
                <v-list v-if="user && currentTenant?.slug">
                    <v-list-item :prepend-avatar="user.user_metadata?.picture">
                        <v-list-item-title>{{ user.user_metadata?.name }}</v-list-item-title>
                    </v-list-item>
                    <v-list-item>{{ user.user_metadata?.email }}</v-list-item>
                    <v-list-item>
                        <v-btn variant="text" @click="logout">ログアウト</v-btn>
                    </v-list-item>
                </v-list>
                <v-list v-else>
                    <v-list-item>
                        <v-btn variant="text" @click="login" :loading="loginLoading">Googleでログイン</v-btn>
                    </v-list-item>
                    <v-list-item>
                        <v-btn variant="text" @click="logout">ログアウト</v-btn>
                    </v-list-item>
                </v-list>
            </v-menu>
        </template>
    </v-app-bar>
    <v-main>
        <v-container>
            <slot />
        </v-container>
    </v-main>
</template>
<script setup lang="ts">
import { useTheme } from 'vuetify/lib/composables/theme.mjs'

const theme = useTheme()
const isDark = ref(false)
const themeCookie = useCookie('user-theme', { default: () => 'light' })

const loginLoading = ref(false)
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const config = useRuntimeConfig()
const currentTenant = useCurrentTenant()
let slug = currentTenant.value?.slug

watch(() => currentTenant.value, () => {
    slug = currentTenant.value?.slug
})

watch(() => isDark.value, () => {
    if (isDark.value) {
        themeCookie.value = 'dark'
        theme.change('dark')
    } else {
        themeCookie.value = 'light'
        theme.change('light')
    }
})

watch(() => themeCookie.value, () => {
    isDark.value = themeCookie.value == 'dark' ? true : false
})

const login = async () => {
    loginLoading.value = true
    await loginWithGoogle(config.public.appUrl, supabase)
}

const logout = async () => {
    await supabaseSignOut(supabase)
    window.location.href = '/'
}

onMounted(async () => {
    isDark.value = themeCookie.value == 'dark' ? true : false
})
</script>
<style>
/* v-main の padding-top を先に固定し、SSR直後のジャンプを消す workaround */
.v-main {
    --v-layout-top: 64px !important;
}
</style>