import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'

export default defineNuxtPlugin(app => {
    const themeCookie = useCookie<'light' | 'dark' | 'system'>('user-theme', {
        default: () => 'light'
    })
    const initialTheme = themeCookie.value ?? 'light'
    const vuetify = createVuetify({
        //
        theme: {
            defaultTheme: initialTheme
        },
        ssr: true
    })
    app.vueApp.use(vuetify)
})