// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/supabase',
    '@nuxt/test-utils/module',
    'nuxt-qrcode'
  ],
  supabase: {
    redirect: false,
    redirectOptions: {
      login: '/login',
      callback: '/api/auth-callback',
      exclude: ['/']
    },
  },
  build: {
    transpile: ['vuetify']
  },
  vite: {
    plugins: [vuetify({ autoImport: true })],
    vue: {
      template: { transformAssetUrls }
    },
    server: {
      allowedHosts: process.env.NUXT_VITE_ALLOWED_HOST ? [process.env.NUXT_VITE_ALLOWED_HOST] : []
    },
    optimizeDeps: {
      include: [
        '@supabase/supabase-js',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'luxon',
      ]
    }
  },
  nitro: {
    preset: process.env.NITRO_PRESET || 'node-server',
    // cloudflare: {
    //   deployConfig: true,
    //   nodeCompat: true,
    // wrangler: {
    //   compatibility_flags: ['nodejs_compat']
    // }
    // },
    experimental: {
      tasks: true, // タスク機能を有効化
      // inline: ['imapflow', 'nodemailer']
    },
    // スケジュール（Cron形式）の定義
    scheduledTasks: {
      // node-serverでは未使用、pluginでrunTask呼び出し
      // 5分ごとに `server/tasks/send-approved-mails.ts` を実行
      // '*/5 * * * *': ['send-approved-mails']
    },
  },
  runtimeConfig: {
    appHost: "",
    slackAppId: "",
    slackClientId: "",
    slackClientSecret: "",
    slackSigningSecret: "",
    slackVerificationToken: "",
    slackRedirectUri: "",
    slackStateSecret: "",
    viteAllowedHost: "",
    supabaseProjectUrl: "",
    supabasePublishableKey: "",
    supabaseCallbackUrl: "",
    supabaseSecretKey: "",
    supabaseServiceRole: "",
    googleClientId: "",
    googleClientSecret: "",
    public: {
      appUrl: "",
      supabaseUrl: "",
      supabaseKey: "",
      version: "v2026.0917.0"
    }
  },
  qrcode: {
    options: {
      variant: {
        inner: 'circle',
        marker: 'rounded',
        pixel: 'rounded'
      },
      radius: 1,
      blackColor: 'currentColor',
      whiteColor: 'transparent'
    }
  }
} /*as any*/)
