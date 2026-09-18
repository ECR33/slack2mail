<template>
    <div v-if="!slug">
        <h1>slack2mail</h1>
        <v-row>
            <v-col cols="12">
                SlackのUIからメールを送信するアプリです。
            </v-col>
            <v-col cols="12">
                <a href="https://apps.hinogakuenpta.org/applications.html#slack2mail" target="_black">アプリ紹介</a>
            </v-col>
            <v-col cols="12">
                利用するにはログインしてください。
            </v-col>
        </v-row>
        <v-row>
            <v-col>
                <v-btn @click="login">Googleでログイン</v-btn>
            </v-col>
        </v-row>
        <v-row v-if="user">
            <v-col cols="12">利用する権限がありませんでした</v-col>
            <v-col><v-btn @click="logout">完全ログアウト</v-btn></v-col>
        </v-row>
    </div>
    <div v-else>
        <v-row class="justify-center">
            <v-col cols="12" sm="4">
                <div class="img-box">
                    <v-img :src="brand_icon" max-width="150" height="150" class="ma-5" />
                </div>
                <v-list>
                    <v-list-item v-for="menuItem in menuItems" :keys="menuItem.link">
                        <template v-slot:prepend>
                            <v-icon :icon="menuItem.icon" />
                        </template>
                        <v-list-item :to="`/${slug}${menuItem.link}`">
                            {{ menuItem.title }}
                        </v-list-item>
                    </v-list-item>
                    <v-list-item>
                        <a href="https://apps.hinogakuenpta.org/applications.html#slack2mail" target="_black">アプリ紹介</a>
                    </v-list-item>
                </v-list>
            </v-col>
        </v-row>
    </div>
</template>

<script setup lang="ts">
import { supabaseSignOut } from '#shared/utils/supabase'

const config = useRuntimeConfig()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const currentTenant = useCurrentTenant()
const slug = currentTenant.value?.slug
const brand_icon = currentTenant.value?.brand_icon_url ?? '/slack2mail_icon.png'

const login = async () => {
    await loginWithGoogle(config.public.appUrl, supabase)
}

const logout = async () => {
    await supabaseSignOut(supabase)
}

onMounted(async () => {
})
</script>
<style lang="css" scoped>
.img-box {
    display: flex;
    justify-content: center;
    border: 1px solid #fefefe;
    border-radius: 5px;
    background-color: rgba(200, 200, 200, 0.3);
    margin: 1em 0;
}
</style>