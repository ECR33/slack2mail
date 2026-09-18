import { vi, describe, it, expect } from 'vitest'
import { createImapClient, getSentFolder, appendMessage, createRawMessage, getMessageId, validateImapConfig, validateSmtpConfig } from '../../shared/utils/mailutilsr'
import type { ImapFlowOptions } from 'imapflow'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

describe('メール送信テスト', () => {
    it('IMAP格納テスト', async () => {
        // ここは getImapconfig で行うところ
        const imapflowOptions: ImapFlowOptions = {
            host: '10.10.20.13',
            port: 3143,
            secure: false,
            auth: {
                user: 'testuser@test.local',
                pass: 'testpass',
            },
            logger: false
        }
        const imapClient = await createImapClient(imapflowOptions)

        try {
            await imapClient.connect()
        } catch (error) {
            console.error('error', error)
        }

        const targetFolder = await getSentFolder(imapClient)
        expect(targetFolder).toEqual('Sent')


        const mailMessage = {
            from: 'soumu@hinogakuenpta.org',
            to: 'user1@example.com',
            subject: 'テストメール',
            text: '送信済みメールを保管するテスト',
            replyTo: 'info@hinogakuenpta.org'
        }
        const rawMessageBuffer = await createRawMessage(mailMessage)

        const messageId = await getMessageId(rawMessageBuffer)
        expect(messageId).not.toEqual('')

        await appendMessage(rawMessageBuffer, targetFolder, imapClient)
        await imapClient.logout()

    })
    it('IMAP定義テスト', async () => {
        // green mail
        const imapflowOptions: ImapFlowOptions = {
            host: '10.10.20.13',
            port: 3143,
            secure: false,
            auth: {
                user: 'testuser@test.local',
                pass: 'testpass',
            },
            logger: false
        }

        const resut = await validateImapConfig(imapflowOptions)
        expect(resut).toBe(true)
    })
    it('SMTP定義テスト', async () => {
        // mailpit
        const transportOptions: SMTPTransport.Options = {
            host: '10.10.20.13',
            port: 1025,
            secure: false,
            auth: {
                user: 'testuser@test.local',
                pass: 'testpass'
            }
        }
        const result = await validateSmtpConfig(transportOptions)
        expect(result).toBe(true)
    })

})



