<template>
    <!-- モバイル: レコード単位のカード表示(6列テーブルは幅切れしてメール/属性が読めないため) -->
    <div v-if="isMobile" class="d-flex flex-column ga-3">
        <v-card v-for="record in props.records" :key="record.id" :rounded="8">
            <v-card-item>
                <v-card-title class="text-h6">{{ record.data_id }}</v-card-title>
                <v-card-subtitle>{{ record.event_name }}</v-card-subtitle>
            </v-card-item>
            <v-card-text>
                <div class="cfg-row">
                    <span class="cfg-label">メールアドレス</span>
                    <span class="cfg-value break">{{ emailMask(record.email_addr) }}</span>
                </div>
                <div class="cfg-row">
                    <span class="cfg-label">宛先グループ</span>
                    <span class="cfg-value">
                        <span v-if="pairs(record.event_attr).length === 0">指定なし</span>
                        <v-chip v-for="pair in pairs(record.event_attr)" :key="`attr-${pair.key}`" size="x-small"
                            variant="tonal">{{ pair.key }}: {{ pair.value }}</v-chip>
                    </span>
                </div>
                <div class="cfg-row">
                    <span class="cfg-label">埋込み項目</span>
                    <span class="cfg-value">
                        <span v-if="pairs(record.embeded_values).length === 0">指定なし</span>
                        <v-chip v-for="pair in pairs(record.embeded_values)" :key="`emb-${pair.key}`" size="x-small"
                            variant="tonal">{{ pair.key }}: {{ pair.value }}</v-chip>
                    </span>
                </div>
                <div class="cfg-row">
                    <span class="cfg-label">レコードID</span>
                    <span class="cfg-value">{{ record.id }}</span>
                </div>
            </v-card-text>
        </v-card>
    </div>

    <!-- デスクトップ: 従来の一覧テーブル -->
    <v-table v-else density="compact">
        <thead>
            <tr>
                <th>ID</th>
                <th>イベント名</th>
                <th>データID</th>
                <th>メールアドレス</th>
                <th>宛先グループ</th>
                <th>埋込み項目</th>
                <!--<th>作成日時</th>-->
            </tr>
        </thead>
        <tbody>
            <tr v-for="record in props.records" :key="record.id">
                <td>{{ record.id }}</td>
                <td style="white-space: pre-wrap;">{{ record.event_name }}</td>
                <td>{{ record.data_id }}</td>
                <td style="white-space: pre-wrap;">{{ emailMask(record.email_addr) }}</td>
                <td>
                    <v-chip v-for="pair in pairs(record.event_attr)" :key="`attr-${pair.key}`" size="x-small"
                        variant="tonal" class="mr-1">{{ pair.key }}: {{ pair.value }}</v-chip>
                </td>
                <td>
                    <v-chip v-for="pair in pairs(record.embeded_values)" :key="`emb-${pair.key}`" size="x-small"
                        variant="tonal" class="mr-1">{{ pair.key }}: {{ pair.value }}</v-chip>
                </td>
                <!--<td>{{ formatDate(record.created_at) }}</td>-->
            </tr>
        </tbody>
    </v-table>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { DateTime } from 'luxon'

const props = defineProps<{
    records: EventData[]
}>()

const display = useDisplay()
// SSRでは描画幅が不定のため、mounted後に判定してhydration不一致を避ける
const mounted = ref(false)
onMounted(() => {
    mounted.value = true
})
const isMobile = computed(() => mounted.value && (display.xs.value || display.sm.value))

/** オブジェクトを key/value のペア一覧へ変換する(v-htmlを使わないためシート内の文字列がHTMLとして解釈されない) */
const pairs = (data: unknown): { key: string, value: string }[] => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return []
    return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({
        key,
        value: value === null || value === undefined ? '' : '' + value
    }))
}

const emailMask = (email: string) => {
    if (!email) return email
    const [localPart, domain] = email?.split('@');
    if (!domain) return email // メールアドレスの形式でない場合はそのまま返す
    if (!localPart) return email

    if (localPart.length >= 3) {
        const first = localPart[0];
        const last = localPart[localPart.length - 1];
        const maskedMiddle = '.'.repeat(localPart.length - 2);
        return `${first}${maskedMiddle}${last}@${domain}`;
    } else {
        // 2文字以下の場合は先頭だけ残して残りを 'x' にする
        return `${localPart[0]}${'x'.repeat(localPart.length - 1)}@${domain}`;
    }
}

const formatDate = (datestr: string) => {
    return DateTime.fromISO(datestr).toFormat('yyyy/M/d')
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

.break {
    overflow-wrap: anywhere;
}
</style>
