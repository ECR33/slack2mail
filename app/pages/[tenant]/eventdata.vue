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
                        <br>
                        メールアドレスは個人情報保護に配慮して一部分をマスク化して表示しています。これは表示のみでシステム上は正しいメールアドレスが登録されています。<br>
                        <br>
                        <b>テスト用機能</b><br>
                        「イベントシート読込」で読み込んだメールアドレスをすべて意味のない文字列にすることができます。無効化すると送信操作を行っても宛先不明となります。<br>
                        無効化は一連の送信操作を試してみたいときに使用します。無効化されたメールアドレスをもとに戻すには再度「イベントシート読込」を行ってください。
                    </template>
                </v-expansion-panel>
            </v-expansion-panels>
        </v-col>
    </v-row>
    <v-row>
        <v-col>
            <v-btn color="primary" @click="syncEventData" :loading="loading">イベントシート読込み</v-btn>
        </v-col>
    </v-row>
    <v-row class="align-center">
        <v-col cols="auto">
            <v-btn @click="mailRandomize" color="secondary">メールアドレス無効化</v-btn>
        </v-col>
        <v-col cols="12" md="auto">イベント参加者のメールアドレスを無効な値に置き換えます(操作テスト用の機能です)</v-col>
    </v-row>
    <v-row>
        <v-col>
            <h3>現在の設定値</h3>
        </v-col>
    </v-row>
    <v-row>
        <v-col cols="12" md="4">
            <v-autocomplete clearable chips label="イベント名" :items="eventNames" multiple closable-chips variant="outlined"
                v-model="selectedEvetNames" />
        </v-col>
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
            <v-pagination :length="pages" v-model="page" :total-visible="4" />
        </v-col>
        <v-col cols="12" md="auto" class="d-flex justify-end">{{ eventDataCount }}件</v-col>
    </v-row>
    <v-progress-linear indeterminate v-if="eventLoading"></v-progress-linear>
    <EventData :records="eventDatas" />
    <v-snackbar-queue ref="snackbarQueue" v-model="snackbarMessages" :total-visible="5" closable></v-snackbar-queue>
</template>
<script setup lang="ts">
import { getEventDatas, getEventDataCount, getEventNames, getReceipientGroupMenuData } from '#shared/utils/supabase'

const loading = ref(false)
const eventLoading = ref(false)

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
    loading.value = true
    eventDatas.value = await $fetch('/api/sync-eventdata', { method: 'POST', body: { tenantId: tenantId } })
    eventNames.value = await getEventNames(tenantId, supabase)
    _getEventDatas()
    page.value = 1
    loading.value = false
}

const mailRandomize = async () => {
    const result = confirm('メールアドレスを無効化します。よろしいですか？')
    if (!result) {
        addMessage('info', 'キャンセルしました')
        return
    }
    const { error } = await supabase.rpc('randomize_emails')
    if (error) {
        console.error('mailRondomize: error', error)
        addMessage('error', 'メールアドレス無効化に失敗しました')
    } else {
        addMessage('success', 'メールアドスレを無効化しました')
        _getEventDatas()
    }
}

const snackbarMessages = ref<{ text: string, color: string }[]>([])
const addMessage = (color: string, text: string) => {
    snackbarMessages.value.push({
        text,
        color
    })
}

onMounted(async () => {
    eventNames.value = await getEventNames(tenantId, supabase)
    _getEventDatas()
})
</script>