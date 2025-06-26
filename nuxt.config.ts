/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    baseURL: '/curator',
    buildAssetsDir: '/_nuxt/',
    pageTransition: { name: 'page', mode: 'out-in' }    
  },

  ssr: false,

  compatibilityDate: '2025-05-15',
  
  devtools: { enabled: true },

  css: ['~/assets/css/tailwind.css'],

  experimental: {
    payloadExtraction: false // Since it's client-only
  },  
  
  // Enhanced Font Configuration
  fonts: {
    families: [
      // Primary UI Font
      {
        name: 'Inter',
        provider: 'google',
        weights: [300, 400, 500, 600, 700],
        subsets: ['latin', 'latin-ext'],
        display: 'swap',
        preload: true,
        fallbacks: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      },
      // Code Font
      {
        name: 'JetBrains Mono',
        provider: 'google',
        weights: [300, 400, 500, 600, 700],
        subsets: ['latin', 'latin-ext'],
        display: 'swap',
        preload: true,
        fallbacks: ['Fira Code', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'monospace']
      }
    ],
    experimental: {
      processCSSVariables: true
    }
  },

  // Performance optimizations for fonts and WASM support
  nitro: {
    preset: 'cloudflare',
    prerender: {
      autoSubfolderIndex: false
    },
    serveStatic: true,
    experimental: {
      wasm: true
    }
  },
  
  // Vite configuration Hugging Face Transformers
  vite: {
    plugins: [
      tailwindcss(),
    ],
    optimizeDeps: {
      exclude: ['@huggingface/transformers']
    },
    server: {
      fs: {
        allow: ['..']
      }
    },
    define: {
      // Required for @huggingface/transformers
      global: 'globalThis',
    },
    build: {
      rollupOptions: {
        external: (id) => {
          // Don't externalize for Cloudflare Workers
          return false
        }
      }
    }
  },
  
  modules: [
    '@nuxt/content',
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/test-utils',
    '@nuxt/ui',
    'shadcn-nuxt'
  ],

  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * @default "./components/ui"
     */
    componentDir: './components/ui'
  }  
})