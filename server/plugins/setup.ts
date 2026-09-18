export default defineNitroPlugin(nitroApp => {
    const config = useRuntimeConfig()
    console.info('slack2mail: Nuxtサーバが起動しました')
    if (process.env.NODE_ENV != 'production') {
        console.info('Runtime config', config)
        console.info('-0-')
    }
})