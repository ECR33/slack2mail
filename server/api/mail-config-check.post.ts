/**
 * POST /api/mail-config-check
 * 
 * メールサーバの設定が正しいか確認する
 * 
 */
import { validateImapConfig, validateSmtpConfig } from '#shared/utils/mailutilsr'
import type { ImapFlowOptions } from 'imapflow'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

type MailConfig = {
    mailServer: MailServer
    mailAccount: MailAccount
}

export default defineEventHandler(async (event): Promise<boolean> => {
    const mailConfig = await readBody(event) as MailConfig

    const imapFlowOptions: ImapFlowOptions = {
        host: mailConfig.mailServer.imap_server ?? '',
        port: mailConfig.mailServer.imap_port ?? 0,
        secure: mailConfig.mailServer.imap_secure ?? false,
        auth: {
            user: mailConfig.mailAccount.email_addr ?? '',
            pass: mailConfig.mailAccount.password ?? ''
        }
    }
    let imapResult = false
    try {
        imapResult = await validateImapConfig(imapFlowOptions)
    } catch (error) {
        let message = ''
        if (error instanceof Error) {
            message = error.message
        } else if (typeof error === 'string') {
            message = error
        } else {
            console.error('Exception Occured. but unknown error type', error)
        }
        console.error('validateImapConfig', message)
    }

    const transportOptions: SMTPTransport.Options = {
        host: mailConfig.mailServer.smtp_server ?? '',
        port: mailConfig.mailServer.smtp_port ?? 0,
        secure: mailConfig.mailServer.smtp_secure ?? false,
        auth: {
            user: mailConfig.mailAccount.email_addr ?? '',
            pass: mailConfig.mailAccount.password ?? ''
        }
    }
    let smtpResult = false
    try {
        smtpResult = await validateSmtpConfig(transportOptions)
    } catch (error) {
        let message = ''
        if (error instanceof Error) {
            message = error.message
        } else if (typeof error === 'string') {
            message = error
        } else {
            console.error('Exception Occured. but unknown error type', error)
        }
        console.error('validateImapConfig', message)
    }

    return (imapResult && smtpResult)
})