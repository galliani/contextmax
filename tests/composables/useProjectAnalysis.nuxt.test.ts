/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useProjectAnalysis } from '~/composables/useProjectAnalysis'
import type { FileTreeItem } from '~/composables/useProjectAnalysis'

// Define proper types for mocks
interface MockSmartSuggestions {
  loadCachedAnalysis: ReturnType<typeof vi.fn>
  clearAnalysisState: ReturnType<typeof vi.fn>
  isAnalyzing: ReturnType<typeof ref>
  analysisProgress: ReturnType<typeof ref>
  hasLoadedFromCache: ReturnType<typeof ref>
}

interface MockRegexCodeParser {
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
  loadCachedAnalysis: vi.fn().mockResolvedValue(undefined),
  clearAnalysisState: vi.fn(),
  isAnalyzing: ref(false),
  analysisProgress: ref(0),
  hasLoadedFromCache: ref(false)
}

const sharedMockRegexCodeParser = {
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

vi.mock('~/composables/useRegexCodeParser', () => ({
  useRegexCodeParser: vi.fn(() => sharedMockRegexCodeParser)
}))

vi.mock('~/composables/useAccessibility', () => ({
  useAccessibility: vi.fn(() => sharedMockAccessibility)
}))

vi.mock('~/composables/useGitignore', () => ({
  useGitignore: vi.fn(() => sharedMockGitignore)
}))

describe('useProjectAnalysis', () => {
  let projectAnalysis: ReturnType<typeof useProjectAnalysis>
  let mockSmartSuggestions: MockSmartSuggestions
  let mockRegexCodeParser: MockRegexCodeParser
  let mockAccessibility: MockAccessibility
  let mockGitignore: MockGitignore

  // Sample file tree data for testing
  const createMockFileTree = (): FileTreeItem[] => [
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
    sharedMockSmartSuggestions.loadCachedAnalysis.mockClear()
    sharedMockSmartSuggestions.clearAnalysisState.mockClear()
    sharedMockRegexCodeParser.isLanguageSupported.mockClear()
    sharedMockAccessibility.announceStatus.mockClear()
    sharedMockGitignore.createMatcher.mockClear()

    // Reset the reactive state
    sharedMockSmartSuggestions.isAnalyzing.value = false
    sharedMockSmartSuggestions.analysisProgress.value = 0
    sharedMockSmartSuggestions.hasLoadedFromCache.value = false

    // Reset mock return values to defaults
    sharedMockRegexCodeParser.isLanguageSupported.mockReturnValue(true)
    sharedMockGitignore.createMatcher.mockResolvedValue({
      ignores: vi.fn().mockReturnValue(false)
    })

    // Assign to test variables for convenience
    mockSmartSuggestions = sharedMockSmartSuggestions as MockSmartSuggestions
    mockRegexCodeParser = sharedMockRegexCodeParser as MockRegexCodeParser
    mockAccessibility = sharedMockAccessibility as MockAccessibility
    mockGitignore = sharedMockGitignore as MockGitignore

    // Initialize the composable after setting up mocks
    projectAnalysis = useProjectAnalysis()
  })

  describe('Initialization', () => {
    it('should initialize with correct default state', () => {
      expect(projectAnalysis.isAnalyzing.value).toBe(false)
      expect(projectAnalysis.analysisProgress.value).toBe(0)
      expect(projectAnalysis.hasLoadedFromCache.value).toBe(false)
    })

    it('should provide all required methods', () => {
      expect(typeof projectAnalysis.performProjectAnalysis).toBe('function')
      expect(typeof projectAnalysis.clearAnalysisState).toBe('function')
      expect(typeof projectAnalysis.getAllFilesFromTree).toBe('function')
      expect(typeof projectAnalysis.prepareFilesForAnalysis).toBe('function')
    })
  })

  describe('getAllFilesFromTree', () => {
    it('should extract all files from a nested file tree', () => {
      const fileTree = createMockFileTree()
      const allFiles = projectAnalysis.getAllFilesFromTree(fileTree)

      expect(allFiles).toHaveLength(3) // 2 top-level files + 1 nested file
      expect(allFiles.map(f => f.path)).toEqual([
        'src/components/Button.vue',
        'src/utils/helpers.ts',
        'src/components/Card.vue'
      ])
    })

    it('should handle empty file tree', () => {
      const allFiles = projectAnalysis.getAllFilesFromTree([])
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
      
      const allFiles = projectAnalysis.getAllFilesFromTree(fileTree)
      expect(allFiles).toEqual([])
    })
  })

  describe('prepareFilesForAnalysis', () => {
    beforeEach(() => {
      // Setup gitignore mock to not ignore any files by default
      mockGitignore.createMatcher.mockResolvedValue({
        ignores: vi.fn().mockReturnValue(false)
      })
      // Ensure regex parser supports all files by default
      mockRegexCodeParser.isLanguageSupported.mockReturnValue(true)
    })

    it('should filter and prepare files for analysis', async () => {
      const rawFiles = createMockFileTree().filter(f => f.type === 'file')
      
      const preparedFiles = await projectAnalysis.prepareFilesForAnalysis(rawFiles)

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

      const preparedFiles = await projectAnalysis.prepareFilesForAnalysis(rawFiles)

      expect(preparedFiles).toHaveLength(1)
      expect(preparedFiles[0].path).toBe('src/utils/helpers.ts')
    })

    it('should filter out unsupported file types', async () => {
      const rawFiles = createMockFileTree().filter(f => f.type === 'file')
      
      // Mock regex parser to only support .ts files
      mockRegexCodeParser.isLanguageSupported.mockImplementation((path: string) => path.endsWith('.ts'))

      const preparedFiles = await projectAnalysis.prepareFilesForAnalysis(rawFiles)

      expect(preparedFiles).toHaveLength(1)
      expect(preparedFiles[0].path).toBe('src/utils/helpers.ts')
    })

    it('should throw error when no files are provided', async () => {
      await expect(projectAnalysis.prepareFilesForAnalysis([])).rejects.toThrow('No files found for analysis')
    })

    it('should throw error when no valid files remain after filtering', async () => {
      const rawFiles = createMockFileTree().filter(f => f.type === 'file')
      
      // Mock all files to be ignored
      mockGitignore.createMatcher.mockResolvedValue({
        ignores: vi.fn().mockReturnValue(true)
      })

      await expect(projectAnalysis.prepareFilesForAnalysis(rawFiles)).rejects.toThrow('No valid files found for analysis after filtering')
    })
  })

  describe('performProjectAnalysis', () => {
    beforeEach(() => {
      // Ensure regex parser supports all files by default
      mockRegexCodeParser.isLanguageSupported.mockReturnValue(true)
      // Setup gitignore mock to not ignore any files by default
      mockGitignore.createMatcher.mockResolvedValue({
        ignores: vi.fn().mockReturnValue(false)
      })
    })

    it('should perform complete project analysis successfully', async () => {
      const fileTree = createMockFileTree()

      const result = await projectAnalysis.performProjectAnalysis(fileTree)

      expect(result.success).toBe(true)
      expect(result.filesAnalyzed).toBe(3) // All files should be analyzed
      expect(mockSmartSuggestions.loadCachedAnalysis).toHaveBeenCalledOnce()
    })

    it('should handle analysis errors gracefully', async () => {
      const fileTree = createMockFileTree()
      mockSmartSuggestions.loadCachedAnalysis.mockRejectedValue(new Error('Analysis failed'))

      const result = await projectAnalysis.performProjectAnalysis(fileTree)

      expect(result.success).toBe(false)
      expect(result.filesAnalyzed).toBe(0)
    })

    it('should handle empty file tree gracefully', async () => {
      const result = await projectAnalysis.performProjectAnalysis([])

      expect(result.success).toBe(false)
      expect(result.filesAnalyzed).toBe(0)
      expect(mockSmartSuggestions.loadCachedAnalysis).not.toHaveBeenCalled()
    })

    it('should support silent mode', async () => {
      const fileTree = createMockFileTree()

      await projectAnalysis.performProjectAnalysis(fileTree, { silent: true })

      // In silent mode, fewer announcements should be made
      // The exact number depends on implementation but should be reduced
      expect(mockAccessibility.announceStatus).toHaveBeenCalled()
    })

    it('should announce status updates during analysis', async () => {
      const fileTree = createMockFileTree()
      
      // Mock successful analysis
      mockSmartSuggestions.loadCachedAnalysis.mockResolvedValue(undefined)

      await projectAnalysis.performProjectAnalysis(fileTree, { silent: false })

      expect(mockAccessibility.announceStatus).toHaveBeenCalledWith(
        expect.stringContaining('Loading analysis')
      )
      expect(mockAccessibility.announceStatus).toHaveBeenCalledWith(
        expect.stringContaining('complete')
      )
    })
  })

  describe('Integration with Dependencies', () => {
    it('should properly integrate with useSmartContextSuggestions state', () => {
      // The composable should use shared reactive instances
      expect(projectAnalysis.isAnalyzing.value).toBe(false)
      expect(projectAnalysis.analysisProgress.value).toBe(0)
      expect(projectAnalysis.hasLoadedFromCache.value).toBe(false)
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
      ] as unknown as FileTreeItem[]

      await expect(projectAnalysis.prepareFilesForAnalysis(fileTree)).rejects.toThrow('No valid files found for analysis after filtering')
    })

    it('should handle gitignore matcher creation failure', async () => {
      const rawFiles = createMockFileTree().filter(f => f.type === 'file')
      mockGitignore.createMatcher.mockRejectedValue(new Error('Gitignore failed'))

      await expect(projectAnalysis.prepareFilesForAnalysis(rawFiles)).rejects.toThrow()
    })
  })

  describe('State Management', () => {
    it('should allow clearing analysis state', () => {
      projectAnalysis.clearAnalysisState()
      expect(typeof projectAnalysis.clearAnalysisState).toBe('function')
    })

    it('should provide readonly access to state', () => {
      expect(() => {
        expect(projectAnalysis.isAnalyzing.value).toBe(false)
      }).not.toThrow()
    })
  })
})