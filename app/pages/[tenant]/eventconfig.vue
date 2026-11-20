<template>
    <h1>イベント設定読込み</h1>
    <v-row>
        <v-col>
            <v-expansion-panels>
                <v-expansion-panel title="解説">
                    <template v-slot:text>
                        この画面ではイベント設定をシステムに取り込みます。<br>
                        イベント設定とは、イベント向けの宛先が記載されたシートがどれか、またどの列を読み込むかを指定したシートです。<br>
                        読込み対象のシートは「設定用シート」のリンク先のドキュメントです。<br>
                        ※ シートの内容を確認したい場合はボタンから開いてください。<br>
                        <br>
                        「イベント設定読込み」ポタンを押下すると設定用シートから全イベントの設定を読み込みます<br>
                        参加者データ(イベントシート)を読むのは各イベントの「このイベントのシート読込み」です。<br>
                        <br>
                        「設定用シート」を他のシートに変更したい場合はギアアイコンから設定を変更してください。
                    </template>
                </v-expansion-panel>
            </v-expansion-panels>
        </v-col>
    </v-row>

    <v-row class="align-center">
        <v-col cols="12" sm="auto">
            <v-btn color="primary" @click="syncEventConfig" :loading="syncing">イベント設定読込み</v-btn>
        </v-col>
        <v-col cols="12" sm="auto">
            <v-btn variant="outlined" prepend-icon="mdi-open-in-new" :href="sheetConfigUrl" target="_blank"
                rel="noopener noreferrer" :disabled="!slack2mailSheetConfig.sheet_id">設定用シートを開く</v-btn>
        </v-col>
        <v-col cols="12" class="text-caption">設定用シートから全イベントの設定を読み込みます。参加者データの読込みは各イベントの行(カード)からイベント単位で行えます。</v-col>
    </v-row>

    <v-row>
        <v-col>
            <h3>現在の設定値</h3>
        </v-col>
    </v-row>
    <v-row class="align-center">
        <v-col cols="12" md="5">
            <v-text-field v-model="searchQuery" clearable label="イベント名・シート名で検索" prepend-icon="mdi-filter-outline"
                variant="outlined" density="compact" hide-details />
        </v-col>
        <v-col cols="12" md="auto" class="d-flex align-center">{{ filteredEventConfigs.length }}件<span
                v-if="searchQuery"> / 全{{ eventConfigs.length }}件</span></v-col>
    </v-row>

    <v-progress-linear indeterminate v-if="loading" />
    <EventConfig :records="filteredEventConfigs" :loading-event-name="loadingEventName" @load="loadSheet" />

    <v-alert v-if="!loading && eventConfigs.length === 0" type="info" variant="tonal" class="mt-3">
        イベント設定が0件です。「イベント設定読込み」を押すと設定用シートから取り込まれます。
    </v-alert>
    <v-alert v-if="!loading && eventConfigs.length > 0 && filteredEventConfigs.length === 0" type="warning"
        variant="tonal" class="mt-3">
        検索に一致するイベントが見つかりませんでした。
    </v-alert>

    <v-snackbar-queue v-model="snackbarMessages" :total-visible="5" closable></v-snackbar-queue>
</template>
<script setup lang="ts">
const loading = ref(false)
const syncing = ref(false)
const loadingEventName = ref('')

const currentTenant = useCurrentTenant()
const tenantId = currentTenant.value?.tenant_id || ''
const supabase = useSupabaseClient()

const slack2mailSheetConfig = ref({ sheet_id: '' })

const sheetConfigUrl = computed(() =>
    slack2mailSheetConfig.value.sheet_id ? `https://docs.google.com/spreadsheets/d/${slack2mailSheetConfig.value.sheet_id}` : ''
)

const getSlack2mailSheetConfig = async () => {
    const { data, error } = await supabase.from('slack2mail_sheet_config').select().eq('tenant_id', tenantId)
    if (error) {
        console.error('slack2mail sheet config error', error)
        addMessage('error', 'slack2mail sheet configの情報は取得できませんでした: ' + error.message)
    } else {
        if (data && data.length > 0) {
            slack2mailSheetConfig.value.sheet_id = data[0]?.sheet_id || ''
        }
    }
}


const eventConfigs = ref<EventConfig[]>([])

const searchQuery = ref('')

const filteredEventConfigs = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return eventConfigs.value
    return eventConfigs.value.filter(c =>
        (c.event_name || '').toLowerCase().includes(q) || (c.sheet_name || '').toLowerCase().includes(q))
})

const getEventConfigs = async () => {
    loading.value = true
    const { data, error } = await supabase.from('event_config').select().eq('tenant_id', tenantId).order('event_name')
    if (error) {
        console.error('error', error)
        addMessage('error', '読込みエラー: ' + error.message)
    } else {
        eventConfigs.value = data
    }

    loading.value = false
}

const syncEventConfig = async () => {
    syncing.value = true
    try {
        eventConfigs.value = await $fetch<EventConfig[]>('/api/sync-eventconfig', { method: 'POST', body: { tenantId: tenantId } })
        addMessage('success', `イベント設定を${eventConfigs.value.length}件読み込みました`)
    } catch (error) {
        const message = errorMessage(error)
        console.error('syncEventConfig', message)
        addMessage('error', `イベント設定読込みに失敗しました: ${message}`)
    }
    syncing.value = false
}

/** 1イベントのシート(参加者データ)のみを読み込む */
const loadSheet = async (eventName: string) => {
    loadingEventName.value = eventName
    try {
        const result = await $fetch<SyncEventDataResponse>('/api/sync-eventdata', {
            method: 'POST',
            body: { tenantId: tenantId, eventNames: [eventName] }
        })
        for (const r of result.results) {
            if (r.status === 'synced') {
                addMessage('success', `${r.event_name}: ${r.rows}件読み込みました${r.message ? ` (${r.message})` : ''}`)
            } else if (r.status === 'skipped') {
                addMessage('info', `${r.event_name}: スキップしました${r.message ? ` (${r.message})` : ''}`)
            } else {
                addMessage('error', `${r.event_name}: 読み込み失敗${r.message ? ` (${r.message})` : ''}`)
            }
        }
        for (const name of result.notFound) {
            addMessage('error', `${name}: イベント設定が見つかりませんでした`)
        }
        if (result.results.length === 0 && result.notFound.length === 0) {
            addMessage('info', '読み込むイベントがありませんでした')
        }
    } catch (error) {
        const message = errorMessage(error)
        console.error('loadSheet', eventName, message)
        addMessage('error', `${eventName}: シート読込みに失敗しました: ${message}`)
    }
    loadingEventName.value = ''
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
    getEventConfigs()
    getSlack2mailSheetConfig()
})
</script>
