<template>
    <h1>イベントシート読込み</h1>
    <v-row>
        <v-col>
            <v-expansion-panels>
                <v-expansion-panel title="解説">
                    <template v-slot:text>
                        この画面ではイベントシートをシステムに取り込みます。<br>
                        イベントシートとは、イベント向けの宛先が記載されたシートです。<br>
                        企画したイベントの参加者をGoogleフォームで収集した際に作成されるスプレッドシートを想定しています<br>
                        読込み対象のシートは「イベント設定」にて指定したシートです。<br>
                        「イベントシート読込み」ポタンを押下するとシートに記載された情報がシステムへ読み込まれます<br>
                        読み込むイベントは「イベント名」で選択します。選択したイベントのみを読み込むため、<br>
                        他の人が作業中のシートや他のイベントのデータを巻き込むことはありません。<br>
                        「イベント名」が未選択のときは全イベントを読み込みます(確認ダイアログが表示されます)。<br>
                        <br>
                        メールアドレスは個人情報保護に配慮して一部分をマスク化して表示しています。これは表示のみでシステム上は正しいメールアドレスが登録されています。<br>
                        <br>
                        <b>テスト用機能</b><br>
                        「イベントシート読込」で読み込んだメールアドレスを意味のない文字列にできます(ダミー化)。無効化すると送信操作を行っても宛先不明となります。<br>
                        無効化は「イベント名」を選択したときはそのイベントのみ、未選択のときはこのテナントの全イベントが対象です。<br>
                        無効化は一連の送信操作を試してみたいときに使用します。無効化されたメールアドレスをもとに戻すには再度「イベントシート読込」を行ってください。
                    </template>
                </v-expansion-panel>
            </v-expansion-panels>
        </v-col>
    </v-row>
    <v-row>
        <v-col cols="12" md="4">
            <v-autocomplete clearable chips label="イベント名(読込み対象・表示フィルタ)" :items="eventNames" multiple
                closable-chips variant="outlined" v-model="selectedEvetNames" />
        </v-col>
        <v-col cols="12" md="auto" class="d-flex align-center">{{ syncTargetText }}</v-col>
    </v-row>
    <v-row class="align-center">
        <v-col cols="12" sm="auto">
            <v-btn color="primary" class="action-btn" @click="syncEventData" :loading="loading">イベントシート読込み</v-btn>
        </v-col>
        <v-col cols="12" class="text-caption">選択したイベントのシートのみを読み込みます(未選択時は全イベント)</v-col>
    </v-row>
    <v-row class="align-center">
        <v-col cols="12" sm="auto">
            <v-btn color="warning" variant="outlined" class="action-btn" @click="mailRandomize"
                :loading="disabling">メールアドレス無効化</v-btn>
        </v-col>
        <v-col cols="12" class="text-caption">操作テスト用の機能です。無効化すると送信操作でも宛先不明になります(戻すには再度シート読込み)</v-col>
    </v-row>
    <v-row>
        <v-col>
            <h3>絞り込み条件</h3>
        </v-col>
    </v-row>
    <v-row v-if="eventFilters.length === 0">
        <v-col class="text-caption">「イベント名」を選択すると、そのイベントの絞り込み条件が表示されます。</v-col>
    </v-row>
    <v-row>
        <v-col cols="12" md="4" v-for="eventFilter in eventFilters" :key="eventFilter.column_name">
            <v-autocomplete clearable chips :label="eventFilter.column_name" :items="eventFilter.column_values" multiple
                closable-chips hide-details variant="outlined" v-model="selectedEventFilters[eventFilter.column_name]"
                @update:modelValue="changeFilter" />
        </v-col>
    </v-row>
    <v-row class="align-center">
        <v-col cols="12" md="10">
            <!-- モバイルは番号並列のページャだとタップが小さく分かりにくいため前/次ボタンのみ -->
            <div v-if="isMobile" class="d-flex align-center ga-2">
                <v-btn :icon="'mdi-chevron-left'" :disabled="page <= 1" :aria-label="'前のページ'" @click="page = page - 1" />
                <span>{{ page }} / {{ pages }} ページ</span>
                <v-btn :icon="'mdi-chevron-right'" :disabled="page >= pages" :aria-label="'次のページ'"
                    @click="page = page + 1" />
            </div>
            <v-pagination v-else :length="pages" v-model="page" :total-visible="5" />
        </v-col>
        <v-col cols="12" md="auto" class="d-flex justify-end">{{ eventDataCount }}件</v-col>
    </v-row>
    <v-progress-linear indeterminate v-if="eventLoading"></v-progress-linear>
    <EventData :records="eventDatas" />
    <v-snackbar-queue ref="snackbarQueue" v-model="snackbarMessages" :total-visible="5" closable></v-snackbar-queue>
</template>
<script setup lang="ts">
import { getEventDatas, getEventDataCount, getEventNames, getReceipientGroupMenuData } from '#shared/utils/supabase'
import { useDisplay } from 'vuetify'

const loading = ref(false)
const eventLoading = ref(false)
const disabling = ref(false)

const display = useDisplay()
// SSRでは描画幅が不定のため、mounted後に判定してhydration不一致を避ける
const mounted = ref(false)
const isMobile = computed(() => mounted.value && (display.xs.value || display.sm.value))

const currentTenant = useCurrentTenant()
const tenantId = currentTenant.value?.tenant_id || ''

const supabase = useSupabaseClient()

const eventDatas = ref<EventData[]>([])
const eventDataCount = ref(0)
const page = ref(1)
const limit = ref(10)
const offset = computed(() => {
    return (page.value - 1) * limit.value
})
const pages = computed(() => {
    return Math.ceil(eventDataCount.value / limit.value)
})
const eventNames = ref<string[]>([])
const selectedEvetNames = ref<string[]>([])

const syncTargetText = computed(() => {
    return selectedEvetNames.value.length > 0
        ? `読込み対象: ${selectedEvetNames.value.length}件を選択中`
        : '読込み対象: 未選択のため全イベント'
})
const eventFilters = ref<EventFilter[]>([])
const selectedEventFilters = ref<any>({})

watch(() => selectedEvetNames.value, async () => {
    eventLoading.value = true
    page.value = 1
    eventFilters.value = []
    for (const eventName of selectedEvetNames.value) {
        const data = await getReceipientGroupMenuData(tenantId, eventName, supabase)
        eventFilters.value.push(...data)
    }
    const _selectedFilter = <any>{}
    for (const eventFilter of eventFilters.value) {
        if (selectedEventFilters.value[eventFilter.column_name]) {
            _selectedFilter[eventFilter.column_name] = selectedEventFilters.value[eventFilter.column_name]
        }
    }
    selectedEventFilters.value = _selectedFilter
    await _getEventDatas()
    eventLoading.value = false
})

watch(() => page.value, async () => {
    await _getEventDatas()
})

const changeFilter = () => {
    page.value = 1
    _getEventDatas()
}

const _getEventDatas = async () => {
    eventLoading.value = true
    const keys = Object.keys(selectedEventFilters.value)
    const _selectedFilter = <any>{}
    for (const key of keys) {
        // キーがあっても値がない(空配列)ものをsupabaseに送らない
        if (selectedEventFilters.value[key].length > 0) {
            _selectedFilter[key] = selectedEventFilters.value[key]
        }
    }
    eventDatas.value = await getEventDatas(tenantId, selectedEvetNames.value, _selectedFilter, offset.value, limit.value, supabase)
    eventDataCount.value = await getEventDataCount(selectedEvetNames.value, _selectedFilter, supabase)
    eventLoading.value = false
}

const syncEventData = async () => {
    const targets = selectedEvetNames.value
    if (targets.length === 0) {
        // 未選択時は全イベントを読み込む(従来動作)。誤押下で他人のシートを巻き込まないため確認する
        if (!confirm('イベント名が選択されていません。\nすべてのイベントシートを読み込みます。よろしいですか？')) {
            addMessage('info', 'キャンセルしました')
            return
        }
    }
    loading.value = true
    try {
        const result = await $fetch<SyncEventDataResponse>('/api/sync-eventdata', {
            method: 'POST',
            body: { tenantId: tenantId, eventNames: targets }
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
        console.error('syncEventData', message)
        addMessage('error', `イベントシート読込みに失敗しました: ${message}`)
    }
    loading.value = false
    eventNames.value = await getEventNames(tenantId, supabase)
    await _getEventDatas()
    page.value = 1
}

const mailRandomize = async () => {
    const targets = selectedEvetNames.value
    const scopeText = targets.length > 0 ? `選択した${targets.length}件のイベント` : 'このテナントの全イベント'
    const result = confirm(`メールアドレスを無効化します。\n${scopeText}の読み込み済みのメールアドレスがすべて無効な値に置き換わります。よろしいですか？`)
    if (!result) {
        addMessage('info', 'キャンセルしました')
        return
    }
    disabling.value = true
    const { data, error } = await supabase.rpc('randomize_emails', { p_tenant_id: tenantId, p_event_names: targets })
    disabling.value = false
    if (error) {
        console.error('mailRondomize: error', error)
        addMessage('error', 'メールアドレス無効化に失敗しました: ' + error.message)
    } else {
        const rows = data ?? []
        const total = rows.reduce((sum, r) => sum + (r.changed ?? 0), 0)
        addMessage('success', `メールアドレスを無効化しました(${total}件)`)
        for (const r of rows) {
            addMessage('info', `${r.event_name}: ${r.changed}件`)
        }
        await _getEventDatas()
    }
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
    mounted.value = true
    eventNames.value = await getEventNames(tenantId, supabase)
    _getEventDatas()
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