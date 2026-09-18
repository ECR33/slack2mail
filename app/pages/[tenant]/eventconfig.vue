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
                        ※ シートの内容を確認したい場合はリンクをクリックしてください。<br>
                        <br>
                        「イベント設定読込み」ポタンを押下するとシートに記載された情報がシステムへ読み込まれます<br>
                        <br>
                        「設定用シート」を他のシートに変更したい場合はギアアイコンから設定を変更してください。
                    </template>
                </v-expansion-panel>
            </v-expansion-panels>
        </v-col>
    </v-row>
    <v-row>
        <v-col>
            <a :href="`https://docs.google.com/spreadsheets/d/${slack2mailSheetConfig.sheet_id}`" target="_blank"
                rel="noopener noreferrer">設定用シート</a>
        </v-col>
    </v-row>
    <v-row>
        <v-col>
            <v-btn color="primary" @click="syncEventConfig" :loading="syncing">イベント設定読込み</v-btn>
        </v-col>
    </v-row>
    <v-row>
        <v-col>
            <h3>現在の設定値</h3>
        </v-col>
    </v-row>
    <v-progress-linear indeterminate v-if="loading" />
    <EventConfig :records="eventConfigs" />
</template>
<script setup lang="ts">
const loading = ref(false)
const syncing = ref(false)

const currentTenant = useCurrentTenant()
const tenantId = currentTenant.value?.tenant_id || ''
const supabase = useSupabaseClient()

const slack2mailSheetConfig = ref({ sheet_id: '' })

const getSlack2mailSheetConfig = async () => {
    const { data, error } = await supabase.from('slack2mail_sheet_config').select().eq('tenant_id', tenantId)
    if (error) {
        alert('slack2mail sheet configの情報は取得できませんでした\n' + error.message)
    } else {
        if (data && data.length > 0) {
            slack2mailSheetConfig.value.sheet_id = data[0]?.sheet_id || ''
        }
    }
}


const eventConfigs = ref<EventConfig[]>([])

const getEventConfigs = async () => {
    loading.value = true
    const { data, error } = await supabase.from('event_config').select().eq('tenant_id', tenantId).order('event_name')
    if (error) {
        console.error('error', error)
        alert('読込みエラー\n' + error.message)
    } else {
        eventConfigs.value = data
    }

    loading.value = false
}

const syncEventConfig = async () => {
    syncing.value = true
    try {
        eventConfigs.value = await $fetch<EventConfig[]>('/api/sync-eventconfig', { method: 'POST', body: { tenantId: tenantId } })
    } catch (error) {
        let message = ''
        if (error instanceof Error) {
            message = error.message
        } else if (typeof error === 'string') {
            message = error
        }
        console.error('syncEventConfig', message)
    }
    syncing.value = false
}

onMounted(async () => {
    getEventConfigs()
    getSlack2mailSheetConfig()
})
</script>