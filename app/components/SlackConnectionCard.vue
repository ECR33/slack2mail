<script setup lang="ts">
/**
 * /[tenant]/admin 内に配置するSlack連携カード。
 *
 * - 未連携: 「Slackワークスペースと連携する」ボタンを表示
 * - 連携済み: ワークスペース名・連携日時を表示し、再連携(トークン再取得)導線を出す
 * - callbackからのリダイレクト結果(?slack_linked=1 / ?slack_oauth_error=...)をトースト的に表示
 *
 * 使い方:
 *   <SlackConnectionCard :tenant-id="tenant.tenant_id" :tenant-slug="tenant.slug" />
 * 
 * ※ Created by AI
 */
const props = defineProps<{
  tenantId: string
  tenantSlug: string
  workspace: SlackWorkspace
}>()

const route = useRoute()

const workspace = ref({ team_name: props.workspace?.team_name, installed_at: props.workspace?.installed_at })
watch(() => props.workspace, () => {
  workspace.value = { team_name: props.workspace?.team_name || '', installed_at: props.workspace?.installed_at || '' }
})



// const { data: workspace, pending, refresh } = await useAsyncData(
//   `slack-workspace-${props.tenantId}`,
//   async () => {
//     const { data } = await client
//       .from('slack_workspaces')
//       .select('team_name, installed_at')
//       .eq('tenant_id', props.tenantId)
//       .maybeSingle()
//     return data
//   },
// )
const pending = false

const isLinked = computed(() => !!workspace.value.team_name)

const justLinked = computed(() => route.query.slack_linked === '1')
const oauthErrorCode = computed(() =>
  typeof route.query.slack_oauth_error === 'string' ? route.query.slack_oauth_error : null,
)

// callback.get.ts が発行するエラーコードと、利用者向け文言の対応表。
// 未知のコードが来た場合は汎用メッセージにフォールバックする。
const SLACK_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: '連携がキャンセルされました。もう一度お試しください。',
  missing_pkce_verifier: '連携がタイムアウトしました。お手数ですが最初からやり直してください。',
  session_mismatch: 'ログイン状態が変わったため連携を確認できませんでした。再度ログインしてからお試しください。',
  server_not_configured: '現在Slack連携を利用できません。管理者にお問い合わせください。',
  slack_token_exchange_failed: 'Slack側との連携処理に失敗しました。時間をおいて再度お試しください。',
  already_linked_other_tenant:
    'このSlackワークスペースは既に別の団体で使用されています。連携するワークスペースが正しいかご確認ください。',
  server_error: '連携処理に失敗しました。時間をおいて再度お試しください。',
}

const oauthErrorMessage = computed(() => {
  if (!oauthErrorCode.value) return null
  return SLACK_OAUTH_ERROR_MESSAGES[oauthErrorCode.value] ?? SLACK_OAUTH_ERROR_MESSAGES.server_error
})

function formatDateTime(value: string | null) {
  if (value) {
    return new Date(value).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } else {
    return ''
  }
}

function startSlackOAuth() {
  // サーバ側でstate署名・PKCE付与を行うため、そのままフルナビゲーションで飛ばす
  window.location.href = `/api/slack/oauth/start?tenant=${encodeURIComponent(props.tenantSlug)}`
}

// callback成功直後はDBへの反映が確実に終わっているので、表示を最新化する
if (justLinked.value) {
  // await refresh()
}
</script>

<template>
  <section class="slack-card">
    <div class="slack-card__header">
      <h2 class="slack-card__title">Slack連携</h2>
      <span v-if="isLinked" class="slack-card__badge slack-card__badge--linked">連携済み</span>
      <span v-else class="slack-card__badge slack-card__badge--unlinked">未連携</span>
    </div>

    <p v-if="justLinked" class="slack-card__notice slack-card__notice--success">
      Slackワークスペースと連携しました。
    </p>
    <p v-if="oauthErrorMessage" class="slack-card__notice slack-card__notice--error">
      {{ oauthErrorMessage }}
    </p>

    <div v-if="pending" class="slack-card__body">
      <p class="slack-card__hint">読み込み中です。</p>
    </div>

    <div v-else-if="isLinked && workspace" class="slack-card__body">
      <dl class="slack-card__meta">
        <dt>ワークスペース</dt>
        <dd>{{ workspace.team_name }}</dd>
        <dt>連携日時</dt>
        <dd>{{ formatDateTime(workspace.installed_at) }}</dd>
      </dl>
      <button type="button" class="slack-card__button slack-card__button--secondary" @click="startSlackOAuth">
        Slack連携をやり直す
      </button>
      <p class="slack-card__hint">
        Botの権限を変更した場合や、認証情報を再取得したい場合にお使いください。
      </p>
    </div>

    <div v-else class="slack-card__body">
      <p class="slack-card__hint">
        Slackワークスペースと連携すると、<code>/slack2mail</code>コマンドやメールのレビュー通知が使えるようになります。
      </p>
      <button type="button" class="slack-card__button slack-card__button--primary" @click="startSlackOAuth">
        Slackワークスペースと連携する
      </button>
    </div>
  </section>
</template>

<style scoped>
.slack-card {
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 32rem;
}

.slack-card__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.slack-card__title {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0;
}

.slack-card__badge {
  font-size: 0.75rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-weight: 500;
}

.slack-card__badge--linked {
  background: #e6f4ea;
  color: #1e7e34;
}

.slack-card__badge--unlinked {
  background: #f1f1f1;
  color: #666;
}

.slack-card__notice {
  font-size: 0.875rem;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  margin: 0 0 0.75rem;
}

.slack-card__notice--success {
  background: #e6f4ea;
  color: #1e7e34;
}

.slack-card__notice--error {
  background: #fdecea;
  color: #b3261e;
}

.slack-card__meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 0.75rem;
  font-size: 0.9rem;
  margin: 0 0 1rem;
}

.slack-card__meta dt {
  color: #666;
}

.slack-card__meta dd {
  margin: 0;
  font-weight: 500;
}

.slack-card__hint {
  font-size: 0.85rem;
  color: #666;
  margin: 0.5rem 0 0;
}

.slack-card__button {
  border: none;
  border-radius: 6px;
  padding: 0.55rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.slack-card__button--primary {
  background: #4a154b;
  /* Slackのブランドカラーに寄せる */
  color: #fff;
}

.slack-card__button--primary:hover {
  background: #3a0e3d;
}

.slack-card__button--secondary {
  background: #fff;
  color: #4a154b;
  border: 1px solid #4a154b;
}

.slack-card__button--secondary:hover {
  background: #f5eef5;
}
</style>