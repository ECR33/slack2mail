<template>
    <h1>メンバーリスト読込み</h1>
    <v-row>
        <v-col>
            <v-expansion-panels>
                <v-expansion-panel title="解説">
                    <template v-slot:text>
                        この画面ではメンバーリストをシステムに取り込みます。<br>
                        読込み対象のシートは「メンバーリストシート」のリンク先のドキュメントです。<br>
                        ※ シートの内容を確認したい場合はボタンから開いてください。<br>
                        <br>
                        「メンバーリスト読込み」ポタンを押下するとシートに記載された情報がシステムへ読み込まれます<br>
                        メンバーに変更があった場合はメンバーリストシートを修正し、再度読み込んでください。<br>
                        ※ シートから消えたメンバーはシステムからも削除されます。<br>
                        <br>
                        「メンバーリストシート」を他のシートに変更したい場合はギアアイコンから設定を変更してください。
                    </template>
                </v-expansion-panel>
            </v-expansion-panels>
        </v-col>
    </v-row>

    <v-row class="align-center">
        <v-col cols="12" sm="auto">
            <v-btn color="primary" class="action-btn" @click="syncTenantMembers" :loading="syncing">メンバーリスト読込み</v-btn>
        </v-col>
        <v-col cols="12" sm="auto">
            <v-btn variant="outlined" class="action-btn" prepend-icon="mdi-open-in-new" :href="memberListSheetUrl"
                target="_blank" rel="noopener noreferrer" :disabled="!memberListSheetId">メンバーリストシートを開く</v-btn>
        </v-col>
        <v-col cols="12" class="text-caption">メンバーリストシートから読み込み済みのメンバーを一覧表示します。検索は名前とメールアドレスで行えます。</v-col>
    </v-row>

    <v-row>
        <v-col>
            <h3>読み込み済みメンバー</h3>
        </v-col>
    </v-row>
    <v-row class="align-center">
        <v-col cols="12" md="5">
            <v-text-field v-model="keyword" clearable label="名前・メールアドレスで検索" placeholder="キーワード"
                prepend-icon="mdi-filter-outline" variant="outlined" density="compact" hide-details />
        </v-col>
        <v-col cols="12" md="auto" class="d-flex align-center">{{ _tenantUsers.length }}件<span
                v-if="keyword"> / 全{{ tenantUsers.length }}件</span></v-col>
    </v-row>

    <v-progress-linear indeterminate v-if="loading" />
    <MemberList :records="_tenantUsers" />

    <v-alert v-if="!loading && tenantUsers.length === 0" type="info" variant="tonal" class="mt-3">
        メンバーが0件です。「メンバーリスト読込み」を押すとメンバーリストシートから取り込まれます。
    </v-alert>
    <v-alert v-if="!loading && tenantUsers.length > 0 && _tenantUsers.length === 0" type="warning" variant="tonal"
        class="mt-3">
        検索に一致するメンバーが見つかりませんでした。
    </v-alert>

    <v-snackbar-queue v-model="snackbarMessages" :total-visible="5" closable></v-snackbar-queue>
</template>
<script setup lang="ts">
import { getMemberListSheetId } from '#shared/utils/supabase'
const loading = ref(false)
const syncing = ref(false)

const keyword = ref('')

const supabase = useSupabaseClient()
const currentTenant = useCurrentTenant()
const tenantId = currentTenant.value?.tenant_id || ''
const memberListSheetId = ref('')
const memberListSheetUrl = computed(() =>
    memberListSheetId.value ? `https://docs.google.com/spreadsheets/d/${memberListSheetId.value}` : ''
)

const tenantUsers = ref<TenantUsers[]>([])

const _tenantUsers = computed(() => {
    const q = keyword.value.trim().toLowerCase()
    if (!q) return tenantUsers.value
    return tenantUsers.value.filter(f =>
        (f.name || '').toLowerCase().includes(q) || (f.email_addr || '').toLowerCase().includes(q))
})

const getTenantUsers = async () => {
    loading.value = true
    try {
        const data = await $fetch<TenantUsers[]>('/api/get-tenant-members', { method: 'POST', body: { tenantId: tenantId } })
        if (data) {
            tenantUsers.value = data
        }
    } catch (error) {
        const message = errorMessage(error)
        console.error('getTenantUsers', message)
        addMessage('error', `メンバー一覧の取得に失敗しました: ${message}`)
    }
    loading.value = false
}

const syncTenantMembers = async () => {
    syncing.value = true
    try {
        const data = await $fetch<{ action: string, email_addr: string }[]>('/api/sync-tenant-members',
            { method: 'POST', body: { tenantId: tenantId } })
        const rows = data ?? []
        const synced = rows.filter(r => r.action === 'synced')
        const removed = rows.filter(r => r.action === 'removed')
        addMessage('success', `メンバーを${synced.length}件読み込みました`)
        if (removed.length > 0) {
            const shown = removed.slice(0, 5).map(r => r.email_addr).join(', ')
            addMessage('info', `シートになかったメンバー${removed.length}件を削除しました${removed.length > 5 ? ` (${shown} ほか${removed.length - 5}件)` : ` (${shown})`}`)
        }
        await getTenantUsers()
    } catch (error) {
        const message = errorMessage(error)
        console.error('syncTenantMembers', message)
        addMessage('error', `メンバーリスト読込みに失敗しました: ${message}`)
    }
    syncing.value = false
}

const errorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    return String(error)
}

const snackbarMessages = ref<{ text: string, color: string }[]>([])
const addMessage = (color: string, text: string) => {
    snackbarMessages.value.push({
        text,
        color
    })
}

onMounted(async () => {
    getTenantUsers()
    memberListSheetId.value = await getMemberListSheetId(tenantId, supabase)
})
</script>
<style scoped>
/* スマホでは操作ボタンを横幅いっぱいにしてタップ領域を大きくする */
@media (max-width: 599px) {
    .action-btn {
        width: 100%;
    }
}
</style>
