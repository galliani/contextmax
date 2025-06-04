import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.nuxt/',
        '.output/',
        'coverage/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*'
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