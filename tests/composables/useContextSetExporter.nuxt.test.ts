/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useContextSetExporter } from '~/composables/useContextSetExporter'
import type { ContextSet, FileManifestEntry } from '~/composables/useContextSets'

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
  encode: vi.fn().mockReturnValue([1, 2, 3, 4, 5]) // Mock 5 tokens
}))

describe('useContextSetExporter', () => {
  let exporter: ReturnType<typeof useContextSetExporter>
  
  const mockContextSet: ContextSet = {
    description: 'Test context set',
    files: ['file_1'],
    workflow: [{
      fileRefs: ['file_1'],
      description: 'Test workflow step'
    }],
    entryPoints: [{
      fileRef: 'file_1',
      function: 'main',
      protocol: 'http',
      method: 'GET',
      identifier: '/api/test'
    }],
    systemBehavior: {
      processing: {
        mode: 'synchronous'
      }
    }
  }
  
  const mockFilesManifest: Record<string, FileManifestEntry> = {
    'file_1': {
      path: 'src/test.js',
      comment: 'Test file'
    }
  }
  
  const mockFileTree = [
    {
      name: 'test.js',
      path: 'src/test.js',
      type: 'file',
      handle: mockFileHandle
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    exporter = useContextSetExporter()
  })

  describe('Token Count', () => {
    it('should initialize with zero token count', () => {
      expect(exporter.tokenCount.value).toBe(0)
    })

    it('should calculate estimated token count', async () => {
      const tokens = await exporter.calculateTokenCount(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )
      
      expect(tokens).toBeGreaterThan(0)
    })
  })

  describe('Export Functionality', () => {
    it('should export context set to clipboard successfully', async () => {
      const result = await exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )

      expect(result.success).toBe(true)
      expect(result.tokenCount).toBe(5) // From mocked encode function
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })

    it('should generate valid XML structure', async () => {
      await exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )

      const [xmlContent] = (navigator.clipboard.writeText as any).mock.calls[0]
      
      // Check XML structure
      expect(xmlContent).toContain('<contextSet name="test-set">')
      expect(xmlContent).toContain('<description><![CDATA[Test context set]]></description>')
      expect(xmlContent).toContain('<files>')
      expect(xmlContent).toContain('<file path="src/test.js">')
      expect(xmlContent).toContain('<content><![CDATA[console.log("Hello World");]]></content>')
      expect(xmlContent).toContain('<workflow>')
      expect(xmlContent).toContain('<entryPoints>')
      expect(xmlContent).toContain('<systemBehavior>')
      expect(xmlContent).toContain('</contextSet>')
    })

    it('should handle file reading errors gracefully', async () => {
      const errorFileHandle = {
        getFile: vi.fn().mockRejectedValue(new Error('File read error'))
      }
      
      const errorFileTree = [
        {
          name: 'test.js',
          path: 'src/test.js', // Should match the mockFilesManifest
          type: 'file',
          handle: errorFileHandle
        }
      ]

      const result = await exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        errorFileTree
      )

      expect(result.success).toBe(true) // Should still succeed but with error content
      
      const [xmlContent] = (navigator.clipboard.writeText as any).mock.calls[0]
      expect(xmlContent).toContain('<error>Failed to read file content: Failed to read file: File read error</error>')
    })

    it('should handle missing file handles', async () => {
      const incompleteFileTree = [
        {
          name: 'test.js',
          path: 'src/test.js',
          type: 'file'
          // No handle
        }
      ]

      const result = await exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        incompleteFileTree
      )

      expect(result.success).toBe(true)
      
      const [xmlContent] = (navigator.clipboard.writeText as any).mock.calls[0]
      expect(xmlContent).toContain('<error>File not accessible or missing</error>')
    })

    it('should handle FileRef objects with function references', async () => {
      const contextSetWithFunctions: ContextSet = {
        description: 'Test context set with functions',
        files: [{
          fileRef: 'file_1',
          functionRefs: [
            { name: 'testFunction', comment: 'Test function' },
            { name: 'anotherFunction' }
          ],
          comment: 'File with specific functions'
        }],
        workflow: []
      }

      const result = await exporter.exportContextSetToClipboard(
        'test-set',
        contextSetWithFunctions,
        mockFilesManifest,
        mockFileTree
      )

      expect(result.success).toBe(true)
      
      const [xmlContent] = (navigator.clipboard.writeText as any).mock.calls[0]
      expect(xmlContent).toContain('<functions>')
      expect(xmlContent).toContain('<function name="testFunction" comment="Test function" />')
      expect(xmlContent).toContain('<function name="anotherFunction" />')
      expect(xmlContent).toContain('</functions>')
    })

    it('should handle XML special characters in CDATA sections', async () => {
      const specialContextSet: ContextSet = {
        description: 'Test with <special> & "characters"',
        files: ['file_1'],
        workflow: []
      }

      const result = await exporter.exportContextSetToClipboard(
        'test-set',
        specialContextSet,
        mockFilesManifest,
        mockFileTree
      )

      expect(result.success).toBe(true)
      
      const [xmlContent] = (navigator.clipboard.writeText as any).mock.calls[0]
      // CDATA sections preserve special characters
      expect(xmlContent).toContain('<description><![CDATA[Test with <special> & "characters"]]></description>')
    })
  })

  describe('Loading States', () => {
    it('should track export loading state', async () => {
      expect(exporter.isExporting.value).toBe(false)
      
      const exportPromise = exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )
      
      expect(exporter.isExporting.value).toBe(true)
      
      await exportPromise
      
      expect(exporter.isExporting.value).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle clipboard API errors', async () => {
      (navigator.clipboard.writeText as any).mockRejectedValueOnce(new Error('Clipboard error'))

      const result = await exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        mockFilesManifest,
        mockFileTree
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Clipboard error')
    })

    it('should handle missing files manifest', async () => {
      const emptyManifest = {}

      const result = await exporter.exportContextSetToClipboard(
        'test-set',
        mockContextSet,
        emptyManifest,
        mockFileTree
      )

      expect(result.success).toBe(true) // Should still export but skip missing files
    })
  })
}) 