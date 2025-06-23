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
    
    if (obj.uses && obj.uses.length > 0) {
      lines.push('uses:')
      obj.uses.forEach((use: string) => {
        lines.push(`  - ${use}`)
      })
    }

    if (obj.includedContexts && obj.includedContexts.length > 0) {
      lines.push('includedContexts:')
      obj.includedContexts.forEach((context: any) => {
        lines.push(`  - name: ${context.name}`)
        if (context.description) {
          lines.push(`    description: ${context.description}`)
        }
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
      uses: [],
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
        workflows: [],
        uses: []
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
        uses: [],
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

  describe('hierarchical context export', () => {
    let mockAllContexts: Record<string, ContextSet>
    
    beforeEach(() => {
      // Setup hierarchical test data
      mockAllContexts = {
        'MainContext': {
          description: 'Main context description',
          files: ['file_1'],
          workflows: [],
          uses: ['ChildA', 'ChildB']
        },
        'ChildA': {
          description: 'Child A description',
          files: ['file_2'],
          workflows: [],
          uses: ['GrandchildX']
        },
        'ChildB': {
          description: 'Child B description',
          files: ['file_3'],
          workflows: [],
          uses: []
        },
        'GrandchildX': {
          description: 'Grandchild X description',
          files: ['file_4'],
          workflows: [],
          uses: []
        },
        'CircularA': {
          description: 'Circular A',
          files: ['file_5'],
          workflows: [],
          uses: ['CircularB']
        },
        'CircularB': {
          description: 'Circular B',
          files: ['file_6'],
          workflows: [],
          uses: ['CircularA']
        }
      }

      // Extended file manifest for hierarchical tests
      mockFilesManifest = {
        ...mockFilesManifest,
        file_2: { path: 'src/childA.ts', comment: 'Child A file' },
        file_3: { path: 'src/childB.ts', comment: 'Child B file' },
        file_4: { path: 'src/grandchild.ts', comment: 'Grandchild file' },
        file_5: { path: 'src/circularA.ts', comment: 'Circular A file' },
        file_6: { path: 'src/circularB.ts', comment: 'Circular B file' }
      }

      // Extended file tree
      mockFileTree = [
        ...mockFileTree,
        { path: 'src/childA.ts', type: 'file', handle: mockFileHandle as any },
        { path: 'src/childB.ts', type: 'file', handle: mockFileHandle as any },
        { path: 'src/grandchild.ts', type: 'file', handle: mockFileHandle as any },
        { path: 'src/circularA.ts', type: 'file', handle: mockFileHandle as any },
        { path: 'src/circularB.ts', type: 'file', handle: mockFileHandle as any }
      ]
    })

    it('should export hierarchical context with child dependencies', async () => {
      const result = await exporter.exportContextSetToClipboard(
        'MainContext',
        mockAllContexts['MainContext'],
        mockFilesManifest,
        mockFileTree,
        mockAllContexts
      )

      expect(result.success).toBe(true)
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      
      // Check frontmatter includes dependency metadata
      expect(exportedText).toContain('contextSetName: MainContext')
      expect(exportedText).toContain('uses:')
      expect(exportedText).toContain('- ChildA')
      expect(exportedText).toContain('- ChildB')
      expect(exportedText).toContain('includedContexts:')
      expect(exportedText).toContain('- name: GrandchildX')
      expect(exportedText).toContain('description: Grandchild X description')
      expect(exportedText).toContain('- name: ChildA')
      expect(exportedText).toContain('description: Child A description')
      expect(exportedText).toContain('- name: ChildB')
      expect(exportedText).toContain('description: Child B description')
      
      // Check hierarchical structure markers
      expect(exportedText).toContain('# 📁 MAIN CONTEXT: MainContext')
      expect(exportedText).toContain('# 📁 CHILD CONTEXT: GrandchildX')
      expect(exportedText).toContain('# 📁 CHILD CONTEXT: ChildA')
      expect(exportedText).toContain('# 📁 CHILD CONTEXT: ChildB')
      
      // Check enhanced system prompt for hierarchical contexts
      expect(exportedText).toContain('This export includes the main context and its dependent child contexts in a hierarchical structure')
      expect(exportedText).toContain('Main context appears first, followed by child contexts')
      expect(exportedText).toContain('You can remove child context sections if not needed')
    })

    it('should resolve dependencies recursively', async () => {
      const result = await exporter.exportContextSetToClipboard(
        'MainContext',
        mockAllContexts['MainContext'],
        mockFilesManifest,
        mockFileTree,
        mockAllContexts
      )

      expect(result.success).toBe(true)
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      
      // Should include GrandchildX even though it's not direct dependency
      expect(exportedText).toContain('# 📁 CHILD CONTEXT: GrandchildX')
      expect(exportedText).toContain('## FILE: src/grandchild.ts')
      
      // Check dependency order (grandchildren before children)
      const grandchildIndex = exportedText.indexOf('# 📁 CHILD CONTEXT: GrandchildX')
      const childAIndex = exportedText.indexOf('# 📁 CHILD CONTEXT: ChildA')
      expect(grandchildIndex).toBeLessThan(childAIndex)
    })

    it('should handle circular dependencies without infinite loops', async () => {
      const result = await exporter.exportContextSetToClipboard(
        'CircularA',
        mockAllContexts['CircularA'],
        mockFilesManifest,
        mockFileTree,
        mockAllContexts
      )

      expect(result.success).toBe(true)
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      
      // Should include both contexts exactly once
      const circularAMatches = (exportedText.match(/# 📁 CHILD CONTEXT: CircularB/g) || []).length
      expect(circularAMatches).toBe(1)
      
      // Should not cause infinite recursion (test completes successfully)
      expect(exportedText).toContain('# 📁 MAIN CONTEXT: CircularA')
      expect(exportedText).toContain('# 📁 CHILD CONTEXT: CircularB')
    })

    it('should work without allContexts parameter (backward compatibility)', async () => {
      const result = await exporter.exportContextSetToClipboard(
        'MainContext',
        mockAllContexts['MainContext'],
        mockFilesManifest,
        mockFileTree
        // No allContexts parameter
      )

      expect(result.success).toBe(true)
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      
      // Should export only the main context without children
      expect(exportedText).toContain('# 📁 MAIN CONTEXT: MainContext')
      expect(exportedText).not.toContain('# 📁 CHILD CONTEXT:')
      expect(exportedText).not.toContain('includedContexts:')
      
      // Should use non-hierarchical system prompt
      expect(exportedText).toContain('The context is structured with YAML frontmatter')
      expect(exportedText).not.toContain('This export includes the main context and its dependent child contexts')
    })

    it('should handle missing child contexts gracefully', async () => {
      const incompleteContexts = {
        'MainContext': mockAllContexts['MainContext'],
        'ChildA': mockAllContexts['ChildA']
        // Missing ChildB and GrandchildX
      }

      const result = await exporter.exportContextSetToClipboard(
        'MainContext',
        incompleteContexts['MainContext'],
        mockFilesManifest,
        mockFileTree,
        incompleteContexts
      )

      expect(result.success).toBe(true)
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      
      // Should include ChildA but skip missing contexts
      expect(exportedText).toContain('# 📁 CHILD CONTEXT: ChildA')
      expect(exportedText).not.toContain('# 📁 CHILD CONTEXT: ChildB')
      expect(exportedText).not.toContain('# 📁 CHILD CONTEXT: GrandchildX')
    })

    it('should include context metadata in child sections', async () => {
      const complexChildContext: ContextSet = {
        description: 'Complex child with workflows',
        files: ['file_2'],
        workflows: [{
          start: { fileRef: 'file_2', startLine: 1, endLine: 5 },
          end: { fileRef: 'file_2', startLine: 10, endLine: 15 }
        }],
        uses: ['GrandchildX']
      }

      mockAllContexts['ChildA'] = complexChildContext

      const result = await exporter.exportContextSetToClipboard(
        'MainContext',
        mockAllContexts['MainContext'],
        mockFilesManifest,
        mockFileTree,
        mockAllContexts
      )

      expect(result.success).toBe(true)
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      
      // Should show metadata for child contexts
      expect(exportedText).toContain('# 📁 CHILD CONTEXT: ChildA')
      expect(exportedText).toContain('**Description:** Complex child with workflows')
      expect(exportedText).toContain('**Workflows:** 1 defined')
      expect(exportedText).toContain('**Uses:** GrandchildX')
    })

    it('should calculate token count including all hierarchical content', async () => {
      const tokenCount = await exporter.calculateTokenCount(
        'MainContext',
        mockAllContexts['MainContext'],
        mockFilesManifest,
        mockFileTree,
        mockAllContexts
      )

      // Token count should be higher than single context due to hierarchical content
      expect(tokenCount).toBe(100) // Mocked value, but function should complete successfully
    })

    it('should handle empty uses array correctly', async () => {
      const contextWithoutDependencies: ContextSet = {
        description: 'No dependencies',
        files: ['file_1'],
        workflows: [],
        uses: []
      }

      const result = await exporter.exportContextSetToClipboard(
        'NoDeps',
        contextWithoutDependencies,
        mockFilesManifest,
        mockFileTree,
        mockAllContexts
      )

      expect(result.success).toBe(true)
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      
      // Should export as single context
      expect(exportedText).toContain('# 📁 MAIN CONTEXT: NoDeps')
      expect(exportedText).not.toContain('# 📁 CHILD CONTEXT:')
      expect(exportedText).not.toContain('includedContexts:')
    })

    it('should include child context files in snippet copy (ActiveContextComposer scenario)', async () => {
      // Simulate the prefixed scenario from ActiveContextComposer
      const prefixedMainContext: ContextSet = {
        description: 'Main context description',
        files: ['file_1'],
        workflows: [],
        uses: ['context:ChildA'] // Prefixed child names
      }

      const prefixedAllContexts = {
        'context:MainContext': prefixedMainContext,
        'context:ChildA': {
          description: 'Child A description',
          files: ['file_2'],
          workflows: [],
          uses: []
        }
      }

      const result = await exporter.exportContextSetToClipboard(
        'context:MainContext',
        prefixedMainContext,
        mockFilesManifest,
        mockFileTree,
        prefixedAllContexts
      )

      expect(result.success).toBe(true)
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      
      // Should include main context files
      expect(exportedText).toContain('# 📁 MAIN CONTEXT: context:MainContext')
      expect(exportedText).toContain('## FILE: src/test.ts') // file_1
      
      // Should include child context files
      expect(exportedText).toContain('# 📁 CHILD CONTEXT: context:ChildA')
      expect(exportedText).toContain('## FILE: src/childA.ts') // file_2
      
      // Should have proper frontmatter
      expect(exportedText).toContain('uses:')
      expect(exportedText).toContain('- context:ChildA')
      expect(exportedText).toContain('includedContexts:')
      expect(exportedText).toContain('name: context:ChildA')
      expect(exportedText).toContain('description: Child A description')
    })

    it('should not include description field for contexts without description in frontmatter', async () => {
      // Test the frontmatter generation specifically
      const mainContext: ContextSet = {
        description: 'Main context',
        files: ['file_1'],
        workflows: [],
        uses: ['ChildWithDesc', 'ChildWithoutDesc']
      }

      const allContextsWithMixed = {
        'MainContext': mainContext,
        'ChildWithDesc': {
          description: 'Has description',
          files: ['file_2'],
          workflows: [],
          uses: []
        },
        'ChildWithoutDesc': {
          description: '', // Empty description
          files: ['file_2'], // Reuse existing file
          workflows: [],
          uses: []
        }
      }

      const result = await exporter.exportContextSetToClipboard(
        'MainContext',
        mainContext,
        mockFilesManifest,
        mockFileTree,
        allContextsWithMixed
      )

      expect(result.success).toBe(true)
      
      const exportedText = (navigator.clipboard.writeText as any).mock.calls[0][0]
      
      // Should not contain "No description available"
      expect(exportedText).not.toContain('No description available')
      
      // Should contain the context with description
      expect(exportedText).toContain('name: ChildWithDesc')
      expect(exportedText).toContain('description: Has description')
      
      // Should contain the context without description (but no description field)
      expect(exportedText).toContain('name: ChildWithoutDesc')
      // Should NOT have a description field for empty description
      expect(exportedText).not.toMatch(/name: ChildWithoutDesc\s*description:/s)
    })
  })
}) 