<template>
    <v-card max-width="500" class="mx-auto">
        <v-img :src="imgUrl" class="align-end" gradient="to bottom, rgba(0,0,0,0), rgba(0,0,0,.1), rgba(0,0,0,.5)" height="200px"
            cover>
            <v-card-title class="text-white">アプリ共有</v-card-title>
        </v-img>
        <v-card-subtitle>{{ version }}</v-card-subtitle>
        <v-card-text>
            <div class="qr_box">
                <img :src="brand_icon" class="inner_img" />
                <Qrcode :value="url" width="300" />
            </div>
        </v-card-text>
    </v-card>
</template>
<script setup lang="ts">
import { useTheme } from 'vuetify'
const url = ref("")
const theme = useTheme()
const themeCookie = useCookie('user-theme')
watch(() => themeCookie.value, () => {
    setImgUrl()
})

const setImgUrl = () => {
    if (themeCookie.value == 'dark') {
        imgUrl.value = '/ukai.jpg'
    } else {
        imgUrl.value = '/bulb.jpg'
    }
}

const currentTenant = useCurrentTenant()
const brand_icon = ref('')
brand_icon.value = currentTenant.value?.brand_icon_url || '/slack2mail_icon.png'

const version = ref('')
const config = useRuntimeConfig()

const imgUrl = ref('')

onMounted(async () => {
    url.value = location.href; // TODO: リンクをトップに変更する
    version.value = config.public.version
    // const nasa = 'https://api.nasa.gov/planetary/apod?date=2013-02-03&api_key=Cx47MpcBontZf6IWtPJJxdQM9XHtK1y7nPkrnGSE'
    // const data: any = await $fetch(nasa)
    // imgUrl.value = data?.url
    setImgUrl()
})
</script>
<style scoped>
.qr_box {
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
}

.qr_box img {
    position: absolute;
    max-width: 100%;
    max-height: 100%;
}

.inner_img {
    padding: 5px;
    width: 50px;
    background-color: white;
    border-radius: 5px;
}
</style>