/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  ssr: false,
  nitro: {
    preset: 'static',
    output: {
      dir: './dist',
      publicDir: './dist'
    },
    experimental: {
      wasm: true
    }
  },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/icon-512.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
      ]
    }
  },  
  css: ['~/assets/css/tailwind.css'],
  
  
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
  
  // Vite configuration for web-tree-sitter and Hugging Face Transformers
  vite: {
    plugins: [
      tailwindcss(),
    ],
    optimizeDeps: {
      exclude: ['web-tree-sitter', '@huggingface/transformers', 'onnxruntime-common', 'onnxruntime-web']
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
    worker: {
      format: 'es'
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'onnx-runtime': ['onnxruntime-web', 'onnxruntime-common']
          }
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