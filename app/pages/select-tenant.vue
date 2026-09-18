<template>
    <div v-if="pending">読み込み中...</div>

    <div v-else-if="myTenants && myTenants.length > 0">
        <h3>所属先を選択してください</h3>
        <v-list>
            <v-list-item v-for="t in myTenants" :key="t.tenant_id" :to="`/${t.tenants?.slug}`">
                {{ t.tenants?.name }}
            </v-list-item>
        </v-list>
    </div>

    <div v-else>
        <p>所属しているテナントが見つかりませんでした。管理者にお問い合わせください。</p>
        <v-btn @click="logout">ログアウト</v-btn>
    </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const { data: myTenants, pending } = await useAsyncData('my-tenants', async () => {
    if (!user.value) return []
    const { data, error } = await supabase
        .from('tenant_users')
        .select('tenant_id, tenants(name, slug, brand_name, brand_icon_url)')
    if (error) {
        console.error('tenant_users', error.message)
    }
    return data
})

// 所属が1件だけなら自動的にそのテナントへ遷移する
watchEffect(() => {
    if (myTenants.value && myTenants.value.length === 1 && myTenants.value[0]) {
        const slug = myTenants.value[0].tenants?.slug
        if (slug) navigateTo(`/${slug}`)
    }
})

const logout = async () => {
    await supabase.auth.signOut()
    navigateTo('/login')
}
</script>