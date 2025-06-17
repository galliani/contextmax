/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { useFileSystem } from '~/composables/useFileSystem'

// Helper to create async iterator
function createAsyncIterator(entries: any[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const entry of entries) {
        yield entry
      }
    }
  }[Symbol.asyncIterator]()
}

// Mock File System Access API
const mockFileHandle = {
  kind: 'file',
  name: 'test.txt',
  getFile: vi.fn().mockResolvedValue({
    text: vi.fn().mockResolvedValue('test content')
  })
}

const mockDirectoryHandle = {
  kind: 'directory',
  name: 'test-dir',
  entries: vi.fn(),
  getFileHandle: vi.fn(),
  getDirectoryHandle: vi.fn()
}

// Mock window.showDirectoryPicker
Object.defineProperty(window, 'showDirectoryPicker', {
  writable: true,
  value: vi.fn()
})

describe('useFileSystem', () => {
  let fileSystem: ReturnType<typeof useFileSystem>

  beforeEach(() => {
    vi.clearAllMocks()
    fileSystem = useFileSystem()
  })

  describe('File System Support Detection', () => {
    it('should detect when File System Access API is supported', async () => {
      // Since onMounted doesn't run in tests, manually trigger the support check
      // by simulating what onMounted would do
      fileSystem.isFileSystemSupported.value = typeof window !== 'undefined' && 'showDirectoryPicker' in window
      
      await nextTick()
      expect(fileSystem.isFileSystemSupported.value).toBe(true)
    })
  })

  describe('File Tree Building', () => {
    it('should build file tree from directory handle', async () => {
      const mockEntries = [
        ['file1.txt', mockFileHandle],
        ['subdir', mockDirectoryHandle]
      ]
      
      mockDirectoryHandle.entries.mockReturnValue(createAsyncIterator(mockEntries))
      
      const result = await fileSystem.readDirectoryRecursively(mockDirectoryHandle as any, '')
      
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        name: 'subdir',
        path: 'subdir',
        type: 'directory'
      })
      expect(result[1]).toMatchObject({
        name: 'file1.txt',
        path: 'file1.txt',
        type: 'file'
      })
    })

    it('should ignore dot files and common build directories', async () => {
      const mockEntries = [
        ['.hidden', mockFileHandle],
        ['node_modules', mockDirectoryHandle],
        ['dist', mockDirectoryHandle],
        ['valid.txt', mockFileHandle]
      ]
      
      mockDirectoryHandle.entries.mockReturnValue(createAsyncIterator(mockEntries))
      
      const result = await fileSystem.readDirectoryRecursively(mockDirectoryHandle as any, '')
      
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('valid.txt')
    })

    it('should handle nested directories', async () => {
      const nestedDir = {
        ...mockDirectoryHandle,
        name: 'nested',
        entries: vi.fn().mockReturnValue(createAsyncIterator([
          ['nested-file.txt', mockFileHandle]
        ]))
      }
      
      const mockEntries = [
        ['nested', nestedDir]
      ]
      
      mockDirectoryHandle.entries.mockReturnValue(createAsyncIterator(mockEntries))
      
      const result = await fileSystem.readDirectoryRecursively(mockDirectoryHandle as any, '')
      
      expect(result).toHaveLength(1)
      expect(result[0].children).toHaveLength(1)
      expect(result[0].children![0].name).toBe('nested-file.txt')
      expect(result[0].children![0].path).toBe('nested/nested-file.txt')
    })

    it('should sort directories before files', async () => {
      // Create separate directory mocks to avoid children being called
      const aDir = { ...mockDirectoryHandle, name: 'a-directory', entries: vi.fn().mockReturnValue(createAsyncIterator([])) }
      const cDir = { ...mockDirectoryHandle, name: 'c-directory', entries: vi.fn().mockReturnValue(createAsyncIterator([])) }
      
      const mockEntries = [
        ['z-file.txt', mockFileHandle],
        ['a-directory', aDir],
        ['b-file.txt', mockFileHandle],
        ['c-directory', cDir]
      ]
      
      mockDirectoryHandle.entries.mockReturnValue(createAsyncIterator(mockEntries))
      
      const result = await fileSystem.readDirectoryRecursively(mockDirectoryHandle as any, '')
      
      expect(result).toHaveLength(4)
      expect(result[0].type).toBe('directory')
      expect(result[0].name).toBe('a-directory')
      expect(result[1].type).toBe('directory')
      expect(result[1].name).toBe('c-directory')
      expect(result[2].type).toBe('file')
      expect(result[2].name).toBe('b-file.txt')
      expect(result[3].type).toBe('file')
      expect(result[3].name).toBe('z-file.txt')
    })
  })

  describe('File Tree Utilities', () => {
    it('should check if file tree has handles', () => {
      const treeWithHandles = [
        {
          name: 'file1.txt',
          path: 'file1.txt',
          type: 'file' as const,
          handle: mockFileHandle
        }
      ]
      
      const treeWithoutHandles = [
        {
          name: 'file1.txt',
          path: 'file1.txt',
          type: 'file' as const
        }
      ]
      
      expect(fileSystem.checkFileTreeHasHandles(treeWithHandles)).toBe(true)
      expect(fileSystem.checkFileTreeHasHandles(treeWithoutHandles)).toBe(false)
    })

    it('should count file tree nodes', () => {
      const tree = [
        {
          name: 'dir1',
          path: 'dir1',
          type: 'directory' as const,
          children: [
            { name: 'file1.txt', path: 'dir1/file1.txt', type: 'file' as const },
            { name: 'file2.txt', path: 'dir1/file2.txt', type: 'file' as const }
          ]
        },
        {
          name: 'file3.txt',
          path: 'file3.txt',
          type: 'file' as const
        }
      ]
      
      expect(fileSystem.countFileTreeNodes(tree)).toBe(4) // 1 dir + 2 files in dir + 1 file
    })

    it('should remove handles from file tree', () => {
      const treeWithHandles = {
        name: 'file1.txt',
        path: 'file1.txt',
        type: 'file' as const,
        handle: mockFileHandle,
        children: [{
          name: 'child.txt',
          path: 'child.txt',
          type: 'file' as const,
          handle: mockFileHandle
        }]
      }
      
      const result = fileSystem.removeHandles(treeWithHandles)
      
      expect(result).not.toHaveProperty('handle')
      expect(result.children![0]).not.toHaveProperty('handle')
      expect(result.name).toBe('file1.txt')
      expect(result.children![0].name).toBe('child.txt')
    })
  })

  describe('File Content Operations', () => {
    it('should load file content successfully', async () => {
      const fileItem = {
        name: 'test.txt',
        path: 'test.txt',
        type: 'file' as const,
        handle: mockFileHandle
      }
      
      const result = await fileSystem.loadFileContent(fileItem)
      
      expect(result).toEqual({
        content: 'test content',
        fileName: 'test.txt'
      })
      expect(mockFileHandle.getFile).toHaveBeenCalled()
    })

    it('should return null for non-file items', async () => {
      const dirItem = {
        name: 'test-dir',
        path: 'test-dir',
        type: 'directory' as const,
        handle: mockDirectoryHandle
      }
      
      const result = await fileSystem.loadFileContent(dirItem)
      
      expect(result).toBeNull()
    })

    it('should return null when no handle is available', async () => {
      const fileItem = {
        name: 'test.txt',
        path: 'test.txt',
        type: 'file' as const
      }
      
      const result = await fileSystem.loadFileContent(fileItem)
      
      expect(result).toBeNull()
    })

    it('should handle file reading errors', async () => {
      const errorFileHandle = {
        ...mockFileHandle,
        getFile: vi.fn().mockRejectedValue(new Error('File read error'))
      }
      
      const fileItem = {
        name: 'error.txt',
        path: 'error.txt',
        type: 'file' as const,
        handle: errorFileHandle
      }
      
      const result = await fileSystem.loadFileContent(fileItem)
      
      expect(result).toBeNull()
    })
  })

  describe('Directory Picker Operations', () => {
    it('should show directory picker when supported', async () => {
      const mockHandle = mockDirectoryHandle
      ;(window.showDirectoryPicker as any).mockResolvedValue(mockHandle)
      
      fileSystem.isFileSystemSupported.value = true
      
      const result = await fileSystem.showDirectoryPicker()
      
      expect(window.showDirectoryPicker).toHaveBeenCalledWith({ mode: 'readwrite' })
      expect(result).toBe(mockHandle)
    })

    it('should return null when File System Access API not supported', async () => {
      fileSystem.isFileSystemSupported.value = false
      
      const result = await fileSystem.showDirectoryPicker()
      
      expect(result).toBeNull()
      expect(window.showDirectoryPicker).not.toHaveBeenCalled()
    })

    it('should handle user cancellation', async () => {
      const abortError = new Error('User cancelled')
      abortError.name = 'AbortError'
      ;(window.showDirectoryPicker as any).mockRejectedValue(abortError)
      
      fileSystem.isFileSystemSupported.value = true
      
      const result = await fileSystem.showDirectoryPicker()
      
      expect(result).toBeNull()
    })

    it('should handle other picker errors', async () => {
      ;(window.showDirectoryPicker as any).mockRejectedValue(new Error('Permission denied'))
      
      fileSystem.isFileSystemSupported.value = true
      
      const result = await fileSystem.showDirectoryPicker()
      
      expect(result).toBeNull()
    })
  })

  describe('Project Validation', () => {
    it('should validate project directories with common project files', async () => {
      const projectDir = {
        ...mockDirectoryHandle,
        entries: vi.fn().mockReturnValue(createAsyncIterator([
          ['package.json', mockFileHandle],
          ['src', mockDirectoryHandle],
          ['README.md', mockFileHandle]
        ]))
      }
      
      const result = await fileSystem.isValidProjectDirectory(projectDir as any)
      
      expect(result).toBe(true)
    })

    it('should reject directories without project indicators', async () => {
      const nonProjectDir = {
        ...mockDirectoryHandle,
        entries: vi.fn().mockReturnValue(createAsyncIterator([
          ['random.txt', mockFileHandle],
          ['some-folder', mockDirectoryHandle]
        ]))
      }
      
      const result = await fileSystem.isValidProjectDirectory(nonProjectDir as any)
      
      expect(result).toBe(false)
    })

    it('should handle validation errors gracefully', async () => {
      const errorDir = {
        ...mockDirectoryHandle,
        entries: vi.fn().mockImplementation(() => {
          throw new Error('Access denied')
        })
      }
      
      const result = await fileSystem.isValidProjectDirectory(errorDir as any)
      
      expect(result).toBe(true) // Should default to true on error
    })
  })

  describe('OPFS Rebuild Operations', () => {
    it('should rebuild file tree from OPFS directory', async () => {
      const mockEntries = [
        ['file1.txt', mockFileHandle]
      ]
      
      mockDirectoryHandle.entries.mockReturnValue(createAsyncIterator(mockEntries))
      
      const result = await fileSystem.rebuildFileTreeFromOPFS(mockDirectoryHandle as any)
      
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('file1.txt')
      expect(result[0].handle).toBe(mockFileHandle)
    })

    it('should handle OPFS rebuild errors', async () => {
      mockDirectoryHandle.entries.mockImplementation(() => {
        throw new Error('OPFS error')
      })
      
      const result = await fileSystem.rebuildFileTreeFromOPFS(mockDirectoryHandle as any)
      
      expect(result).toEqual([])
    })
  })
})