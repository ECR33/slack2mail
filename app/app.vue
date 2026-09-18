<template>
  <v-app>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </v-app>
</template>
<script setup lang="ts">
import { ids } from 'googleapis/build/src/apis/ids'
import { useTheme } from 'vuetify'
const theme = useTheme()
const currentTenant = useCurrentTenant()
const icon = currentTenant.value?.brand_icon_url ?? '/slack2mail_icon.png'

useHead({
  link: [
    {
      rel: 'icon',
      href: icon,
      type: 'image/x-icon'
    }
  ]
})

const printInfo = () => {
  const config = useRuntimeConfig()
  console.info('slack2mail: Client side started.')
  console.info('Runtime Config', config)
  console.info('--')
}

onMounted(() => {
  printInfo()
  const themeCookie = useCookie('user-theme')
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  if (isDarkMode) {
    // theme.change('light')
    theme.change('dark')
    themeCookie.value = 'dark'
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const modeName = e.matches ? 'dark' : 'light'
    theme.change(modeName)
    themeCookie.value = modeName
  })
})
</script>
