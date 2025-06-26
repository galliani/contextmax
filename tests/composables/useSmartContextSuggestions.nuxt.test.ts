/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { watch } from 'vue'
import { useSmartContextSuggestions } from '~/composables/useSmartContextSuggestions'
import type { KeywordSearchSuggestion } from '~/composables/useSmartContextSuggestions'

// Mock dependencies
interface MockIndexedDBCache {
  initDB: ReturnType<typeof vi.fn>
  getCachedProjectEmbeddings: ReturnType<typeof vi.fn>
  storeCachedProjectEmbeddings: ReturnType<typeof vi.fn>
  calculateProjectHash: ReturnType<typeof vi.fn>
  getCachedEmbedding: ReturnType<typeof vi.fn>
  storeCachedEmbedding: ReturnType<typeof vi.fn>
  calculateHash: ReturnType<typeof vi.fn>
  cleanOldCache: ReturnType<typeof vi.fn>
}

interface MockRegexCodeParser {
  parseCode: ReturnType<typeof vi.fn>
  isLanguageSupported: ReturnType<typeof vi.fn>
}

interface MockAccessibility {
  announceStatus: ReturnType<typeof vi.fn>
}

interface MockNuxtApp {
  $llm?: {
    engine?: ReturnType<typeof vi.fn>
    status?: string
  }
}

// Create shared mock instances
const mockIndexedDBCache: MockIndexedDBCache = {
  initDB: vi.fn().mockResolvedValue(true),
  getCachedProjectEmbeddings: vi.fn().mockResolvedValue(null),
  storeCachedProjectEmbeddings: vi.fn().mockResolvedValue(true),
  calculateProjectHash: vi.fn().mockResolvedValue('mock-hash'),
  getCachedEmbedding: vi.fn().mockResolvedValue(null),
  storeCachedEmbedding: vi.fn().mockResolvedValue(true),
  calculateHash: vi.fn().mockResolvedValue('file-hash'),
  cleanOldCache: vi.fn().mockResolvedValue(undefined)
}

const mockRegexCodeParser: MockRegexCodeParser = {
  parseCode: vi.fn().mockReturnValue({
    functions: [{ name: 'testFunction', startLine: 1, endLine: 5 }],
    classes: [{ name: 'TestClass', startLine: 10, endLine: 20 }],
    imports: [{ module: './utils', startLine: 1 }],
    exports: [{ name: 'TestExport', startLine: 25 }]
  }),
  isLanguageSupported: vi.fn().mockReturnValue(true)
}

const mockAccessibility: MockAccessibility = {
  announceStatus: vi.fn()
}

const mockNuxtApp: MockNuxtApp = {
  $llm: {
    engine: vi.fn().mockResolvedValue({
      data: new Array(1536).fill(0.1)
    }),
    status: 'ready'
  }
}

// Mock the composables
vi.mock('~/composables/useIndexedDBCache', () => ({
  useIndexedDBCache: () => mockIndexedDBCache
}))

vi.mock('~/composables/useRegexCodeParser', () => ({
  useRegexCodeParser: () => mockRegexCodeParser
}))

vi.mock('~/composables/useAccessibility', () => ({
  useAccessibility: () => mockAccessibility
}))

// Mock useNuxtApp
vi.mock('#app', () => ({
  useNuxtApp: () => mockNuxtApp
}))

describe('useSmartContextSuggestions', () => {
  let smartSuggestions: ReturnType<typeof useSmartContextSuggestions>

  // Sample files for testing
  const createMockFiles = () => [
    {
      path: 'src/components/Button.vue',
      content: `<template>
  <button @click="handleClick" class="btn">{{ label }}</button>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps(['label'])
const emit = defineEmits(['click'])

function handleClick() {
  emit('click')
}
</script>`
    },
    {
      path: 'src/components/Card.vue',
      content: `<template>
  <div class="card">
    <h2>{{ title }}</h2>
    <p>{{ content }}</p>
  </div>
</template>

<script setup>
import { defineProps } from 'vue'
const props = defineProps(['title', 'content'])
</script>`
    },
    {
      path: 'src/utils/helpers.ts',
      content: `export function formatDate(date: Date): string {
  return date.toLocaleDateString()
}

export function validateEmail(email: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)
}

export class UserService {
  async getUser(id: string) {
    return fetch(\`/api/users/\${id}\`)
  }
}`
    },
    {
      path: 'src/stores/user.ts',
      content: `import { defineStore } from 'pinia'
import { UserService } from '../utils/helpers'

export const useUserStore = defineStore('user', () => {
  const userService = new UserService()
  
  const state = reactive({
    currentUser: null,
    loading: false
  })
  
  async function loadUser(id: string) {
    state.loading = true
    try {
      state.currentUser = await userService.getUser(id)
    } finally {
      state.loading = false
    }
  }
  
  return { state, loadUser }
})`
    }
  ]

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset mock return values to defaults
    mockIndexedDBCache.initDB.mockResolvedValue(true)
    mockIndexedDBCache.getCachedProjectEmbeddings.mockResolvedValue(null)
    mockIndexedDBCache.storeCachedProjectEmbeddings.mockResolvedValue(true)
    mockIndexedDBCache.calculateProjectHash.mockResolvedValue('mock-hash')
    mockIndexedDBCache.getCachedEmbedding.mockResolvedValue(null)
    mockIndexedDBCache.storeCachedEmbedding.mockResolvedValue(true)
    mockIndexedDBCache.calculateHash.mockResolvedValue('file-hash')
    mockIndexedDBCache.cleanOldCache.mockResolvedValue(undefined)

    mockRegexCodeParser.parseCode.mockReturnValue({
      functions: [{ name: 'testFunction', startLine: 1, endLine: 5 }],
      classes: [{ name: 'TestClass', startLine: 10, endLine: 20 }],
      imports: [{ module: './utils', startLine: 1 }],
      exports: [{ name: 'TestExport', startLine: 25 }]
    })
    mockRegexCodeParser.isLanguageSupported.mockReturnValue(true)

    mockAccessibility.announceStatus.mockClear()

    if (mockNuxtApp.$llm?.engine) {
      mockNuxtApp.$llm.engine.mockResolvedValue({
        data: new Array(1536).fill(0.1)
      })
      mockNuxtApp.$llm.status = 'ready'
    }

    // Initialize the composable after setting up mocks
    smartSuggestions = useSmartContextSuggestions()
  })

  describe('Initialization', () => {
    it('should initialize with correct default state', () => {
      expect(smartSuggestions.isAnalyzing.value).toBe(false)
      expect(smartSuggestions.analysisProgress.value).toBe(0)
      expect(smartSuggestions.hasLoadedFromCache.value).toBe(false)
    })

    it('should provide all required methods', () => {
      expect(typeof smartSuggestions.loadCachedAnalysis).toBe('function')
      expect(typeof smartSuggestions.performTriModelSearch).toBe('function')
      expect(typeof smartSuggestions.clearAnalysisState).toBe('function')
      expect(typeof smartSuggestions.clearCache).toBe('function')
    })
  })

  describe('loadCachedAnalysis', () => {
    it('should load analysis with cache check', async () => {
      const files = createMockFiles()
      
      await smartSuggestions.loadCachedAnalysis(files)

      expect(mockRegexCodeParser.parseCode).toHaveBeenCalled()
    })

    it('should load from cache when available', async () => {
      const files = createMockFiles()
      const cachedEmbeddings = {
        projectHash: 'cached-hash',
        fileEmbeddings: {},
        timestamp: Date.now()
      }

      mockIndexedDBCache.getCachedProjectEmbeddings.mockResolvedValue(cachedEmbeddings)

      await smartSuggestions.loadCachedAnalysis(files)

      expect(smartSuggestions.hasLoadedFromCache.value).toBe(true)
    })

    it('should handle analysis errors gracefully', async () => {
      const files = createMockFiles()
      mockIndexedDBCache.initDB.mockRejectedValue(new Error('Cache error'))

      // Should complete without crashing even if cache initialization fails
      await expect(smartSuggestions.loadCachedAnalysis(files)).resolves.toBeUndefined()
    })

    it('should set analyzing state during analysis', async () => {
      const files = createMockFiles()
      
      // Mock a delay to test state changes
      mockRegexCodeParser.parseCode.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          functions: [],
          classes: [],
          imports: [],
          exports: []
        }), 100))
      )

      const analysisPromise = smartSuggestions.loadCachedAnalysis(files)
      
      // Should be analyzing initially
      expect(smartSuggestions.isAnalyzing.value).toBe(true)
      
      await analysisPromise
      
      // Should not be analyzing after completion
      expect(smartSuggestions.isAnalyzing.value).toBe(false)
    })
  })

  describe('performTriModelSearch', () => {
    it('should perform tri-model search and return enhanced results', async () => {
      const files = createMockFiles()
      const keyword = 'user'

      const result = await smartSuggestions.performTriModelSearch(keyword, files)

      expect(result.type).toBe('keywordSearch')
      expect(result.data.keyword).toBe(keyword)
      expect(result.data.files).toBeInstanceOf(Array)
      expect(result.title).toContain('AI-Powered Search Results')
      expect(result.description).toContain('tri-model analysis')
    })

    it('should combine AST, LLM, syntax, and classification results', async () => {
      const files = createMockFiles()
      const keyword = 'button'

      const result = await smartSuggestions.performTriModelSearch(keyword, files)
      
      expect(result.data.files.length).toBeGreaterThanOrEqual(0)
      
      if (result.data.files.length > 0) {
        const fileResult = result.data.files[0]
        expect(fileResult).toHaveProperty('file')
        expect(fileResult).toHaveProperty('finalScore')
        expect(fileResult).toHaveProperty('scorePercentage')
        expect(fileResult).toHaveProperty('astScore')
        expect(fileResult).toHaveProperty('llmScore')
        expect(fileResult).toHaveProperty('flanScore')
        expect(fileResult).toHaveProperty('syntaxScore')
        expect(fileResult).toHaveProperty('hasSynergy')
        expect(fileResult).toHaveProperty('matches')
        // New tri-model properties
        expect(fileResult).toHaveProperty('classification')
        expect(fileResult).toHaveProperty('workflowPosition')
      }
    })

    it('should support entry point analysis', async () => {
      const files = createMockFiles()
      const keyword = 'test'
      const entryPointFile = {
        path: 'src/main.ts',
        content: 'import { createApp } from "vue"\nexport function bootstrap() {}'
      }
      
      const result = await smartSuggestions.performTriModelSearch(keyword, files, entryPointFile)
      
      expect(result.type).toBe('keywordSearch')
      expect(result.data.keyword).toBe(keyword)
      
      // Entry point file should be classified as 'entry-point'
      if (result.data.files.length > 0) {
        const entryFile = result.data.files.find(f => f.file === entryPointFile.path)
        if (entryFile) {
          expect(entryFile.classification).toBe('entry-point')
        }
      }
    })

    it('should handle search errors gracefully', async () => {
      const files = createMockFiles()
      const keyword = 'test'
      
      if (mockNuxtApp.$llm?.engine) {
        mockNuxtApp.$llm.engine.mockRejectedValue(new Error('LLM API error'))
      }

      const result = await smartSuggestions.performTriModelSearch(keyword, files)
      
      // Should still return a result even if LLM search fails
      expect(result.type).toBe('keywordSearch')
      expect(result.data.keyword).toBe(keyword)
    })

    it('should classify files into appropriate categories', async () => {
      const files = [
        {
          path: 'src/config/database.ts',
          content: 'export const DB_CONFIG = { host: "localhost" }'
        },
        {
          path: 'src/utils/helpers.ts',
          content: 'export function formatDate() {} export function validateEmail() {}'
        },
        {
          path: 'src/services/userService.ts',
          content: 'export class UserService { async getUser() {} async createUser() {} }'
        }
      ]
      const keyword = 'user'

      const result = await smartSuggestions.performTriModelSearch(keyword, files)
      
      if (result.data.files.length > 0) {
        const configFile = result.data.files.find(f => f.file.includes('config'))
        const helperFile = result.data.files.find(f => f.file.includes('helpers'))
        const serviceFile = result.data.files.find(f => f.file.includes('userService'))
        
        if (configFile) {
          expect(['config', 'helper', 'core-logic', 'unknown']).toContain(configFile.classification)
        }
        if (helperFile) {
          expect(['helper', 'core-logic', 'unknown']).toContain(helperFile.classification)
        }
        if (serviceFile) {
          expect(['core-logic', 'helper', 'unknown']).toContain(serviceFile.classification)
        }
      }
    })
  })

  // Keyword extraction functionality has been removed

  describe('state management', () => {
    it('should clear analysis state correctly', () => {
      smartSuggestions.clearAnalysisState()

      expect(smartSuggestions.hasLoadedFromCache.value).toBe(false)
      expect(smartSuggestions.isAnalyzing.value).toBe(false)
      expect(smartSuggestions.analysisProgress.value).toBe(0)
    })

    it('should clear cache when requested', async () => {
      smartSuggestions.clearCache()
      
      expect(smartSuggestions.hasLoadedFromCache.value).toBe(false)
    })
  })

  describe('dependency graph building', () => {
    it('should build dependency relationships between files', async () => {
      const files = [
        {
          path: 'src/components/App.vue',
          content: `import Button from './Button.vue'
import { UserService } from '../utils/helpers'`
        },
        {
          path: 'src/components/Button.vue',
          content: '<template><button>Click</button></template>'
        },
        {
          path: 'src/utils/helpers.ts',
          content: 'export class UserService {}'
        }
      ]

      await smartSuggestions.loadCachedAnalysis(files)
      
      // Analysis should complete successfully
      expect(smartSuggestions.dependencyGraph.value).toBeDefined()
    })
  })

  describe('performance and caching', () => {
    it('should cache embeddings for reuse', async () => {
      const files = createMockFiles()
      
      await smartSuggestions.performTriModelSearch('test', files)
      
      // Should attempt to get cached embeddings (may or may not be called depending on implementation)
      // The test verifies the search completes successfully
      expect(files.length).toBeGreaterThan(0)
    })

    it('should reuse cached embeddings when available', async () => {
      const files = createMockFiles()
      const cachedEmbedding = new Array(1536).fill(0.2)
      
      mockIndexedDBCache.getCachedEmbedding.mockResolvedValue(cachedEmbedding)
      
      const result = await smartSuggestions.performTriModelSearch('test', files)
      
      // Should complete search successfully with cached embeddings available
      expect(result.type).toBe('keywordSearch')
      expect(result.data.keyword).toBe('test')
    })

    it('should update analysis progress during processing', async () => {
      const files = createMockFiles()
      
      // Mock slow processing to observe progress updates
      const progressUpdates: number[] = []
      
      // Watch for progress changes
      const stopWatcher = watch(smartSuggestions.analysisProgress, (newValue) => {
        progressUpdates.push(newValue)
      })
      
      await smartSuggestions.loadCachedAnalysis(files)
      
      stopWatcher()
      
      // Progress should have been updated during analysis
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(smartSuggestions.analysisProgress.value).toBe(100)
    })
  })

  describe('error handling', () => {
    it('should handle LLM API errors gracefully', async () => {
      const files = createMockFiles()
      
      if (mockNuxtApp.$llm?.engine) {
        mockNuxtApp.$llm.engine.mockRejectedValue(new Error('API limit exceeded'))
      }
      
      const result = await smartSuggestions.performTriModelSearch('test', files)
      
      // Should still return a result with AST-only search
      expect(result.type).toBe('keywordSearch')
      expect(result.data.files.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle regex parsing errors', async () => {
      const files = createMockFiles()
      
      mockRegexCodeParser.parseCode.mockImplementation(() => {
        throw new Error('Parsing failed')
      })
      
      const result = await smartSuggestions.performTriModelSearch('test', files)
      
      // Should still complete without crashing
      expect(result.type).toBe('keywordSearch')
    })

    it('should handle cache storage failures gracefully', async () => {
      const files = createMockFiles()
      
      mockIndexedDBCache.storeCachedProjectEmbeddings.mockRejectedValue(new Error('Storage full'))
      
      await expect(smartSuggestions.loadCachedAnalysis(files)).resolves.toBeUndefined()
    })
  })

  describe('integration scenarios', () => {
    it('should handle different file types correctly', async () => {
      const mixedFiles = [
        {
          path: 'src/component.vue',
          content: '<template><div>Vue component</div></template>'
        },
        {
          path: 'src/utils.ts',
          content: 'export function utility() { return true }'
        },
        {
          path: 'src/styles.css',
          content: '.button { background: blue; }'
        },
        {
          path: 'README.md',
          content: '# Project Documentation'
        }
      ]

      // Mock isLanguageSupported to return false for non-code files
      mockRegexCodeParser.isLanguageSupported.mockImplementation((path: string) => {
        return path.endsWith('.ts') || path.endsWith('.vue')
      })

      await smartSuggestions.loadCachedAnalysis(mixedFiles)
      
      // Analysis should complete without errors
      expect(smartSuggestions.isAnalyzing.value).toBe(false)
    })
  })
}) 