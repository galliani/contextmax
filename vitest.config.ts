import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json-summary', 'json', 'html'],
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
        },
        // Suppress module warnings during tests
        logLevel: 'silent'
      }
    },
    // Suppress console warnings in tests
    silent: false,
    reporters: ['verbose']
  }
}) 