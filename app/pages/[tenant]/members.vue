<template>
    <h1>メンバーリスト読込み</h1>
    <v-row>
        <v-col>
            <v-expansion-panels>
                <v-expansion-panel title="解説">
                    <template v-slot:text>
                        この画面ではメンバーリストをシステムに取り込みます。<br>
                        読込み対象のシートは「メンバーリストシート」のリンク先のドキュメントです。<br>
                        ※ シートの内容を確認したい場合はリンクをクリックしてください。<br>
                        <br>
                        「メンバーリスト読込み」ポタンを押下するとシートに記載された情報がシステムへ読み込まれます<br>
                        メンバーに変更があった場合はメンバーリストシートを修正し、再度読み込んでください。<br>
                        <br>
                        「メンバーリストシート」を他のシートに変更したい場合はギアアイコンから設定を変更してください。
                    </template>
                </v-expansion-panel>
            </v-expansion-panels>
        </v-col>
    </v-row>
    <v-row>
        <v-col>
            <a :href="memberListSheetUrl" target="_blank" rel="noopener noreferrer">メンバーリストシート</a>
        </v-col>
    </v-row>
    <v-row>
        <v-col>
            <v-btn color="primary" @click="syncTenantMembers" :loading="syncing">メンバーリスト読込み</v-btn>
        </v-col>
    </v-row>
    <v-row>
        <v-col cols="12">
            <h3 class="mb-0">現在の設定値</h3>
        </v-col>
        <v-col cols="12">
            <v-text-field v-model="keyword" label="検索" placeholder="キーワード : nameとemailから検索" variant="outlined"
                hide-details clearable />
        </v-col>
    </v-row>
    <v-progress-linear indeterminate v-if="loading"></v-progress-linear>
    <v-table>
        <thead>
            <tr>
                <th>name</th>
                <th>email</th>
                <th>id</th>
                <th>user_id</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="member in _tenantUsers" :key="member.email_addr">
                <td nowrap>{{ member.name }}</td>
                <td>{{ member.email_addr }}</td>
                <td>{{ member.id }}</td>
                <td>{{ member.user_id }}</td>
            </tr>
        </tbody>
    </v-table>
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
const memberListSheetUrl = computed(() => {
    return `https://docs.google.com/spreadsheets/d/${memberListSheetId.value}`
})

const tenantUsers = ref<TenantUsers[]>([])

const _tenantUsers = computed(() => {
    if (keyword.value) {
        return tenantUsers.value.filter(f => {
            return (f.name?.includes(keyword.value) || (f.email_addr.includes(keyword.value)))
        })
    } else {
        return tenantUsers.value
    }
})

const getTenantUsers = async () => {
    loading.value = true
    const data = await $fetch('/api/get-tenant-members', { method: 'POST', body: { tenantId: tenantId } })
    if (data) {
        tenantUsers.value = data
    }
    loading.value = false
}

const syncTenantMembers = async () => {
    syncing.value = true
    const data = await $fetch('/api/sync-tenant-members', { method: 'POST', body: { tenantId: tenantId } })
    syncing.value = false
    getTenantUsers()
}

onMounted(async () => {
    getTenantUsers()
    memberListSheetId.value = await getMemberListSheetId(tenantId, supabase)
})
</script>