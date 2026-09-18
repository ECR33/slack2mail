<template>
    <v-row v-if="!user" class="justify-center">
        <v-col cols="12" sm="4">
            <h1>slack2mail</h1>
            <div class="img-box">
                <v-img src="/slack2mail_icon.png" max-width="150" height="150" class="ma-5" />
            </div>
            <v-row>
                <v-col cols="12">
                    SlackのUIからメールを送信するアプリです。
                </v-col>
                <v-col cols="12">
                    <a href="https://apps.hinogakuenpta.org/applications.html#slack2mail" target="_black">アプリ紹介</a>
                </v-col>
                <v-col cols="12">
                    利用するにはログインしてください。<br />
                    ※ 管理者による事前登録が必要です。
                </v-col>
            </v-row>
            <v-row>
                <v-col>
                    <v-btn @click="login" :loading="loginLoading">Googleでログイン</v-btn>
                </v-col>
            </v-row>
            <v-row v-if="user">
                <v-col cols="12">利用する権限がありませんでした</v-col>
                <v-col><v-btn @click="logout">完全ログアウト</v-btn></v-col>
            </v-row>
        </v-col>
    </v-row>
    <v-row v-else>
        ログインできたけど..なにかおかしいぞ!?
    </v-row>
</template>

<script setup lang="ts">
import { supabaseSignOut } from '#shared/utils/supabase'

const loginLoading = ref(false)

const config = useRuntimeConfig()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const currentTenant = useCurrentTenant()
const slug = currentTenant.value?.slug

const login = async () => {
    loginLoading.value = true
    await loginWithGoogle(config.public.appUrl, supabase)
}

const logout = async () => {
    await supabaseSignOut(supabase)
}
onMounted(async () => {
    if (user.value) {
        const router = useRouter()
        if (slug) {
            router.push(`${slug}`)
        } else {
            router.push('/select-tenant')
        }
    }
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