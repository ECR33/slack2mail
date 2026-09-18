<template>
    <v-row>
        <v-col class="">
            <v-img :src="brand_icon" :width="80" :height="80" class="mr-5" />
            <h1>
                {{ brand_name }}
            </h1>
        </v-col>
    </v-row>
    <v-card title="受信確認" :max-width="600" :loading="loading">
        <v-card-text v-html="message.replaceAll('\n', '<br>')"></v-card-text>
        <v-card-text>この画面は閉じていただいて大丈夫です。</v-card-text>
    </v-card>
</template>
<script setup lang="ts">
definePageMeta({
    layout: 'layout2'
})
const brand_name = ref<string>('slack2mail')
const brand_icon = ref<string>('/slack2mail_icon.png')
const message = ref<string>('')
const loading = ref(false)

onMounted(async () => {
    loading.value = true
    const query = useRoute().query ?? ''
    if (query.id) {
        const result = await $fetch('/api/receive-check', { query })
        if (result && result.result) {
            message.value = '受信されたことを通知しました。\nご対応いただきありがとうございました。'
            brand_name.value = result.brand_name
            brand_icon.value = result.brand_icon_url
        } else {
            message.value = '受信確認画面です。対応するメールがありませんでした。'
        }
    } else {
        message.value = '受信確認画面です。受信確認情報がありませんでした。'
    }
    loading.value = false
})
</script>