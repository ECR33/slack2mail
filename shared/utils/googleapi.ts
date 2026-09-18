import { google } from 'googleapis'
import type { Json } from '~/types/database.types'

type GoogleCredential = {
    type: string
    auth_uri: string
    client_id: string
    token_uri: string
    project_id: string
    private_key: string
    client_email: string
    private_key_id: string
    universe_domain: string
    client_x509_cert_url: string
    auth_provider_x509_cert_url: string
}

export const createGoogleAuth = async (credentialJson: Json) => {
    const cj = credentialJson as GoogleCredential
    const auth = new google.auth.JWT(
        {
            email: cj.client_email,
            key: cj.private_key.replace(/\\n/g, '\n'),
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
        }
    )

    await auth.authorize()
    return auth
}