<template>
    <v-table density="compact">
        <thead>
            <tr>
                <th>id</th>
                <th>設定名</th>
                <th>説明</th>
                <th>SMTPサーバ</th>
                <th>ポート</th>
                <th>セキュア</th>
                <th>IMAPサーバ</th>
                <th>ポート</th>
                <th>セキュア</th>
                <th>有効</th>
                <th v-if="props.deleteMode"></th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="record in props.records" :key="record.id">
                <td>
                    <v-btn color="primary" variant="text" @click="onClick(record)">
                        {{ record.id }}
                    </v-btn>
                </td>
                <td style="white-space: nowrap;">{{ record.name }}</td>
                <td v-html="record.description?.replaceAll('\n', '<br>')"></td>
                <td>{{ record.smtp_server }}</td>
                <td>{{ record.smtp_port }}</td>
                <td>{{ record.smtp_secure }}</td>
                <td>{{ record.imap_server }}</td>
                <td>{{ record.imap_port }}</td>
                <td>{{ record.imap_secure }}</td>
                <td>
                    <v-switch v-model="record.available" hide-details :loading="availableLoading"
                        @update:modelValue="onChanged(record.id)" />
                </td>
                <td v-if="props.deleteMode">
                    <v-btn icon="mdi-delete" color="error" variant="text" @click="onDelete(record.id)" />
                </td>
            </tr>
        </tbody>
    </v-table>
</template>
<script setup lang="ts">
const emit = defineEmits(['changed', 'clicked', 'delete'])

const availableLoading = ref(false)
const props = defineProps(['records', 'deleteMode'])
const records = ref<MailServerConfig[]>()

watch(() => props.records, () => {
    records.value = props.records
    availableLoading.value = false
})

const onClick = (record: MailServerConfig) => {
    emit('clicked', record)
}

const onChanged = (id: number) => {
    availableLoading.value = true
    emit('changed', id)
}

const onDelete = (id: number) => {
    emit('delete', id)
}

onMounted(() => {
    records.value = props.records
})

</script>