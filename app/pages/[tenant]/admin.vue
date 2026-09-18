<template>
    <div class="pa-2 my-2" style="border: 1px solid #e0e0e0;border-radius: 5px;">
        <table>
            <tbody>
                <tr>
                    <td>テナント名</td>
                    <td>:</td>
                    <td>{{ currentTenant?.name }}</td>
                </tr>
                <tr>
                    <td>slug</td>
                    <td>:</td>
                    <td>{{ currentTenant?.slug }}</td>
                </tr>
            </tbody>
        </table>
    </div>
    <v-stepper-vertical v-model="currentStep" :multiple="finished" :mandatory="!finished" :hide-actions="finished">
        <template v-slot:default="{ step }">
            <!-- Google Service Account -->
            <v-stepper-vertical-item :complete="step > 1" subtitle="Google Driveにアクセスするアカウントを設定" value="1" editable>
                <template v-slot:title>
                    <span>Google Service Account</span>
                    <v-icon v-if="googleServiceAccountAvailable" class="ml-2">mdi-check-circle-outline</v-icon>
                </template>
                <v-row>
                    <v-col>
                        <v-text-field v-model="credentialJson.service_account_email" readonly variant="outlined"
                            label="Service Account email" />
                        <v-text-field v-model="credentialJson.private_key_id" readonly variant="outlined"
                            label="Private Key ID" />
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        <v-btn @click="gsa_dialog = true"><v-icon class="mr-1">mdi-plus-circle</v-icon>登録・更新</v-btn>
                    </v-col>
                    <v-spacer />
                    <v-col cols="auto">
                        <v-btn @click="deleteGoogleServiceAccount" color="error"
                            variant="text"><v-icon>mdi-delete</v-icon></v-btn>
                    </v-col>
                </v-row>
                <v-dialog v-model="gsa_dialog" width="auto">
                    <v-card>
                        <v-card-title>
                            サービスアカウントクレデンシャル登録
                        </v-card-title>
                        <v-card-subtitle>
                            こちらにGoogleからダウンロードしたjsonの中身を貼り付けてください
                        </v-card-subtitle>
                        <v-card-text>
                            <v-textarea v-model="service_account_json_str" variant="outlined"
                                label="Google Service Account Json" :placeholder="example" clearable />
                        </v-card-text>
                        <v-card-actions>
                            <v-btn @click="gsa_dialog = false">キャンセル</v-btn>
                            <v-btn @click="upsertGoogleServiceAccount" color="primary" variant="tonal">登録</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>

                <template v-slot:next="{ next }">
                    <v-btn color="primary" @click="next"></v-btn>
                </template>

                <template v-slot:prev></template>
            </v-stepper-vertical-item>

            <!-- slack2mail.config sheet -->
            <v-stepper-vertical-item :complete="step > 2" subtitle="宛先を設定するシートを設定" value="2" editable>
                <template v-slot:title>
                    <span>slack2mail Config Sheet</span>
                    <v-icon v-if="slack2mailSheetConfigAvailable" class="ml-2">mdi-check-circle-outline</v-icon>
                </template>
                <v-row>
                    <v-col>
                        <v-text-field v-model="slack2mailSheetConfig.sheet_id" label="Sheet ID" variant="outlined"
                            hide-details readonly />
                    </v-col>
                </v-row>
                <v-row class="mt-1 ml-1">
                    <v-col>
                        <a :href="`https://docs.google.com/spreadsheets/d/${slack2mailSheetConfig?.sheet_id}`"
                            target="_blank" rel="noopener noreferrer">設定用シート</a>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        <v-btn @click="s2msc_dialog = true"><v-icon class="mr-1">mdi-plus-circle</v-icon>登録・更新</v-btn>
                    </v-col>
                </v-row>
                <v-dialog v-model="s2msc_dialog" width="auto">
                    <v-card>
                        <v-card-title>
                            slack2mail設定シート 登録
                        </v-card-title>
                        <v-card-subtitle>
                            こちらにGoogle Spreadsheetへのリンク(URL)を貼り付けてください
                        </v-card-subtitle>
                        <v-card-text>
                            <v-text-field v-model="slack2mailSheetConfigUrl" label="SpreadsheetのURL"
                                :placeholder="example2" variant="outlined" clearable />
                        </v-card-text>
                        <v-card-actions>
                            <v-btn @click="s2msc_dialog = false">キャンセル</v-btn>
                            <v-btn @click="upsertSlack2mailSheetConfig" variant="tonal" color="primary">登録</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>
                <template v-slot:next="{ next }">
                    <v-btn color="primary" @click="next"></v-btn>
                </template>

                <template v-slot:prev="{ prev }">
                    <v-btn variant="plain" @click="prev"></v-btn>
                </template>
            </v-stepper-vertical-item>

            <!-- members sheet config -->
            <v-stepper-vertical-item :complete="step > 3" subtitle="メンバーリストを設定" value="3" editable>
                <template v-slot:title>
                    <span>Member List Sheet</span>
                    <v-icon v-if="membersSheetConfigAvailable" class="ml-2">mdi-check-circle-outline</v-icon>
                </template>
                <v-row>
                    <v-col>
                        <v-text-field v-model="membersSheetConfig.sheet_id" variant="outlined" label="Sheet ID"
                            :placeholder="example2" readonly hide-details />
                    </v-col>
                </v-row>
                <v-row class="mt-1 ml-1">
                    <v-col>
                        <a :href="`https://docs.google.com/spreadsheets/d/${membersSheetConfig?.sheet_id}`"
                            target="_blank" rel="noopener noreferrer">メンバーリストシート</a>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        <v-text-field v-model="membersSheetConfig.sheet_name" variant="outlined" label="シート名"
                            readonly />
                        <v-text-field v-model="membersSheetConfig.name_column_name" variant="outlined" label="氏名 列名"
                            readonly />
                        <v-text-field v-model="membersSheetConfig.email_column_name" variant="outlined"
                            label="メールアドレス 列名" readonly />
                        <v-text-field v-model="membersSheetConfig.filter_column_name" variant="outlined"
                            label="フィルター名 列名" readonly />
                        <v-text-field v-model="membersSheetConfig.filter_column_values" variant="outlined"
                            label="フィルター値 (読込み可とする値)" readonly />
                    </v-col>
                </v-row>
                <v-row class="mt-0">
                    <v-col>
                        <v-btn @click="openMscDialog"><v-icon class="mr-1">mdi-plus-circle</v-icon>登録・更新</v-btn>
                    </v-col>
                </v-row>
                <v-dialog v-model="msc_dialog" width="auto">
                    <v-card>
                        <v-card-title>
                            メンバーリストシート 登録
                        </v-card-title>
                        <v-card-subtitle>
                        </v-card-subtitle>
                        <v-card-text>
                            <v-row>
                                <v-col>
                                    <v-text-field v-model="membersSheetConfigUrl" label="SpreadsheetのURL"
                                        :placeholder="example2" variant="outlined" clearable
                                        hint="こちらにGoogle Spreadsheetへのリンク(URL)を貼り付けてください" persistent-hint />
                                </v-col>
                            </v-row>
                            <v-row>
                                <v-col>
                                    <v-text-field v-model="_membersSheetConfig.sheet_id" label="シートID"
                                        variant="outlined" clearable />
                                    <v-text-field v-model="_membersSheetConfig.sheet_name" label="シート名"
                                        variant="outlined" clearable />
                                    <v-text-field v-model="_membersSheetConfig.name_column_name" label="氏名 列名"
                                        variant="outlined" clearable />
                                    <v-text-field v-model="_membersSheetConfig.email_column_name" label="メールアドレス 列名"
                                        variant="outlined" clearable />
                                    <v-text-field v-model="_membersSheetConfig.filter_column_name" label="フィルター名 列名"
                                        variant="outlined" clearable />
                                    <div v-for="(item, index) in _membersSheetConfig.filter_column_values" :key="index">
                                        <v-text-field v-model="_membersSheetConfig.filter_column_values[index]"
                                            label="フィルター値 (読込み可とする値)" variant="outlined" clearable
                                            append-icon="mdi-minus-circle"
                                            @click:append="removeFilterColumnValue(index)" />
                                    </div>
                                    <v-btn @click="addFilterColumnValue"><v-icon
                                            class="mr-1">mdi-plus-circle</v-icon>フィルター値追加</v-btn>
                                </v-col>
                            </v-row>
                        </v-card-text>
                        <v-card-actions>
                            <v-btn @click="msc_dialog = false">キャンセル</v-btn>
                            <v-btn @click="upsertMembersSheetConfig" variant="tonal" color="primary">登録</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>
                <template v-slot:next="{ next }">
                    <v-btn color="primary" text="Next" @click="next"></v-btn>
                </template>

                <template v-slot:prev="{ prev }">
                    <v-btn variant="plain" @click="prev"></v-btn>
                </template>
            </v-stepper-vertical-item>
            <!-- mail server config -->
            <v-stepper-vertical-item :complete="step > 4" subtitle="メールサーバとアカウントを設定" value="4" editable>
                <template v-slot:title>
                    <span>Mail Server & Account</span>
                    <v-icon v-if="mailServerConfigAvailable && mailAccountAvailable"
                        class="ml-2">mdi-check-circle-outline</v-icon>
                </template>
                <h4 class="my-1">メールサーバ</h4>
                <v-table class="mb-3">
                    <thead>
                        <tr>
                            <th>名称</th>
                            <th>説明</th>
                            <th>SMTP</th>
                            <th>PORT</th>
                            <th>SECURE</th>
                            <th>IMAP</th>
                            <th>PORT</th>
                            <th>SECURE</th>
                            <th>利用有無</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="serverConfig in serverConfigs" :key="serverConfig.id"
                            @click="openMailServerDialog(serverConfig)" style="cursor:pointer;">
                            <td>{{ serverConfig.name }}</td>
                            <td v-html="serverConfig.description?.replaceAll('\n', '<br>')"></td>
                            <td>{{ serverConfig.smtp_server }}</td>
                            <td>{{ serverConfig.smtp_port }}</td>
                            <td>{{ serverConfig.smtp_secure }}</td>
                            <td>{{ serverConfig.imap_server }}</td>
                            <td>{{ serverConfig.imap_port }}</td>
                            <td>{{ serverConfig.imap_secure }}</td>
                            <td>{{ serverConfig.available ? "利用中" : "未使用" }}</td>
                        </tr>
                    </tbody>
                </v-table>

                <v-row class="mt-0">
                    <v-col>
                        <v-btn @click="openMailServerDialog"><v-icon class="mr-1">mdi-plus-circle</v-icon>追加</v-btn>
                    </v-col>
                </v-row>
                <v-dialog v-model="mailServer_dialog" width="auto">
                    <v-card>
                        <v-card-title>
                            メールサーバ 登録
                        </v-card-title>
                        <v-card-text>
                            <v-row>
                                <v-col cols="12">
                                    <v-text-field v-model="_serverConfig.name" label="name" placeholder="この設定の名称"
                                        variant="outlined" density="compact" hide-details />
                                </v-col>
                                <v-col cols="12">
                                    <v-textarea v-model="_serverConfig.description" label="description"
                                        placeholder="この設定の説明" variant="outlined" density="compact" hide-details />
                                </v-col>
                                <v-col cols="12">
                                    <v-text-field v-model="_serverConfig.smtp_server" label="SMTP"
                                        placeholder="smtp.example.com" variant="outlined" density="compact"
                                        hide-details />
                                </v-col>
                            </v-row>
                            <v-row class="align-center">
                                <v-col cols="auto">
                                    <v-text-field v-model="_serverConfig.smtp_port" label="port" placeholder="587"
                                        type="number" variant="outlined" density="compact" hide-details />
                                </v-col>
                                <v-col cols="auto">
                                    <v-switch v-model="_serverConfig.smtp_secure" label="secure" hide-details />
                                </v-col>

                            </v-row>
                            <v-row>
                                <v-col>
                                    <v-text-field v-model="_serverConfig.imap_server" label="IMAP"
                                        placeholder="imap.example.com" variant="outlined" density="compact"
                                        hide-details />
                                </v-col>
                            </v-row>
                            <v-row class="align-center">
                                <v-col cols="auto">
                                    <v-text-field v-model="_serverConfig.imap_port" label="port" type="number"
                                        placeholder="993" variant="outlined" density="compact" hide-details />
                                </v-col>
                                <v-col cols="auto">
                                    <v-switch v-model="_serverConfig.imap_secure" label="secure" hide-details />
                                </v-col>
                            </v-row>
                            <v-row class="align-center">
                                <v-col>
                                    <v-switch v-model="_serverConfig.available" label="有効" hide-details />
                                </v-col>
                            </v-row>
                        </v-card-text>
                        <v-card-actions>
                            <v-btn v-if="_serverConfig.id" @click="_deleteMailServerConfig()" color="error"
                                class="d-flex align-left"><v-icon>mdi-delete</v-icon></v-btn>
                            <v-spacer></v-spacer>
                            <v-btn @click="_getMailServerConfig(); mailServer_dialog = false">Cancel</v-btn>
                            <v-btn @click="_updateMailServerConfig" variant="tonal" color="primary">更新</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>

                <h4>メールアカウント</h4>
                <v-table class="mb-3">
                    <thead>
                        <tr>
                            <th>送信名</th>
                            <th>メールアドレス</th>
                            <th>パスワード</th>
                            <th>説明</th>
                            <th>既定</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="mailAccount in mailAccounts" :key="mailAccount.id"
                            @click="openMailAccountDialog(mailAccount)" style="cursor:pointer;">
                            <td>{{ mailAccount.name }}</td>
                            <td>{{ mailAccount.email_addr }}</td>
                            <td>********</td>
                            <td v-html="mailAccount.description?.replaceAll('\n', '<br>')"></td>
                            <td>{{ mailAccount.default ? "既定" : "" }}</td>
                        </tr>
                    </tbody>
                </v-table>
                <v-row class="mt-0">
                    <v-col>
                        <v-btn @click="openMailAccountDialog"><v-icon class="mr-1">mdi-plus-circle</v-icon>追加</v-btn>
                    </v-col>
                </v-row>
                <v-dialog v-model="mailAccount_dialog" width="auto">
                    <v-card>
                        <v-card-title>
                            メールアカウント 登録
                        </v-card-title>
                        <v-card-text>
                            <v-row>
                                <v-col cols="12">
                                    <v-text-field v-model="_mailAccount.name" label="name" placeholder="送信者名"
                                        variant="outlined" density="compact" hide-details />
                                </v-col>
                                <v-col cols="12">
                                    <v-text-field v-model="_mailAccount.email_addr" label="メールアドレス"
                                        placeholder="mail@example.com" variant="outlined" density="compact"
                                        hide-details />
                                </v-col>
                                <v-col cols="12">
                                    <v-text-field v-model="_mailAccount.password" label="パスワード" placeholder="パスワード"
                                        :type="passwordShow ? 'text' : 'password'" variant="outlined" density="compact"
                                        hide-details
                                        :append-inner-icon="passwordShow ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
                                        @click:append-inner="passwordShow = !passwordShow" />
                                </v-col>
                                <v-col cols="12">
                                    <v-textarea v-model="_mailAccount.description" label="説明" placeholder="この設定の説明"
                                        variant="outlined" density="compact" hide-details />
                                </v-col>
                            </v-row>
                            <v-row class="align-center">
                                <v-col cols="auto">
                                    <v-switch v-model="_mailAccount.default" label="既定" hide-details />
                                </v-col>
                                <v-spacer />
                                <v-col cols="auto">
                                    <v-btn :loading="mailChecking" @click="mailCheck">
                                        <v-icon v-if="mailChecked && mailValid">mdi-check</v-icon>
                                        <v-icon v-if="mailChecked && !mailValid">mdi-close</v-icon>
                                        接続テスト
                                    </v-btn>
                                </v-col>
                            </v-row>
                        </v-card-text>
                        <v-card-actions>
                            <v-btn v-if="_mailAccount.id" @click="_deleteMailAccount()" color="error"
                                class="d-flex align-left"><v-icon>mdi-delete</v-icon></v-btn>
                            <v-spacer></v-spacer>
                            <v-btn @click="_getMailAccounts(); mailAccount_dialog = false">Cancel</v-btn>
                            <v-btn @click="_updateMailAccount" variant="tonal" color="primary">更新</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>

                <template v-slot:next="{ next }">
                    <v-btn color="primary" text="Next" @click="next"></v-btn>
                </template>

                <template v-slot:prev="{ prev }">
                    <v-btn variant="plain" @click="prev"></v-btn>
                </template>
            </v-stepper-vertical-item>
            <!-- slack workspace -->
            <v-stepper-vertical-item :complete="step > 5" subtitle="Slack Workspaceを設定" value="5" editable>
                <template v-slot:title>
                    <span>Slack Workspace</span>
                    <v-icon v-if="slackWorkspaceConfigAvailable" class="ml-2">mdi-check-circle-outline</v-icon>
                </template>
                <SlackConnectionCard :tenant-id="tenantId" :tenant-slug="slug" :workspace="slackWorkspaceConfig[0]!" />

                <v-table>
                    <thead>
                        <tr>
                            <th>team ID</th>
                            <th>ワークスペース名</th>
                            <th>インストール者</th>
                            <th>インストール日時</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="workspace in slackWorkspaceConfig" :key="workspace.id">
                            <td>{{ workspace.team_id }}</td>
                            <td>{{ workspace.team_name }}</td>
                            <td>{{ workspace.installed_user_id }}</td>
                            <td>{{ DateTime.fromISO(workspace.installed_at || '').toFormat('yyyy-MM-dd HH:mm') }}</td>
                            <td><v-icon @click="deleteWorkspace(workspace)" color="error">mdi-delete</v-icon></td>
                        </tr>
                    </tbody>
                </v-table>
                <template v-slot:next="{ next }">
                    <v-btn color="primary" text="Next" @click="next"></v-btn>
                </template>

                <template v-slot:prev="{ prev }">
                    <v-btn v-if="!finished" variant="plain" @click="prev"></v-btn>
                </template>
            </v-stepper-vertical-item>
            <!-- ブランド設定 -->
            <v-stepper-vertical-item :complete="step > 6" subtitle="ブランドを設定" value="6" editable
                @click:next="onClickFinish">
                <template v-slot:title>
                    <span>Brand Name && Icon</span>
                    <v-icon v-if="tenantBrandConfigAvailable" class="ml-2">mdi-check-circle-outline</v-icon>
                </template>
                <v-row class="align-center box" style="cursor: pointer;" @click="openBrand">
                    <v-col cols="3" sm="1">
                        <v-img :src="currentTenant?.brand_icon_url || '/slack2mail_icon.png'" />
                    </v-col>
                    <v-col>
                        {{ currentTenant?.brand_name }}
                        <span v-if="!brand_name" style="color: #808080;font-size: 0.7em;">【未設定】</span>
                    </v-col>
                </v-row>
                <v-dialog v-model="brand_dialog" width="auto">
                    <v-card width="90vw" :max-width="450">
                        <v-card-title>ブランド設定</v-card-title>
                        <v-card-text>
                            <v-row>
                                <v-col>
                                    <v-img v-if="brand_icon" :src="brand_icon" width="150" :aspect-ratio="1" />
                                    <v-img v-else :src="'/slack2mail_icon.png'" width="150" :aspect-ratio="1" />
                                </v-col>
                            </v-row>
                            <v-row>
                                <v-col cols="12">
                                    <v-text-field v-model="brand_icon" label="Icon"
                                        placeholder="https://example.com/image-file-name.png" variant="outlined"
                                        hide-details clearable append-inner-icon="mdi-restore"
                                        @click:append-inner="brand_icon = currentTenant?.brand_icon_url ?? ''" />
                                </v-col>
                                <v-col cols="12">
                                    <v-text-field v-model="brand_name" label="Brand Name"
                                        :placeholder="currentTenant?.brand_name" variant="outlined" hide-details
                                        clearable append-inner-icon="mdi-restore"
                                        @click:append-inner="brand_name = currentTenant?.brand_name ?? ''" />
                                </v-col>
                            </v-row>
                        </v-card-text>
                        <v-card-actions>
                            <v-btn @click="brand_dialog = false">Cancel</v-btn>
                            <v-btn @click="updateBrand">更新</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>

                <template v-slot:next="{ next }">
                    <v-btn color="primary" text="Finish" @click="next"></v-btn>
                </template>

                <template v-slot:prev="{ prev }">
                    <v-btn v-if="!finished" variant="plain" @click="prev"></v-btn>
                </template>
            </v-stepper-vertical-item>
        </template>
    </v-stepper-vertical>
    <v-btn v-if="finished" text="Reset" variant="plain" @click="finished = false"></v-btn>


</template>
<script setup lang="ts">
import { DateTime } from 'luxon'

// stepper
const currentStep = ref(0)
const finished = ref(false)

//
const supabase = useSupabaseClient()
const service_account_json_str = ref('')
const currentTenant = useCurrentTenant()
const tenantId = currentTenant.value?.tenant_id || ''
const slug = currentTenant.value?.slug || ''

// Google Service Account
const googleServiceAccountAvailable = ref(false)
type Credential = {
    tenant_id: string
    service_account_email: string | null
    private_key_id: string | null
    created_by: string | null
    created_at: string
}
const credentialJson = ref<Credential>(<Credential>{})

const example = JSON.stringify({
    "type": "service_account",
    "project_id": "your project id",
    "private_key_id": "727999f01xxxx62baff78436a2786fxxxx8795xx",
    "private_key": "-----BEGIN PRIVATE KEY----- xxxxx -----END PRIVATE KEY-----\n",
    "client_email": "yourmail@hinogakuenpta.iam.gserviceaccount.com", "client_id": "990771899243032955585",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/slack2mail%40hinogakuenpta.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
}, null, 2)

const gsa_dialog = ref(false)

const getCredential = async () => {
    const { data, error } = await supabase.from('tenant_google_credentials').select().eq('tenant_id', tenantId).maybeSingle()
    if (data) {
        credentialJson.value = data
        googleServiceAccountAvailable.value = true
    } else {
        if (error) {
            // alert('Googleサービスアカウントの情報は取得できませんでした \n' + error.message)
            console.error('getCredential', error.message)
        }
        googleServiceAccountAvailable.value = false

    }
}

const upsertGoogleServiceAccount = async () => {
    try {
        const serviceAccountJson = JSON.parse(service_account_json_str.value)
        const { error } = await supabase.rpc('upsert_tenant_google_credential', {
            p_tenant_id: tenantId,
            p_service_account_json: serviceAccountJson,
        })
        if (error) {
            alert('登録できませんでした \n' + error.message)
        } else {
            getCredential()
            gsa_dialog.value = false
        }

    } catch (error) {
        let message
        if (error instanceof Error) {
            message = error.message
        } else if (typeof error === 'string') {
            message = error
        }
        alert('クレデンシャルの解析に失敗しました \n' + message)
    }
}

const deleteGoogleServiceAccount = async () => {
    const result = confirm('Googleサービスアカウントを削除します')
    if (result) {
        const { error } = await supabase.rpc('delete_tenant_google_credential', { p_tenant_id: tenantId })
        if (error) {
            alert('削除できませんでした\n' + error.message)
        } else {
            credentialJson.value.service_account_email = ''
            credentialJson.value.private_key_id = ''
            googleServiceAccountAvailable.value = false
        }
    }
}

// slack2mail config sheet
const slack2mailSheetConfigAvailable = ref(false)
const s2msc_dialog = ref(false)
const slack2mailSheetConfigUrl = ref('')
const slack2mailSheetConfig = ref({ sheet_id: '' })

const example2 = 'https://docs.google.com/spreadsheets/d/1yYx9MxGxxM1HUEeyTKzxRQrJIYx4xxxxxxxxxxxxdjI/edit?gid=1859997997#gid=1859969339'

const getSlack2mailSheetConfig = async () => {
    const { data, error } = await supabase.from('slack2mail_sheet_config').select().eq('tenant_id', tenantId)
    if (error) {
        alert('slack2mail sheet configの情報は取得できませんでした\n' + error.message)
    } else {
        if (data && data.length > 0) {
            slack2mailSheetConfig.value.sheet_id = data[0]?.sheet_id || ''
            slack2mailSheetConfigAvailable.value = true
        }
    }
}

const upsertSlack2mailSheetConfig = async () => {
    const match = slack2mailSheetConfigUrl.value.match(/spreadsheets\/d\/([^/]+)/)
    if (match) {
        const sheet_id = match[1] || ''
        const param = {
            tenant_id: tenantId,
            sheet_id
        }
        const { data, error } = await supabase.from('slack2mail_sheet_config').upsert(param, { onConflict: 'tenant_id' })
        if (error) {
            console.error(tenantId, sheet_id)
            alert('slack2mail sheet configの情報を登録できませんでした\n' + error.message)
        } else {
            getSlack2mailSheetConfig()
            s2msc_dialog.value = false
        }
    } else {
        alert('シートのURLからシートIDを取り出せませんでした。URLが正しくないようです。')
    }
}

// members sheet config
const msc_dialog = ref(false)
const membersSheetConfigUrl = ref('')
const membersSheetConfigAvailable = ref(false)
const membersSheetConfig = ref({
    tenant_id: '',
    sheet_id: '',
    sheet_name: '',
    name_column_name: '',
    email_column_name: '',
    filter_column_name: '',
    filter_column_values: [''] as any[]
})
const _membersSheetConfig = ref({
    tenant_id: '',
    sheet_id: '',
    sheet_name: '',
    name_column_name: '',
    email_column_name: '',
    filter_column_name: '',
    filter_column_values: [''] as any[]
})

const addFilterColumnValue = () => {
    _membersSheetConfig.value.filter_column_values.push('')
}
const removeFilterColumnValue = (index: number) => {
    _membersSheetConfig.value.filter_column_values.splice(index, 1)

}

const openMscDialog = () => {
    _membersSheetConfig.value.tenant_id = membersSheetConfig.value.tenant_id
    _membersSheetConfig.value.sheet_id = membersSheetConfig.value.sheet_id
    _membersSheetConfig.value.sheet_name = membersSheetConfig.value.sheet_name
    _membersSheetConfig.value.name_column_name = membersSheetConfig.value.name_column_name
    _membersSheetConfig.value.email_column_name = membersSheetConfig.value.email_column_name
    _membersSheetConfig.value.filter_column_name = membersSheetConfig.value.filter_column_name
    _membersSheetConfig.value.filter_column_values = [...membersSheetConfig.value.filter_column_values]
    msc_dialog.value = true
}

const getMembersSheetConfig = async () => {
    const { data, error } = await supabase.from('members_sheet_config').select().eq('tenant_id', tenantId)
    if (error) {
        alert('メンバーリストシートの情報を登録できませんでした\n' + error.message)
    } else {
        if (data && data.length > 0) {
            const msc = data[0]
            membersSheetConfig.value.sheet_id = msc?.sheet_id || ''
            membersSheetConfig.value.sheet_name = msc?.sheet_name || ''
            membersSheetConfig.value.tenant_id = msc?.tenant_id || ''
            membersSheetConfig.value.name_column_name = msc?.name_column_name || ''
            membersSheetConfig.value.email_column_name = msc?.email_column_name || ''
            membersSheetConfig.value.filter_column_name = msc?.filter_column_name || ''
            membersSheetConfig.value.filter_column_values = msc?.filter_column_values || [] as any
            membersSheetConfigAvailable.value = true
        }
    }
}
watch(() => membersSheetConfigUrl.value, () => {
    if (membersSheetConfigUrl.value) {
        const match = membersSheetConfigUrl.value.match(/spreadsheets\/d\/([^/]+)/)
        if (match) {
            const sheet_id = match[1] || ''
            _membersSheetConfig.value.sheet_id = sheet_id
        } else {
            alert('シートのURLからシートIDを取り出せませんでした。URLが正しくないようです。')
        }
    }
})
const upsertMembersSheetConfig = async () => {
    _membersSheetConfig.value.tenant_id = tenantId
    const { data, error } = await supabase.from('members_sheet_config').upsert(_membersSheetConfig.value, { onConflict: 'tenant_id' })
    if (error) {
        alert('slack2mail sheet configの情報を登録できませんでした\n' + error.message)
    } else {
        getMembersSheetConfig()
        msc_dialog.value = false
    }
}

// mail server config
const mailServer_dialog = ref(false)
const mailServerConfigAvailable = ref(false)
const serverConfigs = ref<MailServerConfig[]>([])
const _serverConfig = ref<MailServerConfig>({
    tenant_id: tenantId,
    name: '',
    description: '',
    smtp_server: '',
    smtp_port: 587,
    imap_server: '',
    imap_port: 993,
    smtp_secure: false,
    imap_secure: true,
    available: false
})
const passwordShow = ref(false)

const _getMailServerConfig = async () => {
    serverConfigs.value = await getMailServerConfig(supabase)
    if (serverConfigs.value && serverConfigs.value.length > 0) {
        mailServerConfigAvailable.value = true
    }
}


const _updateMailServerConfig = async () => {
    if (_serverConfig.value) {
        await updateMailServerConfig(_serverConfig.value, supabase)
    }
    mailServer_dialog.value = false
    _getMailServerConfig()
}

const _deleteMailServerConfig = async () => {
    if (_serverConfig.value.id) {
        const result = confirm('このデータを削除します。よろしいですか？')
        if (result) {
            await deleteServerConfig(_serverConfig.value.id, supabase)
        }
    }
    mailServer_dialog.value = false
    _getMailServerConfig()
}

const createNewServerConfig = () => {
    _serverConfig.value = {
        tenant_id: tenantId,
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
}

const openMailServerDialog = (mailServerConfig: MailServerConfig) => {
    if (mailServerConfig.id) {
        _serverConfig.value.id = mailServerConfig.id
        _serverConfig.value.tenant_id = mailServerConfig.tenant_id
        _serverConfig.value.name = mailServerConfig.name
        _serverConfig.value.description = mailServerConfig.description
        _serverConfig.value.smtp_server = mailServerConfig.smtp_server
        _serverConfig.value.smtp_port = mailServerConfig.smtp_port
        _serverConfig.value.imap_server = mailServerConfig.imap_server
        _serverConfig.value.imap_port = mailServerConfig.imap_port
        _serverConfig.value.smtp_secure = mailServerConfig.smtp_secure
        _serverConfig.value.imap_secure = mailServerConfig.imap_secure
        _serverConfig.value.available = mailServerConfig.available
    } else {
        createNewServerConfig()
    }
    mailServer_dialog.value = true
}

// mail account config
const mailAccount_dialog = ref(false)
const mailAccountAvailable = ref(false)
const mailAccounts = ref<MailAccount[]>([])
const _mailAccount = ref<MailAccountInsert>({
    tenant_id: tenantId,
    name: '',
    email_addr: '',
    password: '',
    description: '',
    default: false
})

const _getMailAccounts = async () => {
    mailAccounts.value = await getMailAccounts(supabase)
    if (mailAccounts.value && mailAccounts.value.length > 0) {
        mailAccountAvailable.value = true
    }
}

const _updateMailAccount = async () => {
    if (_mailAccount.value) {
        await updateMailAccount(_mailAccount.value, supabase)
    }
    mailAccount_dialog.value = false
    _getMailAccounts()
}

const _createNewMailAccount = () => {
    _mailAccount.value = {
        tenant_id: tenantId,
        name: '',
        email_addr: '',
        password: '',
        description: '',
        default: false
    }
}

const openMailAccountDialog = (mailAccount: MailAccount) => {
    if (mailAccount.id) {
        _mailAccount.value.id = mailAccount.id
        _mailAccount.value.tenant_id = mailAccount.tenant_id
        _mailAccount.value.name = mailAccount.name
        _mailAccount.value.email_addr = mailAccount.email_addr
        _mailAccount.value.password = mailAccount.password
        _mailAccount.value.description = mailAccount.description
        _mailAccount.value.default = mailAccount.default
    } else {
        _createNewMailAccount()
    }
    mailChecking.value = false
    mailChecked.value = false
    mailAccount_dialog.value = true
}

const _deleteMailAccount = async () => {
    if (_mailAccount.value.id) {
        const result = confirm('このデータを削除します。よろしいですか？')
        if (result) {
            await deleteMailAccount(_mailAccount.value.id, supabase)
        }
    }
    mailAccount_dialog.value = false
    _getMailAccounts()
}

const mailChecking = ref(false)
const mailChecked = ref(false)
const mailValid = ref(false)
const mailCheck = async () => {
    mailChecking.value = true
    mailChecked.value = false
    const serverConfigsF = serverConfigs.value.filter(f => (f.available))
    if (serverConfigsF.length == 1) {
        const serverConfig = serverConfigsF[0]
        mailValid.value = await $fetch('/api/mail-config-check', { method: 'POST', body: { mailServer: serverConfig, mailAccount: _mailAccount.value } })
    }
    mailChecked.value = true
    mailChecking.value = false
}

// slack workspace

const slackWorkspaceConfigAvailable = ref(false)
const slackWorkspaceConfig = ref<SlackWorkspace[]>([])

const getWorkspaceConfig = async () => {
    const { data, error } = await supabase.from('slack_workspaces').select().eq('tenant_id', tenantId)
    if (data && data.length > 0) {
        slackWorkspaceConfigAvailable.value = true
        slackWorkspaceConfig.value = data
    } else {
        slackWorkspaceConfig.value = []
    }
}

const deleteWorkspace = async (workspace: SlackWorkspace) => {
    const result = confirm('Slack Workspaceのデータを削除し連携を解除します。\n(Slack側のアプリ設定も削除されます)')
    if (result) {
        if (workspace.id) {
            await $fetch('/api/slack/uninstall', {
                method: 'POST',
                body: { tenantId: tenantId }
            })
        } else {
            alert('ワークスペースの情報がありませんでした。\nページをリロードしてからやり直してください。')
        }
        const router = useRouter()
        router.replace(`/${slug}/admin`)
    }
    getWorkspaceConfig()
}

// tenant config

const tenantBrandConfigAvailable = ref(false)
const brand_name = ref('')
const brand_icon = ref('')
const brand_dialog = ref(false)


const getBrand = async () => {
    const { data: tenant, error } = await supabase.from('tenants').select().eq('tenant_id', tenantId).maybeSingle()
    if (error) {
        console.error('tenant error', error)
    } else {
        brand_name.value = tenant?.brand_name ?? ''
        brand_icon.value = tenant?.brand_icon_url ?? ''
        if (brand_name.value && brand_icon.value) {
            tenantBrandConfigAvailable.value = true
        }
    }
}

const openBrand = async () => {
    await getBrand()
    brand_dialog.value = true
}

const updateBrand = async () => {
    const brand = {
        brand_name: brand_name.value,
        brand_icon_url: brand_icon.value
    }
    const { data, error } = await supabase.from('tenants').update(brand).eq('tenant_id', tenantId)
    if (error) {
        alert('更新できませんでした\n' + error.message)
    } else {
        await getBrand()
        if (currentTenant.value) {
            currentTenant.value.brand_name = brand_name.value
            currentTenant.value.brand_icon_url = brand_icon.value
        }
        brand_dialog.value = false
    }
}


//

const setCurrentStep = () => {
    if (tenantBrandConfigAvailable.value) {
        finished.value = true
        currentStep.value = 7
    } else if (slackWorkspaceConfigAvailable.value) {
        currentStep.value = 6
    } else if (mailServerConfigAvailable.value) {
        currentStep.value = 5
    } else if (membersSheetConfigAvailable.value) {
        currentStep.value = 4
    } else if (slack2mailSheetConfigAvailable.value) {
        currentStep.value = 3
    } else if (googleServiceAccountAvailable.value) {
        currentStep.value = 2
    } else {
        currentStep.value = 1
    }
}
watch([() => googleServiceAccountAvailable, () => slack2mailSheetConfigAvailable, () => membersSheetConfigAvailable, () => mailServerConfigAvailable, () => mailAccountAvailable, () => slackWorkspaceConfigAvailable, () => tenantBrandConfigAvailable], () => {
    setCurrentStep()
})

const onClickFinish = () => {
    finished.value = true
}

onMounted(async () => {
    await getCredential()
    await getSlack2mailSheetConfig()
    await getMembersSheetConfig()
    await _getMailServerConfig()
    await _getMailAccounts()
    await getWorkspaceConfig()
    await getBrand()
    setCurrentStep()
})
</script>
<style lang="css" scoped>
.box {
    border: 1px rgb(151, 184, 184) solid;
    border-radius: 5px;
    padding: 1em;
}
</style>