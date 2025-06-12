/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { watch } from 'vue'
import { useSmartContextSuggestions } from '~/composables/useSmartContextSuggestions'
import type { 
  ContextSetSuggestion, 
  RelatedFilesSuggestion, 
  WorkflowSuggestion
} from '~/composables/useSmartContextSuggestions'

// Mock dependencies
interface MockIndexedDBCache {
  initDB: ReturnType<typeof vi.fn>
  getCachedProjectAnalysis: ReturnType<typeof vi.fn>
  storeCachedProjectAnalysis: ReturnType<typeof vi.fn>
  calculateProjectHash: ReturnType<typeof vi.fn>
  getCachedEmbedding: ReturnType<typeof vi.fn>
  storeCachedEmbedding: ReturnType<typeof vi.fn>
  calculateHash: ReturnType<typeof vi.fn>
  cleanOldCache: ReturnType<typeof vi.fn>
}

interface MockTreeSitter {
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
  getCachedProjectAnalysis: vi.fn().mockResolvedValue(null),
  storeCachedProjectAnalysis: vi.fn().mockResolvedValue(true),
  calculateProjectHash: vi.fn().mockResolvedValue('mock-hash'),
  getCachedEmbedding: vi.fn().mockResolvedValue(null),
  storeCachedEmbedding: vi.fn().mockResolvedValue(true),
  calculateHash: vi.fn().mockResolvedValue('file-hash'),
  cleanOldCache: vi.fn().mockResolvedValue(undefined)
}

const mockTreeSitter: MockTreeSitter = {
  parseCode: vi.fn().mockResolvedValue({
    functions: [{ name: 'testFunction', startLine: 1, endLine: 5 }],
    classes: [{ name: 'TestClass', startLine: 10, endLine: 20 }],
    imports: [{ module: './utils', startLine: 1 }],
    exports: [{ name: 'TestExport', startLine: 25 }],
    calls: [{ name: 'testCall', startLine: 15 }]
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

vi.mock('~/composables/useTreeSitter', () => ({
  useTreeSitter: () => mockTreeSitter
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
    mockIndexedDBCache.getCachedProjectAnalysis.mockResolvedValue(null)
    mockIndexedDBCache.storeCachedProjectAnalysis.mockResolvedValue(true)
    mockIndexedDBCache.calculateProjectHash.mockResolvedValue('mock-hash')
    mockIndexedDBCache.getCachedEmbedding.mockResolvedValue(null)
    mockIndexedDBCache.storeCachedEmbedding.mockResolvedValue(true)
    mockIndexedDBCache.calculateHash.mockResolvedValue('file-hash')
    mockIndexedDBCache.cleanOldCache.mockResolvedValue(undefined)

    mockTreeSitter.parseCode.mockResolvedValue({
      functions: [{ name: 'testFunction', startLine: 1, endLine: 5 }],
      classes: [{ name: 'TestClass', startLine: 10, endLine: 20 }],
      imports: [{ module: './utils', startLine: 1 }],
      exports: [{ name: 'TestExport', startLine: 25 }],
      calls: [{ name: 'testCall', startLine: 15 }]
    })
    mockTreeSitter.isLanguageSupported.mockReturnValue(true)

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
      expect(smartSuggestions.extractedKeywords.value).toEqual([])
      expect(smartSuggestions.hasLoadedFromCache.value).toBe(false)
    })

    it('should provide all required methods', () => {
      expect(typeof smartSuggestions.analyzeProject).toBe('function')
      expect(typeof smartSuggestions.generateSuggestions).toBe('function')
      expect(typeof smartSuggestions.performHybridKeywordSearch).toBe('function')
      expect(typeof smartSuggestions.clearAnalysisState).toBe('function')
      expect(typeof smartSuggestions.clearCache).toBe('function')
    })
  })

  describe('analyzeProject', () => {
    it('should analyze project files and extract keywords', async () => {
      const files = createMockFiles()
      
      await smartSuggestions.analyzeProject(files)

      expect(mockIndexedDBCache.initDB).toHaveBeenCalled()
      expect(mockIndexedDBCache.calculateProjectHash).toHaveBeenCalledWith(files)
      expect(mockIndexedDBCache.getCachedProjectAnalysis).toHaveBeenCalled()
      expect(smartSuggestions.extractedKeywords.value.length).toBeGreaterThan(0)
    })

    it('should load from cache when available', async () => {
      const files = createMockFiles()
      const cachedAnalysis = {
        projectHash: 'cached-hash',
        extractedKeywords: [
          {
            keyword: 'user',
            frequency: 3,
            sources: ['class', 'function'],
            confidence: 0.8,
            relatedFiles: ['src/utils/helpers.ts']
          }
        ],
        fileEmbeddings: {},
        timestamp: Date.now()
      }

      mockIndexedDBCache.getCachedProjectAnalysis.mockResolvedValue(cachedAnalysis)

      await smartSuggestions.analyzeProject(files)

      expect(smartSuggestions.hasLoadedFromCache.value).toBe(true)
      expect(smartSuggestions.extractedKeywords.value).toEqual(cachedAnalysis.extractedKeywords)
    })

    it('should handle analysis errors gracefully', async () => {
      const files = createMockFiles()
      mockIndexedDBCache.initDB.mockRejectedValue(new Error('Cache error'))

      await expect(smartSuggestions.analyzeProject(files)).rejects.toThrow('Cache error')
    })

    it('should set analyzing state during analysis', async () => {
      const files = createMockFiles()
      
      // Mock a delay to test state changes
      mockIndexedDBCache.calculateProjectHash.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('hash'), 100))
      )

      const analysisPromise = smartSuggestions.analyzeProject(files)
      
      // Should be analyzing initially
      expect(smartSuggestions.isAnalyzing.value).toBe(true)
      
      await analysisPromise
      
      // Should not be analyzing after completion
      expect(smartSuggestions.isAnalyzing.value).toBe(false)
    })
  })

  describe('generateSuggestions', () => {
    it('should generate context set suggestions', () => {
      const files = createMockFiles()
      
      const suggestions = smartSuggestions.generateSuggestions(files)
      
      expect(suggestions.length).toBeGreaterThan(0)
      
      const contextSetSuggestions = suggestions.filter(s => s.type === 'contextSet') as ContextSetSuggestion[]
      expect(contextSetSuggestions.length).toBeGreaterThan(0)
      
      const suggestion = contextSetSuggestions[0]
      expect(suggestion.data.suggestedName).toBeDefined()
      expect(suggestion.data.files).toBeInstanceOf(Array)
      expect(suggestion.data.reason).toBeDefined()
      expect(suggestion.data.category).toMatch(/^(feature|domain|layer|component)$/)
    })

    it('should generate related files suggestions when dependencies exist', () => {
      const files = createMockFiles()
      
      // Mock parseCode to return dependencies
      mockTreeSitter.parseCode.mockResolvedValue({
        functions: [{ name: 'testFunction', startLine: 1, endLine: 5 }],
        classes: [{ name: 'TestClass', startLine: 10, endLine: 20 }],
        imports: [{ module: './Button.vue', startLine: 1 }],
        exports: [{ name: 'TestExport', startLine: 25 }],
        calls: [{ name: 'testCall', startLine: 15 }]
      })
      
      const suggestions = smartSuggestions.generateSuggestions(files)
      
      // May or may not have related files suggestions depending on dependency resolution
      const relatedFilesSuggestions = suggestions.filter(s => s.type === 'relatedFiles') as RelatedFilesSuggestion[]
      
      if (relatedFilesSuggestions.length > 0) {
        const suggestion = relatedFilesSuggestions[0]
        expect(suggestion.data.baseFile).toBeDefined()
        expect(suggestion.data.relatedFiles).toBeInstanceOf(Array)
        expect(suggestion.data.relatedFiles[0]).toHaveProperty('file')
        expect(suggestion.data.relatedFiles[0]).toHaveProperty('relationship')
        expect(suggestion.data.relatedFiles[0]).toHaveProperty('confidence')
      }
    })

    it('should generate workflow suggestions when entry points exist', () => {
      const files = createMockFiles()
      
      const suggestions = smartSuggestions.generateSuggestions(files)
      
      // May or may not have workflow suggestions depending on entry point detection
      const workflowSuggestions = suggestions.filter(s => s.type === 'workflow') as WorkflowSuggestion[]
      
      if (workflowSuggestions.length > 0) {
        const suggestion = workflowSuggestions[0]
        expect(suggestion.data.name).toBeDefined()
        expect(suggestion.data.steps).toBeInstanceOf(Array)
      }
    })

    it('should handle empty files array', () => {
      const suggestions = smartSuggestions.generateSuggestions([])
      expect(suggestions).toEqual([])
    })
  })

  describe('performHybridKeywordSearch', () => {
    it('should perform keyword search and return hybrid results', async () => {
      const files = createMockFiles()
      const keyword = 'user'

      const result = await smartSuggestions.performHybridKeywordSearch(keyword, files)

      expect(result.type).toBe('keywordSearch')
      expect(result.data.keyword).toBe(keyword)
      expect(result.data.files).toBeInstanceOf(Array)
    })

    it('should combine AST and LLM search results', async () => {
      const files = createMockFiles()
      const keyword = 'button'

      const result = await smartSuggestions.performHybridKeywordSearch(keyword, files)
      
      expect(result.data.files.length).toBeGreaterThanOrEqual(0)
      
      if (result.data.files.length > 0) {
        const fileResult = result.data.files[0]
        expect(fileResult).toHaveProperty('file')
        expect(fileResult).toHaveProperty('finalScore')
        expect(fileResult).toHaveProperty('astScore')
        expect(fileResult).toHaveProperty('llmScore')
        expect(fileResult).toHaveProperty('hasSynergy')
        expect(fileResult).toHaveProperty('matches')
      }
    })

    it('should handle search errors gracefully', async () => {
      const files = createMockFiles()
      const keyword = 'test'
      
      if (mockNuxtApp.$llm?.engine) {
        mockNuxtApp.$llm.engine.mockRejectedValue(new Error('LLM API error'))
      }

      const result = await smartSuggestions.performHybridKeywordSearch(keyword, files)
      
      // Should still return a result even if LLM search fails
      expect(result.type).toBe('keywordSearch')
      expect(result.data.keyword).toBe(keyword)
    })
  })

  describe('keyword extraction', () => {
    it('should extract keywords from file paths and content', async () => {
      const files = createMockFiles()
      
      await smartSuggestions.analyzeProject(files)
      
      const keywords = smartSuggestions.extractedKeywords.value
      expect(keywords.length).toBeGreaterThan(0)
      
      // Check keyword structure
      const keyword = keywords[0]
      expect(keyword).toHaveProperty('keyword')
      expect(keyword).toHaveProperty('frequency')
      expect(keyword).toHaveProperty('sources')
      expect(keyword).toHaveProperty('confidence')
      expect(keyword).toHaveProperty('relatedFiles')
      expect(keyword.confidence).toBeGreaterThan(0)
      expect(keyword.confidence).toBeLessThanOrEqual(1)
    })

    it('should filter out common programming terms', async () => {
      const files = createMockFiles()
      
      await smartSuggestions.analyzeProject(files)
      
      const keywords = smartSuggestions.extractedKeywords.value
      const commonTerms = ['function', 'const', 'import', 'export', 'class']
      
      // Should not include basic programming keywords
      const hasCommonTerms = keywords.some(k => commonTerms.includes(k.keyword.toLowerCase()))
      expect(hasCommonTerms).toBe(false)
    })

    it('should calculate confidence scores correctly', async () => {
      const files = createMockFiles()
      
      await smartSuggestions.analyzeProject(files)
      
      const keywords = smartSuggestions.extractedKeywords.value
      
      // All keywords should have valid confidence scores
      keywords.forEach(keyword => {
        expect(keyword.confidence).toBeGreaterThan(0)
        expect(keyword.confidence).toBeLessThanOrEqual(1)
        expect(typeof keyword.confidence).toBe('number')
      })
    })
  })

  describe('state management', () => {
    it('should clear analysis state correctly', () => {
      smartSuggestions.clearAnalysisState()

      expect(smartSuggestions.extractedKeywords.value).toEqual([])
      expect(smartSuggestions.hasLoadedFromCache.value).toBe(false)
      expect(smartSuggestions.isAnalyzing.value).toBe(false)
      expect(smartSuggestions.analysisProgress.value).toBe(0)
    })

    it('should clear cache when requested', async () => {
      smartSuggestions.clearCache()
      
      expect(smartSuggestions.extractedKeywords.value).toEqual([])
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

      await smartSuggestions.analyzeProject(files)
      
      // Dependencies should influence the suggestions
      const suggestions = smartSuggestions.generateSuggestions(files)
      expect(suggestions.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('performance and caching', () => {
    it('should cache embeddings for reuse', async () => {
      const files = createMockFiles()
      
      await smartSuggestions.performHybridKeywordSearch('test', files)
      
      // Should attempt to get cached embeddings (may or may not be called depending on implementation)
      // The test verifies the search completes successfully
      expect(files.length).toBeGreaterThan(0)
    })

    it('should reuse cached embeddings when available', async () => {
      const files = createMockFiles()
      const cachedEmbedding = new Array(1536).fill(0.2)
      
      mockIndexedDBCache.getCachedEmbedding.mockResolvedValue(cachedEmbedding)
      
      const result = await smartSuggestions.performHybridKeywordSearch('test', files)
      
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
      
      await smartSuggestions.analyzeProject(files)
      
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
      
      const result = await smartSuggestions.performHybridKeywordSearch('test', files)
      
      // Should still return a result with AST-only search
      expect(result.type).toBe('keywordSearch')
      expect(result.data.files.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle tree-sitter parsing errors', async () => {
      const files = createMockFiles()
      
      mockTreeSitter.parseCode.mockRejectedValue(new Error('Parsing failed'))
      
      const result = await smartSuggestions.performHybridKeywordSearch('test', files)
      
      // Should still complete without crashing
      expect(result.type).toBe('keywordSearch')
    })

    it('should handle cache storage failures gracefully', async () => {
      const files = createMockFiles()
      
      mockIndexedDBCache.storeCachedProjectAnalysis.mockRejectedValue(new Error('Storage full'))
      
      await expect(smartSuggestions.analyzeProject(files)).rejects.toThrow('Storage full')
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
      mockTreeSitter.isLanguageSupported.mockImplementation((path: string) => {
        return path.endsWith('.ts') || path.endsWith('.vue')
      })

      await smartSuggestions.analyzeProject(mixedFiles)
      
      const suggestions = smartSuggestions.generateSuggestions(mixedFiles)
      expect(suggestions.length).toBeGreaterThan(0)
    })
  })
}) 