<template>
    <v-table density="compact">
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
            </tr>
        </thead>
        <tbody>
            <tr v-for="record in props.records" :key="record.sheetId">
                <td>
                    <a :href="`https://docs.google.com/spreadsheets/d/${record.sheet_id}`" target="_blank"
                        rel="noopener noreferrer">
                        {{ record.event_name }}
                    </a>
                </td>
                <td style="white-space: pre-wrap;">{{ record.sheet_name }}</td>
                <td>{{ record.header }}</td>
                <td style="white-space: pre-wrap;">{{ record.id_column }}</td>
                <td style="white-space: pre-wrap;">{{ record.email_column }}</td>
                <td>{{ record.filter_columns.join(', ') }}</td>
                <td>{{ record.embeded_columns.join(', ') }}</td>
                <td>{{ record.include_flg_column_name }}</td>
                <td>{{ record.include_flg_column_values.join(', ') }}</td>
                <td>{{ record.sender_name }}</td>
                <td>{{ record.sender_email_addr }}</td>
            </tr>
        </tbody>
    </v-table>
</template>
<script setup lang="ts">

const props = defineProps(['records'])
const records = ref<EventConfig[]>()

watch(() => props.records, () => {
    records.value = props.records
})

onMounted(() => {
    records.value = props.records
})




</script>