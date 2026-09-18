<template>
    <h1>tenant</h1>
    {{ tenant }}
    <v-row>
        <v-col>
            <v-text-field v-model="name" label="名称" append-inner-icon="mdi-restore"
                @click:append-inner="name = currentTenant?.name ?? ''" variant="outlined" clearable />
        </v-col>
    </v-row>
    <v-row>
        <v-col>
            <v-text-field v-model="slug" label="slug" hint="テナントを表すIDのようなもの。URLの一部に使用されます。システム内で一意である必要があります。"
                :error-messages="slug_error_msg" append-inner-icon="mdi-restore"
                @click:append-inner="slug = current_slug" variant="outlined" clearable />
        </v-col>
    </v-row>
</template>

<script setup lang="ts">
import type { Database } from '~/types/database.types'

const getInitialTenant = (): Tenant => {
    return {
        tenant_id: '',
        name: '',
        slug: '',
        brand_name: null,
        brand_icon_url: null,
        created_at: '',
        updated_at: ''
    }
}

const supabase = useSupabaseClient<Database>()
const currentTenant = useCurrentTenant() ?? getInitialTenant()
const current_slug = currentTenant.value?.slug ?? ''
const slug_error_msg = ref('')
const tenant_id = ref('')
const name = ref('')
const slug = ref('')
const brand_name = ref('')
const brand_icon_url = ref('')

const { data: tenant } = await useAsyncData<Tenant | null>('tenants-table', async () => {
    const { data, error } = await supabase.from('tenants').select('*').eq('slug', current_slug)
    if (error) {
        console.error('error', error)
        return null
    }
    return data[0] ?? null
})


// v-model="tenant" とするとtenantが確定しない時期があるため警告やエラーとなる。
// そのためクッションとなる変数を置いている。

watch(() => tenant.value, (value) => {
    if (value) {
        tenant_id.value = value.tenant_id
        name.value = value.name
        slug.value = value.slug
        brand_name.value = value.brand_name ?? ''
        brand_icon_url.value = value.brand_icon_url ?? ''
    }
},
    { immediate: true }
)

watch(() => slug.value, async () => {
    const { data, error } = await supabase.rpc('check_slug_available', {
        p_slug: slug.value,
        p_tenant_id: currentTenant.value?.tenant_id,
    });
    if (error) {
        console.error('check_slug_available error', error)
    } else {
        const { available, reason } = data as unknown as { available: boolean; reason: string | null }
        if (!available) {
            const messages: Record<string, string> = {
                empty: 'URLを入力してください',
                invalid_format: '半角英数字とハイフンのみ使用できます(3〜63文字)',
                reserved: 'このURLは予約されているため使用できません',
                duplicate: 'このURLは既に使用されています',
            };
            slug_error_msg.value = (messages[reason ?? ''] ?? '使用できないURLです');
        } else {
            slug_error_msg.value = '';
        }
    }
})

</script>