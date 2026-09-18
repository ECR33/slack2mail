// server/plugins/scheduler.ts
import { runTask } from 'nitropack/runtime'

export default defineNitroPlugin((nitroApp) => {
    const interval = parseInt(process.env.INTERVAL || '5') ?? 5 // 分単位
    const INTERVAL_MS = interval * 60 * 1000 // 分をミリセカンドへ

    console.info('scheduler: send-approved-mails: setInterval', INTERVAL_MS, 'ms')

    let isRunning = false
    setInterval(async () => {
        if (isRunning) {
            console.warn('前回のsend-approved-mailsがまだ実行中のためスキップします')
            return
        }
        isRunning = true
        try {
            await runTask('send-approved-mails')
        } catch (e) {
            console.error('[scheduler] send-emails task failed', e)
        } finally {
            isRunning = false
        }
    }, INTERVAL_MS)
})