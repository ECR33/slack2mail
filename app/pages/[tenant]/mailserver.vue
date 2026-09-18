<template>
    <h1>メールサーバ</h1>
    <v-row>
        <v-col>
            <v-expansion-panels>
                <v-expansion-panel title="解説">
                    <template v-slot:text>
                        この画面ではメール送信に使用するメールサーバを切替えます。<br>
                        「有効」がオンになっているサーバがメール送信に使用されます。<br>
                        同時には使用できませんが、複数のサーバを登録しておくことができます。<br>
                        <br>
                        <b>テスト用機能1</b><br>
                        テスト用サーバを登録しておくと、どのようなメールアドレスもテスト用サーバに配信され、外部には送信されなくすることができます。<br>
                        テスト用サーバはシステム管理者にお問い合わせください<br>
                        テスト用のサーバーを使用して送信するとそのメールは送信済みになり、再送はできません。<br>
                        <b>テスト用機能2</b><br>
                        「イベントシート読込」で読み込んだメールアドレスをすべて意味のない文字列にすることができます(ダミー化)。ダミー化すると本番用のサーバーを使用しても宛先不明となります。<br>
                        ダミー化は一連の送信操作を試してみたいときに使用します。ダミー化されたメールアドレスをもとに戻すには再度「イベントシート読込」を行ってください。
                    </template>
                </v-expansion-panel>
            </v-expansion-panels>
        </v-col>
    </v-row>
    <h3>現在の設定値</h3>
    <v-row class="align-center">
        <v-col>
            <h4>メールサーバ設定</h4>
        </v-col>
        <v-col class="d-flex justify-end">
            <v-btn @click="_createNewServerConfig">サーバ追加</v-btn>
            <v-btn @click="toggleDelete" class="ml-4" color="error">削除</v-btn>
        </v-col>
    </v-row>
    <v-dialog max-width="500" v-model="dialog">
        <v-card title="サーバ設定">
            <v-card-text>
                <v-row>
                    <v-col>
                        <v-text-field v-model="_serverConfig.name" label="name" placeholder="この設定の名称" variant="outlined"
                            density="compact" hide-details />
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        <v-textarea v-model="_serverConfig.description" label="description" placeholder="この設定の説明"
                            variant="outlined" density="compact" hide-details />
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        <v-text-field v-model="_serverConfig.smtp_server" label="SMTP" placeholder="smtp.example.com"
                            variant="outlined" density="compact" hide-details />
                    </v-col>
                </v-row>
                <v-row class="align-center">
                    <v-col cols="auto">
                        <v-text-field v-model="_serverConfig.smtp_port" label="port" placeholder="587" type="number"
                            variant="outlined" density="compact" hide-details />
                    </v-col>
                    <v-col cols="auto">
                        <v-switch v-model="_serverConfig.smtp_secure" label="secure" hide-details />
                    </v-col>

                </v-row>
                <v-row>
                    <v-col>
                        <v-text-field v-model="_serverConfig.imap_server" label="IMAP" placeholder="imap.example.com"
                            variant="outlined" density="compact" hide-details />
                    </v-col>
                </v-row>
                <v-row class="align-center">
                    <v-col cols="auto">
                        <v-text-field v-model="_serverConfig.imap_port" label="port" type="number" placeholder="993"
                            variant="outlined" density="compact" hide-details />
                    </v-col>
                    <v-col cols="auto">
                        <v-switch v-model="_serverConfig.imap_secure" label="secure" hide-details />
                    </v-col>
                </v-row>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn @click="_getMailServerConfig(); dialog = false">Cancel</v-btn>
                <v-btn @click="_updateMailServerConfig">更新</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    <v-row>
        <v-col>
            <v-progress-linear :indeterminate="loading || mailAccountsLoading"></v-progress-linear>
        </v-col>
    </v-row>
    <MailServerConfig :records="serverConfigs" :deleteMode="deleteMode" @clicked="onClicked" @changed="onChanged"
        @delete="onDelete" />
    <v-row class="align-center">
        <v-col>
            <h4>メールアカウント設定</h4>
        </v-col>
        <v-col class="d-flex justify-end">
            <v-btn @click="_createNewMailAccount">メールアカウント追加</v-btn>
            <v-btn @click="toggleDeleteA" class="ml-4" color="error">削除</v-btn>
        </v-col>
    </v-row>
    <v-dialog max-width="500" v-model="dialogA">
        <v-card title="メールアカウント設定">
            <v-card-text>
                <v-row>
                    <v-col>
                        <v-text-field v-model="_mailAccount.name" label="name" placeholder="代表メール" variant="outlined"
                            density="compact" hide-details />
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        <v-textarea v-model="_mailAccount.description" label="description"
                            placeholder="組織の代表として使用するメールアドレスです" variant="outlined" density="compact" hide-details />
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        <v-text-field v-model="_mailAccount.email_addr" label="email address"
                            placeholder="info@example.com" type="email" variant="outlined" density="compact"
                            hide-details />
                    </v-col>
                </v-row>
                <v-row class="align-center">
                    <v-col>
                        <v-text-field v-model="_mailAccount.password" label="password" placeholder="パスワード"
                            :type="passwordShow ? 'text' : 'password'" variant="outlined" density="compact" hide-details
                            :append-inner-icon="passwordShow ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
                            @click:append-inner="togglePassword" />
                    </v-col>
                </v-row>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn @click="_getMailAccounts(); dialogA = false">Cancel</v-btn>
                <v-btn @click="_updateMailAccount">更新</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    <MailAccount :records="mailAccounts" :deleteMode="deleteModeA" @clicked="onClickedA" @changed="onChangedA"
        @delete="onDeleteA" />
    <v-row>
        <v-col>
            <h3>テスト用機能</h3>
        </v-col>
    </v-row>
    <v-row class="align-center">
        <v-col cols="auto">
            <v-btn @click="mailRandomize" color="secondary">メールアドレスダミー化</v-btn>
        </v-col>
        <v-col>宛先(イベント参加者)メールアドレスをダミーに置き換えます</v-col>
    </v-row>
    <v-snackbar-queue ref="snackbarQueue" v-model="snackbarMessages" :total-visible="5" closable></v-snackbar-queue>
</template>
<script setup lang="ts">
import {
    getMailServerConfig, updateMailServerConfig, changeServerAvailable, deleteServerConfig,
    getMailAccounts, updateMailAccount, changeMailAccountDefault, deleteMailAccount
} from '#shared/utils/supabase'

const dialog = ref(false)
const dialogA = ref(false)
const loading = ref(false)
const mailAccountsLoading = ref(false)
const deleteMode = ref(false)
const deleteModeA = ref(false)
const passwordShow = ref(false)

const snackbarQueue = ref()
const snackbarMessages = ref<{ text: string, color: string }[]>([])

const supabase = useSupabaseClient()

const serverConfigs = ref<MailServerConfig[]>([])
const _serverConfig = ref(<MailServerConfig>{})

const mailAccounts = ref<MailAccount[]>([])
const _mailAccount = ref(<MailAccount>{})

const _getMailServerConfig = async () => {
    loading.value = true
    serverConfigs.value = await getMailServerConfig(supabase)
    loading.value = false
}


const _updateMailServerConfig = async () => {
    if (_serverConfig.value) {
        await updateMailServerConfig(_serverConfig.value, supabase)
    }
    dialog.value = false
    _getMailServerConfig()
}

const _createNewServerConfig = () => {
    _serverConfig.value = {
        id: '',
        tenant_id: '',
        name: '',
        description: '',
        smtp_server: '',
        smtp_port: 587, // or 465
        imap_server: '',
        imap_port: 993, // or 143
        smtp_secure: false,
        imap_secure: true,
        available: false
    }
    dialog.value = true
}

const _getMailAccounts = async () => {
    mailAccountsLoading.value = true
    mailAccounts.value = await getMailAccounts(supabase)
    mailAccountsLoading.value = false
}

const _updateMailAccount = async () => {
    if (_mailAccount.value) {
        await updateMailAccount(_mailAccount.value, supabase)
    }
    dialogA.value = false
    _getMailAccounts()
}

const _createNewMailAccount = () => {
    _mailAccount.value = {
        id: '',
        tenant_id: '',
        name: '',
        email_addr: '',
        password: '',
        description: '',
        default: false
    }
    dialogA.value = true
}

const toggleDelete = () => {
    deleteMode.value = !deleteMode.value
}

const toggleDeleteA = () => {
    deleteModeA.value = !deleteModeA.value
}

const togglePassword = () => {
    passwordShow.value = !passwordShow.value
}

const onClicked = (record: MailServerConfig) => {
    _serverConfig.value = record
    dialog.value = true
}

const onChanged = async (id: string) => {
    await changeServerAvailable(id, supabase)
    _getMailServerConfig()
}

const onDelete = async (id: string) => {
    await deleteServerConfig(id, supabase)
    _getMailServerConfig()
}

const onClickedA = (record: MailAccount) => {
    _mailAccount.value = record
    dialogA.value = true
}

const onChangedA = async (id: string) => {
    await changeMailAccountDefault(id, supabase)
    _getMailAccounts()
}

const onDeleteA = async (id: string) => {
    await deleteMailAccount(id, supabase)
    _getMailAccounts()
}


const mailRandomize = async () => {
    const result = confirm('メールアドレスをダミー化します。よろしいですか？')
    if (!result) {
        addMessage('info', 'キャンセルしました')
        return
    }
    const { error } = await supabase.rpc('randomize_emails')
    if (error) {
        console.error('mailRondomize: error', error)
        addMessage('error', 'メールアドレスダミー化に失敗しました')
    } else {
        addMessage('success', 'メールアドスレをダミー化しました')
    }
}

const addMessage = (color: string, text: string) => {
    snackbarMessages.value.push({
        text,
        color
    })
}

onMounted(async () => {
    _getMailServerConfig()
    _getMailAccounts()
})
</script>