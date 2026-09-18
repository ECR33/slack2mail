<template>
    <v-table density="compact">
        <thead>
            <tr>
                <th>id</th>
                <th>送信名</th>
                <th>メールアドレス</th>
                <th>パスワード</th>
                <th>説明</th>
                <th>既定のアカウント</th>
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
                <td>{{ record.email_addr }}</td>
                <td>********</td>
                <td v-html="record.description?.replaceAll('\n', '<br>')"></td>
                <td>
                    <v-switch v-model="record.default" hide-details :loading="defaultLoading"
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

interface Props {
    records: MailAccount[]
    deleteMode: boolean
}

const emit = defineEmits(['changed', 'clicked', 'delete'])

const defaultLoading = ref(false)
const props = defineProps(['records', 'deleteMode']) as Props
const records = ref<MailAccount[]>()

watch(() => props.records, () => {
    records.value = props.records
    defaultLoading.value = false
})

const onClick = (record: MailAccount) => {
    emit('clicked', record)
}

const onChanged = (id: string) => {
    defaultLoading.value = true
    emit('changed', id)
}

const onDelete = (id: string) => {
    emit('delete', id)
}

onMounted(() => {
    records.value = props.records
})




</script>