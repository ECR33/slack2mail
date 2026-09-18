<template>
    <v-table density="compact">
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
                <td v-html="obj2str(record.event_attr)"></td>
                <td v-html="obj2str(record.embeded_values)"></td>
                <!--<td>{{ formatDate(record.created_at) }}</td>-->
            </tr>
        </tbody>
    </v-table>
</template>
<script setup lang="ts">
import { DateTime } from 'luxon'

const props = defineProps(['records'])
const records = ref<EventData[]>([])

watch(() => props.records, () => {
    records.value = props.records
})

const obj2str = (data: any) => {
    return JSON.stringify(data)
    const ret = []
    for (const key of Object.keys(data)) {
        ret.push(`${key}: ${data[key]}`)
    }
    return ret.join('<br> ')
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
        // 2文字以下の場合は、先頭だけ残して残りを 'x' にする
        return `${localPart[0]}${'x'.repeat(localPart.length - 1)}@${domain}`;
    }
}

const formatDate = (datestr: string) => {
    return DateTime.fromISO(datestr).toFormat('yyyy/M/d')
}

onMounted(() => {
    records.value = props.records
})




</script>