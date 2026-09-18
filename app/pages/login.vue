<template>
    <v-btn @click="login" :loading="loginLoading">Googleでログイン</v-btn>
</template>
<script setup lang="ts">
import { loginWithGoogle } from '#shared/utils/auth'

const loginLoading = ref(false)
const config = useRuntimeConfig()
const supabase = useSupabaseClient()

const login = async () => {
    loginLoading.value = true
    await loginWithGoogle(config.public.appUrl, supabase)
}

</script>