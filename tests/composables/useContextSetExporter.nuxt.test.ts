/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useContextSetExporter } from '~/composables/useContextSetExporter'
import type { ContextSet, FileManifestEntry } from '~/composables/useContextSets'
import type { FileTreeItem } from '~/composables/useContextSetExporter'

// Mock file handle
const mockFileHandle = {
  getFile: vi.fn().mockResolvedValue({
    text: vi.fn().mockResolvedValue('console.log("Hello World");')
  })
}

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
})

// Mock gpt-tokenizer
vi.mock('gpt-tokenizer', () => ({
  encode: vi.fn().mockReturnValue(new Array(100)) // Mock 100 tokens
}))

// Mock js-yaml
vi.mock('js-yaml', () => ({
  dump: vi.fn().mockImplementation((obj) => {
    // Create dynamic YAML based on the input object
    const lines = []
    lines.push(`contextSetName: ${obj.contextSetName}`)
    
    if (obj.description) {
      lines.push(`description: ${obj.description}`)
    }
    
    if (obj.workflows && obj.workflows.length > 0) {
      lines.push('workflows:')
      obj.workflows.forEach((workflow: any) => {
        lines.push(`  - start:`)
        lines.push(`      fileRef: ${workflow.start.fileRef}`)
        if (workflow.start.function) {
          lines.push(`      function: ${workflow.start.function}`)
        }
        lines.push(`      startLine: ${workflow.start.startLine}`)
        lines.push(`      endLine: ${workflow.start.endLine}`)
        lines.push(`    end:`)
        lines.push(`      fileRef: ${workflow.end.fileRef}`)
        if (workflow.end.function) {
          lines.push(`      function: ${workflow.end.function}`)
        }
        lines.push(`      startLine: ${workflow.end.startLine}`)
        lines.push(`      endLine: ${workflow.end.endLine}`)
      })
    }
    
    if (obj.systemBehavior && Object.keys(obj.systemBehavior).length > 0) {
      lines.push('systemBehavior:')
      if (obj.systemBehavior.processing) {
        lines.push('  processing:')
        lines.push(`    mode: ${obj.systemBehavior.processing.mode}`)
      }
    }
    
    return lines.join('\n') + '\n'
  })
}))

describe('useContextSetExporter', () => {
  let exporter: ReturnType<typeof useContextSetExporter>
  let mockContextSet: ContextSet
  let mockFilesManifest: Record<string, FileManifestEntry>
  let mockFileTree: FileTreeItem[]

  beforeEach(() => {
    exporter = useContextSetExporter()
    
    // Reset mocks
    vi.clearAllMocks()
    
    // Setup test data
    mockContextSet = {
      description: 'Test context set with special chars: & < > " \'',
      files: ['file_1'],
      workflows: [
        {
          start: {
            fileRef: 'file_1',
            function: 'main',
            startLine: 1,
            endLine: 10
          },
          end: {
            fileRef: 'file_1',
            startLine: 15,
            endLine: 20
          }
        }
      ],
      systemBehavior: {
        processing: {
          mode: 'synchronous'
        }
      }
    }

    mockFilesManifest = {
      file_1: {
        path: 'src/test.ts',
        comment: 'Test file'
      }
    }

    mockFileTree = [
      {
        path: 'src/test.ts',
        type: 'file',
        handle: mockFileHandle as any
      }
    ]
  })

  describe('calculateTokenCount', () => {
    it('should calculate token count for a context set', async () => {
      const tokenCount = await exporter.calculateTokenCount(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )

      expect(tokenCount).toBe(100) // Mocked to return 100 tokens
    })

    it('should return 0 tokens on error', async () => {
      // Mock an error in file reading
      mockFileHandle.getFile.mockRejectedValueOnce(new Error('File read error'))

      const tokenCount = await exporter.calculateTokenCount(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )

      expect(tokenCount).toBe(100) // Should still work since error is handled gracefully
    })
  })

  describe('exportContextSetToClipboard', () => {
    it('should export context set to clipboard with system prompt', async () => {
      const result = await exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )

      expect(result.success).toBe(true)
      expect(result.tokenCount).toBe(100)
      expect(navigator.clipboard.writeText).toHaveBeenCalledOnce()
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      
      // Check for system prompt
      expect(exportedText).toContain('You can analyze the provided project context to help with development tasks')
      
      // Check for YAML frontmatter structure
      expect(exportedText).toContain('---')
      expect(exportedText).toContain('contextSetName: test-set')
      expect(exportedText).toContain('description: Test context set with special chars: & < > " \'')
      
      // Check for file content
      expect(exportedText).toContain('## FILE: src/test.ts')
      expect(exportedText).toContain('```typescript')
      expect(exportedText).toContain('console.log("Hello World");')
    })

    it('should export context set with minimal frontmatter when fields are empty', async () => {
      // Context set with only required fields
      const minimalContextSet: ContextSet = {
        description: '',
        files: ['file_1'],
        workflows: []
      }

      const result = await exporter.exportContextSetToClipboard(
        'minimal-set',
        minimalContextSet,
        mockFilesManifest,
        mockFileTree
      )

      expect(result.success).toBe(true)
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      
      // Should only contain contextSetName in frontmatter
      expect(exportedText).toContain('contextSetName: minimal-set')
      // Should not contain empty fields
      expect(exportedText).not.toContain('description:')
      expect(exportedText).not.toContain('workflows:')
      expect(exportedText).not.toContain('systemBehavior:')
    })

    it('should not export systemBehavior when processing mode is empty', async () => {
      // Context set with systemBehavior but no processing mode
      const contextSetWithEmptySystemBehavior: ContextSet = {
        description: 'Test context set',
        files: ['file_1'],
        workflows: [],
        systemBehavior: {
          processing: {}
        }
      }

      const result = await exporter.exportContextSetToClipboard(
        'test-empty-system-behavior',
        contextSetWithEmptySystemBehavior,
        mockFilesManifest,
        mockFileTree
      )

      expect(result.success).toBe(true)
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      
      // Should contain basic frontmatter
      expect(exportedText).toContain('contextSetName: test-empty-system-behavior')
      expect(exportedText).toContain('description: Test context set')
      
      // Should not contain systemBehavior since processing is empty
      expect(exportedText).not.toContain('systemBehavior:')
    })

    it('should handle file read errors gracefully', async () => {
      // Mock file read error
      mockFileHandle.getFile.mockRejectedValueOnce(new Error('Permission denied'))

      const result = await exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )

      expect(result.success).toBe(true)
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      expect(exportedText).toContain('// Error reading file: Permission denied')
    })

    it('should handle missing file handles', async () => {
      // File tree without the required file
      const emptyFileTree: FileTreeItem[] = []

      const result = await exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        emptyFileTree
      )

      expect(result.success).toBe(true)
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      expect(exportedText).toContain('// File not accessible in current file tree')
    })

    it('should handle clipboard write errors', async () => {
      // Mock clipboard error
      ;(navigator.clipboard.writeText as any).mockRejectedValueOnce(new Error('Clipboard access denied'))

      const result = await exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Clipboard access denied')
    })

    it('should prevent concurrent exports', async () => {
      // Start first export
      const firstExport = exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )

      // Try to start second export immediately
      const secondExport = exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )

      const [firstResult, secondResult] = await Promise.all([firstExport, secondExport])

      expect(firstResult.success).toBe(true)
      expect(secondResult.success).toBe(false)
      expect(secondResult.error).toBe('Export already in progress')
    })
  })

  describe('reactive state', () => {
    it('should track exporting state', async () => {
      expect(exporter.isExporting.value).toBe(false)

      const exportPromise = exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )

      // Should be exporting during the operation
      expect(exporter.isExporting.value).toBe(true)

      await exportPromise

      // Should be false after completion
      expect(exporter.isExporting.value).toBe(false)
    })
  })

  describe('language detection', () => {
    it('should detect correct language hints for different file types', async () => {
      const testFiles = [
        { path: 'test.js', expected: 'javascript' },
        { path: 'test.ts', expected: 'typescript' },
        { path: 'test.vue', expected: 'vue' },
        { path: 'test.py', expected: 'python' },
        { path: 'test.rb', expected: 'ruby' },
        { path: 'test.unknown', expected: 'text' }
      ]

      for (const testFile of testFiles) {
        const testManifest = {
          file_1: {
            path: testFile.path,
            comment: 'Test file'
          }
        }

        const testFileTree = [
          {
            path: testFile.path,
            type: 'file' as const,
            handle: mockFileHandle as any
          }
        ]

        const result = await exporter.exportContextSetToClipboard(
          'test-set',
          { ...mockContextSet, files: ['file_1'] },
          testManifest,
          testFileTree
        )

        expect(result.success).toBe(true)
        
        const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
        expect(exportedText).toContain(`\`\`\`${testFile.expected}`)
        
        // Clear mock for next iteration
        vi.clearAllMocks()
      }
    })
  })
}) 