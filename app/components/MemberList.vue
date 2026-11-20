<template>
    <!-- モバイル: メンバー単位のカード表示(4列テーブルは幅切れしてuuidが読めないため) -->
    <div v-if="isMobile" class="d-flex flex-column ga-3">
        <v-card v-for="record in props.records" :key="keyOf(record)" :rounded="8">
            <v-card-item>
                <template v-slot:prepend>
                    <v-icon :icon="record.user_id ? 'mdi-account-check' : 'mdi-account-circle-outline'" />
                </template>
                <v-card-title class="text-h6 clamp2">{{ record.name || '(名前未設定)' }}</v-card-title>
                <v-card-subtitle class="break">{{ record.email_addr }}</v-card-subtitle>
            </v-card-item>

            <v-card-text>
                <div class="member-row">
                    <span class="member-label">ログイン状態</span>
                    <span class="member-value">{{ record.user_id ? '連携済み' : '未ログイン' }}</span>
                </div>
                <div class="member-row">
                    <span class="member-label">メンバーID</span>
                    <span class="member-value break">{{ record.id || '未設定' }}</span>
                </div>
                <div class="member-row">
                    <span class="member-label">連携ID(user_id)</span>
                    <span class="member-value break">{{ record.user_id || '未ログインのため未設定' }}</span>
                </div>
            </v-card-text>
        </v-card>
    </div>

    <!-- デスクトップ: 従来の一覧テーブル -->
    <v-table v-else density="compact">
        <thead>
            <tr>
                <th>名前</th>
                <th>メールアドレス</th>
                <th>メンバーID</th>
                <th>連携ID(user_id)</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="record in props.records" :key="keyOf(record)">
                <td>{{ record.name }}</td>
                <td>{{ record.email_addr }}</td>
                <td>{{ record.id }}</td>
                <td>{{ record.user_id }}</td>
            </tr>
        </tbody>
    </v-table>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'

const props = defineProps<{
    records: TenantUsers[]
}>()

const display = useDisplay()
// SSRでは描画幅が不定のため、mounted後に判定してhydration不一致を避ける
const mounted = ref(false)
onMounted(() => {
    mounted.value = true
})
const isMobile = computed(() => mounted.value && (display.xs.value || display.sm.value))

/** 事前登録メンバーはidが未取得の可能性があるためemail_addrもフォールバックにする */
const keyOf = (record: TenantUsers) => record.id || record.email_addr
</script>
<style scoped>
.member-row {
    display: grid;
    grid-template-columns: 7rem 1fr;
    gap: 0.5rem;
    align-items: baseline;
    padding: 2px 0;
}

.member-label {
    font-size: 0.75rem;
    opacity: 0.7;
}

.member-value {
    font-size: 0.875rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: baseline;
}

.clamp2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
}

.break {
    overflow-wrap: anywhere;
}
</style>
