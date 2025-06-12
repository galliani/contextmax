import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json-summary', 'html'],
      exclude: [
        '.nuxt/**',
        'node_modules/**',
        'pages/**',
        'scripts/**',
        'types/**'
      ]
    },
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
        mock: {
          intersectionObserver: true,
          indexedDb: true,
        }
      }
    }
  }
}) 