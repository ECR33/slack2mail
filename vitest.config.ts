import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'
import dotenv from 'dotenv'
import { expand } from 'dotenv-expand'

export default defineConfig({
  test: {
    env: expand(dotenv.config({ path: '.env.local' })).parsed,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/*.{test,spec}.ts'],
          environment: 'node',
          sequence: { groupOrder: 1 }
        },
      },
      await defineVitestProject({
        test: {
          name: 'supabase',
          sequence: { concurrent: false },
          fileParallelism: false,
          maxWorkers: 1,
          isolate: true,
          include: ['test/supabase/*.{test,spec}.ts'],
          environment: 'node',
          sequencer: { groupOrder: 2 }
        }
      }),
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
    },
  },
})
