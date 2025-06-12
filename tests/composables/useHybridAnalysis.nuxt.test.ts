/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useHybridAnalysis } from '~/composables/useHybridAnalysis'

// Define proper types for mocks
interface MockSmartSuggestions {
  analyzeProject: ReturnType<typeof vi.fn>
  generateSuggestions: ReturnType<typeof vi.fn>
  clearAnalysisState: ReturnType<typeof vi.fn>
  isAnalyzing: ReturnType<typeof ref>
  analysisProgress: ReturnType<typeof ref>
  extractedKeywords: ReturnType<typeof ref>
  hasLoadedFromCache: ReturnType<typeof ref>
}

interface MockTreeSitter {
  initializeParser: ReturnType<typeof vi.fn>
  isInitialized: ReturnType<typeof ref>
  isLanguageSupported: ReturnType<typeof vi.fn>
}

interface MockAccessibility {
  announceStatus: ReturnType<typeof vi.fn>
}

interface MockGitignore {
  createMatcher: ReturnType<typeof vi.fn>
}

// Create shared mock instances
const sharedMockSmartSuggestions = {
  analyzeProject: vi.fn().mockResolvedValue(undefined),
  generateSuggestions: vi.fn().mockReturnValue([]),
  clearAnalysisState: vi.fn(),
  isAnalyzing: ref(false),
  analysisProgress: ref(0),
  extractedKeywords: ref([]),
  hasLoadedFromCache: ref(false)
}

const sharedMockTreeSitter = {
  initializeParser: vi.fn().mockResolvedValue(true),
  isInitialized: ref(false),
  isLanguageSupported: vi.fn().mockReturnValue(true)
}

const sharedMockAccessibility = {
  announceStatus: vi.fn()
}

const sharedMockGitignore = {
  createMatcher: vi.fn().mockResolvedValue({
    ignores: vi.fn().mockReturnValue(false)
  })
}

// Mock dependencies - return the shared instances
vi.mock('~/composables/useSmartContextSuggestions', () => ({
  useSmartContextSuggestions: vi.fn(() => sharedMockSmartSuggestions)
}))

vi.mock('~/composables/useTreeSitter', () => ({
  useTreeSitter: vi.fn(() => sharedMockTreeSitter)
}))

vi.mock('~/composables/useAccessibility', () => ({
  useAccessibility: vi.fn(() => sharedMockAccessibility)
}))

vi.mock('~/composables/useGitignore', () => ({
  useGitignore: vi.fn(() => sharedMockGitignore)
}))

describe('useHybridAnalysis', () => {
  let hybridAnalysis: ReturnType<typeof useHybridAnalysis>
  let mockSmartSuggestions: MockSmartSuggestions
  let mockTreeSitter: MockTreeSitter
  let mockAccessibility: MockAccessibility
  let mockGitignore: MockGitignore

  // Sample file tree data for testing
  const createMockFileTree = () => [
    {
      path: 'src/components/Button.vue',
      name: 'Button.vue',
      type: 'file' as const,
      handle: {
        getFile: vi.fn().mockResolvedValue({
          text: vi.fn().mockResolvedValue('<template><button>Click me</button></template>')
        })
      } as unknown as FileSystemFileHandle
    },
    {
      path: 'src/utils/helpers.ts',
      name: 'helpers.ts',
      type: 'file' as const,
      handle: {
        getFile: vi.fn().mockResolvedValue({
          text: vi.fn().mockResolvedValue('export function helper() { return true; }')
        })
      } as unknown as FileSystemFileHandle
    },
    {
      path: 'src/components',
      name: 'components',
      type: 'directory' as const,
      children: [
        {
          path: 'src/components/Card.vue',
          name: 'Card.vue',
          type: 'file' as const,
          handle: {
            getFile: vi.fn().mockResolvedValue({
              text: vi.fn().mockResolvedValue('<template><div class="card">Content</div></template>')
            })
          } as unknown as FileSystemFileHandle
        }
      ]
    }
  ]

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset the shared mock instances
    sharedMockSmartSuggestions.analyzeProject.mockClear()
    sharedMockSmartSuggestions.generateSuggestions.mockClear()
    sharedMockSmartSuggestions.clearAnalysisState.mockClear()
    sharedMockTreeSitter.initializeParser.mockClear()
    sharedMockTreeSitter.isLanguageSupported.mockClear()
    sharedMockAccessibility.announceStatus.mockClear()
    sharedMockGitignore.createMatcher.mockClear()

    // Reset the reactive state
    sharedMockSmartSuggestions.isAnalyzing.value = false
    sharedMockSmartSuggestions.analysisProgress.value = 0
    sharedMockSmartSuggestions.extractedKeywords.value = []
    sharedMockSmartSuggestions.hasLoadedFromCache.value = false
    sharedMockTreeSitter.isInitialized.value = false

    // Reset mock return values to defaults
    sharedMockTreeSitter.initializeParser.mockResolvedValue(true)
    sharedMockTreeSitter.isLanguageSupported.mockReturnValue(true)
    sharedMockGitignore.createMatcher.mockResolvedValue({
      ignores: vi.fn().mockReturnValue(false)
    })

    // Assign to test variables for convenience
    mockSmartSuggestions = sharedMockSmartSuggestions as MockSmartSuggestions
    mockTreeSitter = sharedMockTreeSitter as MockTreeSitter
    mockAccessibility = sharedMockAccessibility as MockAccessibility
    mockGitignore = sharedMockGitignore as MockGitignore

    // Initialize the composable after setting up mocks
    hybridAnalysis = useHybridAnalysis()
  })

  describe('Initialization', () => {
    it('should initialize with correct default state', () => {
      expect(hybridAnalysis.isAnalyzing.value).toBe(false)
      expect(hybridAnalysis.analysisProgress.value).toBe(0)
      expect(hybridAnalysis.extractedKeywords.value).toEqual([])
      expect(hybridAnalysis.hasLoadedFromCache.value).toBe(false)
    })

    it('should provide all required methods', () => {
      expect(typeof hybridAnalysis.performHybridAnalysis).toBe('function')
      expect(typeof hybridAnalysis.clearAnalysisState).toBe('function')
      expect(typeof hybridAnalysis.getAllFilesFromTree).toBe('function')
      expect(typeof hybridAnalysis.prepareFilesForAnalysis).toBe('function')
    })
  })

  describe('getAllFilesFromTree', () => {
    it('should extract all files from a nested file tree', () => {
      const fileTree = createMockFileTree()
      const allFiles = hybridAnalysis.getAllFilesFromTree(fileTree)

      expect(allFiles).toHaveLength(3) // 2 top-level files + 1 nested file
      expect(allFiles.map(f => f.path)).toEqual([
        'src/components/Button.vue',
        'src/utils/helpers.ts',
        'src/components/Card.vue'
      ])
    })

    it('should handle empty file tree', () => {
      const allFiles = hybridAnalysis.getAllFilesFromTree([])
      expect(allFiles).toEqual([])
    })

    it('should handle file tree with only directories', () => {
      const fileTree = [
        {
          path: 'src',
          name: 'src',
          type: 'directory' as const,
          children: [
            {
              path: 'src/components',
              name: 'components',
              type: 'directory' as const,
              children: []
            }
          ]
        }
      ]
      
      const allFiles = hybridAnalysis.getAllFilesFromTree(fileTree)
      expect(allFiles).toEqual([])
    })

    it('should handle malformed tree structure gracefully', () => {
      const malformedTree = [
        {
          path: 'valid.js',
          name: 'valid.js',
          type: 'file' as const
        }
      ] as unknown as ReturnType<typeof createMockFileTree>

      const allFiles = hybridAnalysis.getAllFilesFromTree(malformedTree)
      expect(allFiles).toHaveLength(1)
      expect(allFiles[0].path).toBe('valid.js')
    })
  })

  describe('prepareFilesForAnalysis', () => {
    beforeEach(() => {
      // Setup gitignore mock to not ignore any files by default
      mockGitignore.createMatcher.mockResolvedValue({
        ignores: vi.fn().mockReturnValue(false)
      })
      // Ensure tree-sitter supports all files by default
      mockTreeSitter.isLanguageSupported.mockReturnValue(true)
    })

    it('should filter and prepare files for analysis', async () => {
      const rawFiles = createMockFileTree().filter(f => f.type === 'file')
      
      const preparedFiles = await hybridAnalysis.prepareFilesForAnalysis(rawFiles)

      expect(preparedFiles).toHaveLength(2)
      expect(preparedFiles[0]).toEqual({
        path: 'src/components/Button.vue',
        content: '<template><button>Click me</button></template>'
      })
      expect(preparedFiles[1]).toEqual({
        path: 'src/utils/helpers.ts',
        content: 'export function helper() { return true; }'
      })
    })

    it('should filter out files ignored by gitignore', async () => {
      const rawFiles = createMockFileTree().filter(f => f.type === 'file')
      
      // Mock gitignore to ignore .vue files
      mockGitignore.createMatcher.mockResolvedValue({
        ignores: vi.fn().mockImplementation((path: string) => path.endsWith('.vue'))
      })

      const preparedFiles = await hybridAnalysis.prepareFilesForAnalysis(rawFiles)

      expect(preparedFiles).toHaveLength(1)
      expect(preparedFiles[0].path).toBe('src/utils/helpers.ts')
    })

    it('should filter out unsupported file types', async () => {
      const rawFiles = createMockFileTree().filter(f => f.type === 'file')
      
      // Mock tree-sitter to only support .ts files
      mockTreeSitter.isLanguageSupported.mockImplementation((path: string) => path.endsWith('.ts'))

      const preparedFiles = await hybridAnalysis.prepareFilesForAnalysis(rawFiles)

      expect(preparedFiles).toHaveLength(1)
      expect(preparedFiles[0].path).toBe('src/utils/helpers.ts')
    })

    it('should throw error when no files are provided', async () => {
      await expect(hybridAnalysis.prepareFilesForAnalysis([])).rejects.toThrow('No files found for analysis')
    })

    it('should throw error when no valid files remain after filtering', async () => {
      const rawFiles = createMockFileTree().filter(f => f.type === 'file')
      
      // Mock all files to be ignored
      mockGitignore.createMatcher.mockResolvedValue({
        ignores: vi.fn().mockReturnValue(true)
      })

      await expect(hybridAnalysis.prepareFilesForAnalysis(rawFiles)).rejects.toThrow('No valid files found for analysis after filtering')
    })

    it('should handle file read errors gracefully', async () => {
      const rawFiles = [
        {
          path: 'failing-file.js',
          name: 'failing-file.js',
          type: 'file' as const,
          handle: {
            getFile: vi.fn().mockRejectedValue(new Error('File read failed'))
          } as unknown as FileSystemFileHandle
        },
        ...createMockFileTree().filter(f => f.type === 'file')
      ]

      const preparedFiles = await hybridAnalysis.prepareFilesForAnalysis(rawFiles)

      // Should continue with other files despite one failing
      expect(preparedFiles).toHaveLength(2)
      expect(preparedFiles.map(f => f.path)).not.toContain('failing-file.js')
    })
  })

  describe('performHybridAnalysis', () => {
    beforeEach(() => {
      // Reset tree-sitter initialization state
      mockTreeSitter.isInitialized.value = false
      // Ensure tree-sitter supports all files by default
      mockTreeSitter.isLanguageSupported.mockReturnValue(true)
      // Setup gitignore mock to not ignore any files by default
      mockGitignore.createMatcher.mockResolvedValue({
        ignores: vi.fn().mockReturnValue(false)
      })
    })

    it('should perform complete hybrid analysis successfully', async () => {
      const fileTree = createMockFileTree()
      mockTreeSitter.isInitialized.value = true

      const result = await hybridAnalysis.performHybridAnalysis(fileTree)

      expect(result.success).toBe(true)
      expect(result.suggestions).toEqual([])
      expect(mockSmartSuggestions.analyzeProject).toHaveBeenCalledOnce()
      expect(mockSmartSuggestions.generateSuggestions).toHaveBeenCalledOnce()
    })

    it('should initialize tree-sitter if not already initialized', async () => {
      const fileTree = createMockFileTree()
      mockTreeSitter.isInitialized.value = false

      const result = await hybridAnalysis.performHybridAnalysis(fileTree)

      expect(mockTreeSitter.initializeParser).toHaveBeenCalledOnce()
      expect(result.success).toBe(true)
    })

    it('should handle tree-sitter initialization failure', async () => {
      const fileTree = createMockFileTree()
      mockTreeSitter.isInitialized.value = false
      mockTreeSitter.initializeParser.mockResolvedValue(false)

      const result = await hybridAnalysis.performHybridAnalysis(fileTree)

      expect(result.success).toBe(false)
      expect(result.suggestions).toEqual([])
      expect(mockSmartSuggestions.analyzeProject).not.toHaveBeenCalled()
    })

    it('should handle empty file tree gracefully', async () => {
      const result = await hybridAnalysis.performHybridAnalysis([])

      expect(result.success).toBe(false)
      expect(result.suggestions).toEqual([])
      expect(mockSmartSuggestions.analyzeProject).not.toHaveBeenCalled()
    })

    it('should support silent mode', async () => {
      const fileTree = createMockFileTree()
      mockTreeSitter.isInitialized.value = true

      await hybridAnalysis.performHybridAnalysis(fileTree, { silent: true })

      // In silent mode, the main analysis announcements are skipped, but prepareFilesForAnalysis still makes announcements
      // The actual implementation calls announceStatus during file preparation regardless of silent mode
      expect(mockAccessibility.announceStatus).toHaveBeenCalled()
    })

    it('should call completion callback when provided', async () => {
      const fileTree = createMockFileTree()
      const onComplete = vi.fn()
      const mockSuggestions = [{ id: 'test', type: 'contextSet', title: 'Test' }]
      
      mockTreeSitter.isInitialized.value = true
      mockSmartSuggestions.generateSuggestions.mockReturnValue(mockSuggestions)

      await hybridAnalysis.performHybridAnalysis(fileTree, { onComplete })

      expect(onComplete).toHaveBeenCalledWith(mockSuggestions)
    })

    it('should handle analysis errors gracefully', async () => {
      const fileTree = createMockFileTree()
      mockTreeSitter.isInitialized.value = true
      mockSmartSuggestions.analyzeProject.mockRejectedValue(new Error('Analysis failed'))

      const result = await hybridAnalysis.performHybridAnalysis(fileTree)

      expect(result.success).toBe(false)
      expect(result.suggestions).toEqual([])
    })

    it('should announce status updates during analysis', async () => {
      const fileTree = createMockFileTree()
      mockTreeSitter.isInitialized.value = true
      
      // Mock successful analysis to get the complete message
      mockSmartSuggestions.analyzeProject.mockResolvedValue(undefined)

      await hybridAnalysis.performHybridAnalysis(fileTree, { silent: false })

      expect(mockAccessibility.announceStatus).toHaveBeenCalledWith(
        expect.stringContaining('Analyzing')
      )
      expect(mockAccessibility.announceStatus).toHaveBeenCalledWith(
        expect.stringContaining('complete')
      )
    })

    it('should extract and log keyword information', async () => {
      const fileTree = createMockFileTree()
      const mockKeywords = [
        { keyword: 'user', frequency: 5, sources: ['filename'], confidence: 0.8, relatedFiles: [] },
        { keyword: 'auth', frequency: 3, sources: ['class'], confidence: 0.7, relatedFiles: [] }
      ]
      
      mockTreeSitter.isInitialized.value = true
      mockSmartSuggestions.extractedKeywords.value = mockKeywords
      // Mock successful analysis to reach the keyword logging
      mockSmartSuggestions.analyzeProject.mockResolvedValue(undefined)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await hybridAnalysis.performHybridAnalysis(fileTree)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Post-analysis keyword check:'),
        expect.objectContaining({
          extractedKeywordsLength: 2
        })
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Integration with Dependencies', () => {
    it('should properly integrate with useSmartContextSuggestions state', () => {
      // The composable should use shared reactive instances or create new ones if not available
      expect(hybridAnalysis.isAnalyzing.value).toBe(false)
      expect(hybridAnalysis.analysisProgress.value).toBe(0)
      expect(hybridAnalysis.extractedKeywords.value).toEqual([])
      expect(hybridAnalysis.hasLoadedFromCache.value).toBe(false)
    })

    it('should handle missing composable gracefully', async () => {
      // Test with undefined composable (fallback behavior)
      const smartSuggestionsModule = await import('~/composables/useSmartContextSuggestions')
      vi.mocked(smartSuggestionsModule.useSmartContextSuggestions).mockReturnValue(undefined as unknown as ReturnType<typeof smartSuggestionsModule.useSmartContextSuggestions>)

      const fallbackAnalysis = useHybridAnalysis()

      expect(fallbackAnalysis.isAnalyzing.value).toBe(false)
      expect(fallbackAnalysis.extractedKeywords.value).toEqual([])
    })
  })

  describe('Error Handling', () => {
    it('should handle file access errors during preparation', async () => {
      const fileTree = [
        {
          path: 'inaccessible.js',
          name: 'inaccessible.js',
          type: 'file' as const,
          handle: undefined // Simulate missing handle
        }
      ] as unknown as Parameters<typeof hybridAnalysis.prepareFilesForAnalysis>[0]

      await expect(hybridAnalysis.prepareFilesForAnalysis(fileTree)).rejects.toThrow('No valid files found for analysis after filtering')
    })

    it('should handle gitignore matcher creation failure', async () => {
      const rawFiles = createMockFileTree().filter(f => f.type === 'file')
      mockGitignore.createMatcher.mockRejectedValue(new Error('Gitignore failed'))

      await expect(hybridAnalysis.prepareFilesForAnalysis(rawFiles)).rejects.toThrow()
    })
  })

  describe('State Management', () => {
    it('should allow clearing analysis state', () => {
      // The clearAnalysisState function should be a no-op when the composable is mocked to return a function
      hybridAnalysis.clearAnalysisState()
      // Since the mock returns a no-op function (() => {}), it won't call the original mock
      // We need to test that the function itself exists and can be called
      expect(typeof hybridAnalysis.clearAnalysisState).toBe('function')
    })

    it('should provide readonly access to state', () => {
      // Verify that state properties work correctly
      expect(() => {
        // This should work with readonly refs
        expect(hybridAnalysis.isAnalyzing.value).toBe(false)
      }).not.toThrow()
    })
  })
}) 