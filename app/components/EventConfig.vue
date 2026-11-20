<template>
    <!-- モバイル: イベント単位のカード表示(11列テーブルは幅切れして読めないため) -->
    <div v-if="isMobile" class="d-flex flex-column ga-3">
        <v-card v-for="record in props.records" :key="record.event_name" :rounded="8">
            <v-card-item>
                <template v-slot:prepend>
                    <v-icon :icon="record.sheet_id ? 'mdi-table-outline' : 'mdi-table-off'" />
                </template>
                <v-card-title class="text-h6 clamp2">{{ record.event_name }}</v-card-title>
                <v-card-subtitle>{{ record.sheet_name || 'シート未設定' }}</v-card-subtitle>
                <template v-slot:append>
                    <v-btn v-if="record.sheet_id" :icon="'mdi-open-in-new'" :href="sheetUrl(record)"
                        target="_blank" rel="noopener noreferrer" aria-label="シートを開く" size="small" />
                </template>
            </v-card-item>

            <v-card-text>
                <div class="cfg-row">
                    <span class="cfg-label">ヘッダー行番号</span>
                    <span class="cfg-value">{{ record.header ?? '未設定' }}</span>
                </div>
                <div class="cfg-row">
                    <span class="cfg-label">ID列名</span>
                    <span class="cfg-value clamp2" :title="record.id_column ?? ''">{{ record.id_column || '未設定' }}</span>
                </div>
                <div class="cfg-row">
                    <span class="cfg-label">メールアドレス列名</span>
                    <span class="cfg-value clamp2" :title="record.email_column ?? ''">{{ record.email_column || '未設定' }}</span>
                </div>
                <div class="cfg-row">
                    <span class="cfg-label">宛先グループ列名</span>
                    <span class="cfg-value">
                        <span v-if="list(record.filter_columns).length === 0">未設定</span>
                        <v-chip v-for="c in list(record.filter_columns)" :key="c" size="x-small" variant="tonal"
                            class="mr-1">{{ c }}</v-chip>
                    </span>
                </div>
                <div class="cfg-row">
                    <span class="cfg-label">埋込み項目列名</span>
                    <span class="cfg-value">
                        <span v-if="list(record.embeded_columns).length === 0">未設定</span>
                        <v-chip v-for="c in list(record.embeded_columns)" :key="c" size="x-small" variant="tonal"
                            class="mr-1">{{ c }}</v-chip>
                    </span>
                </div>
                <div class="cfg-row">
                    <span class="cfg-label">読込判定</span>
                    <span class="cfg-value">
                        <span v-if="!record.include_flg_column_name">判定なし(全行読込み)</span>
                        <template v-else>
                            <span class="clamp2">{{ record.include_flg_column_name }}</span>
                            <v-chip v-for="c in list(record.include_flg_column_values)" :key="c" size="x-small"
                                variant="tonal" class="ml-1">{{ c }}</v-chip>
                        </template>
                    </span>
                </div>
                <div class="cfg-row">
                    <span class="cfg-label">送信者名</span>
                    <span class="cfg-value clamp2" :title="record.sender_name ?? ''">{{ record.sender_name || '未設定' }}</span>
                </div>
                <div class="cfg-row">
                    <span class="cfg-label">送信者アドレス</span>
                    <span class="cfg-value break" :title="record.sender_email_addr ?? ''">{{ record.sender_email_addr || '未設定' }}</span>
                </div>
            </v-card-text>

            <v-card-actions>
                <v-btn color="primary" variant="tonal" :disabled="!record.sheet_id"
                    :loading="props.loadingEventName === record.event_name" @click="emit('load', record.event_name)">
                    このイベントのシート読込み
                </v-btn>
            </v-card-actions>
        </v-card>
    </div>

    <!-- デスクトップ: 従来の一覧テーブル -->
    <v-table v-else density="compact">
        <thead>
            <tr>
                <th>イベント名</th>
                <th>シート名</th>
                <th>ヘッダー行番号</th>
                <th>ID列名</th>
                <th>メールアドレス列名</th>
                <th>宛先グループ列名</th>
                <th>埋込み項目列名</th>
                <th>読込判定列名</th>
                <th>読込判定値</th>
                <th>送信者名</th>
                <th>送信者アドレス</th>
                <th>読込み</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="record in props.records" :key="record.event_name">
                <td>
                    <a :href="sheetUrl(record)" target="_blank" rel="noopener noreferrer">
                        {{ record.event_name }}
                    </a>
                </td>
                <td style="white-space: pre-wrap;">{{ record.sheet_name }}</td>
                <td>{{ record.header }}</td>
                <td style="white-space: pre-wrap;">{{ record.id_column }}</td>
                <td style="white-space: pre-wrap;">{{ record.email_column }}</td>
                <td>{{ list(record.filter_columns).join(', ') }}</td>
                <td>{{ list(record.embeded_columns).join(', ') }}</td>
                <td>{{ record.include_flg_column_name }}</td>
                <td>{{ list(record.include_flg_column_values).join(', ') }}</td>
                <td>{{ record.sender_name }}</td>
                <td>{{ record.sender_email_addr }}</td>
                <td>
                    <v-btn :icon="'mdi-download'" :disabled="!record.sheet_id"
                        :loading="props.loadingEventName === record.event_name"
                        :aria-label="`${record.event_name}のシート読込み`"
                        :title="record.sheet_id ? 'このイベントのシート読込み' : 'シートIDが未設定です'" size="small"
                        @click="emit('load', record.event_name)" />
                </td>
            </tr>
        </tbody>
    </v-table>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'

const props = defineProps<{
    records: EventConfig[]
    /** シート読込み中のイベント名(ボタンローディング用) */
    loadingEventName?: string
}>()

const emit = defineEmits<{
    load: [eventName: string]
}>()

const display = useDisplay()
// SSRでは描画幅が不定のため、mounted後に判定してhydration不一致を避ける
const mounted = ref(false)
onMounted(() => {
    mounted.value = true
})
const isMobile = computed(() => mounted.value && (display.xs.value || display.sm.value))

const sheetUrl = (record: EventConfig) =>
    record.sheet_id ? `https://docs.google.com/spreadsheets/d/${record.sheet_id}` : ''

/** Jsonカラム(string[]想定)を安全にstring[]へ変換する */
const list = (value: unknown): string[] => {
    return Array.isArray(value) ? value.map(v => '' + v) : []
}
</script>
<style scoped>
.cfg-row {
    display: grid;
    grid-template-columns: 6.5rem 1fr;
    gap: 0.5rem;
    align-items: baseline;
    padding: 2px 0;
}

.cfg-label {
    font-size: 0.75rem;
    opacity: 0.7;
}

.cfg-value {
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
