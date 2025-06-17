/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useOPFSManager } from '~/composables/useOPFSManager'

// Mock OPFS API
const mockWritable = {
  write: vi.fn(),
  close: vi.fn()
}

const mockFileHandle = {
  createWritable: vi.fn().mockResolvedValue(mockWritable),
  getFile: vi.fn().mockResolvedValue({
    text: vi.fn().mockResolvedValue('{"schemaVersion":"1.0","filesManifest":{},"contextSets":{},"fileContextsIndex":{}}')
  })
}

const mockContextMaxDir = {
  getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
  removeEntry: vi.fn()
}

const mockProjectDir = {
  getDirectoryHandle: vi.fn().mockResolvedValue(mockContextMaxDir),
  removeEntry: vi.fn()
}

const mockProjectsDir = {
  getDirectoryHandle: vi.fn().mockResolvedValue(mockProjectDir),
  removeEntry: vi.fn(),
  entries: vi.fn().mockReturnValue({
    async *[Symbol.asyncIterator]() {
      yield ['project1', mockProjectDir]
      yield ['project2', mockProjectDir]
    }
  })
}

const mockOPFSRoot = {
  getDirectoryHandle: vi.fn().mockResolvedValue(mockProjectsDir)
}

// Mock navigator.storage
Object.defineProperty(navigator, 'storage', {
  writable: true,
  value: {
    getDirectory: vi.fn().mockResolvedValue(mockOPFSRoot)
  }
})

describe('useOPFSManager', () => {
  let opfsManager: ReturnType<typeof useOPFSManager>
  
  const mockContextSetsData = {
    schemaVersion: '1.0',
    filesManifest: {
      'file_123': {
        path: 'test.js',
        comment: 'Test file'
      }
    },
    contextSets: {
      'test-set': {
        description: 'Test context set',
        files: ['file_123'],
        workflow: []
      }
    },
    fileContextsIndex: {
      'file_123': [{ setName: 'test-set' }]
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    opfsManager = useOPFSManager()
  })

  describe('OPFS Support Detection', () => {
    it('should detect OPFS support when available', () => {
      expect(opfsManager.isOPFSAvailable()).toBe(true)
    })

    it.skip('should detect when OPFS is not supported (skipped: property redefinition limitation)', () => {
      const originalStorage = global.navigator.storage
      
      // Mock storage as undefined
      Object.defineProperty(global.navigator, 'storage', {
        value: undefined,
        writable: true,
        configurable: true
      })
      
      expect(opfsManager.isOPFSAvailable()).toBe(false)
      
      // Restore original storage
      Object.defineProperty(global.navigator, 'storage', {
        value: originalStorage,
        writable: true,
        configurable: true
      })
    })
  })

  describe('Context Sets Management', () => {
    it('should save context sets to OPFS working copy', async () => {
      const projectName = 'test-project'
      
      const result = await opfsManager.saveContextSets(projectName, mockContextSetsData)
      
      expect(result).toBe(true)
      expect(mockProjectsDir.getDirectoryHandle).toHaveBeenCalledWith(projectName, { create: true })
      expect(mockProjectDir.getDirectoryHandle).toHaveBeenCalledWith('.contextmax', { create: true })
      expect(mockContextMaxDir.getFileHandle).toHaveBeenCalledWith('context-sets.json', { create: true })
      expect(mockWritable.write).toHaveBeenCalledWith(JSON.stringify(mockContextSetsData, null, 2))
    })

    it('should load context sets from OPFS working copy', async () => {
      const projectName = 'test-project'
      
      const result = await opfsManager.loadContextSets(projectName)
      
      expect(result).toEqual({
        schemaVersion: '1.0',
        filesManifest: {},
        contextSets: {},
        fileContextsIndex: {}
      })
      expect(mockProjectsDir.getDirectoryHandle).toHaveBeenCalledWith(projectName)
    })

    it('should return null when no working copy exists', async () => {
      mockProjectsDir.getDirectoryHandle.mockRejectedValueOnce(new Error('Not found'))
      
      const result = await opfsManager.loadContextSets('nonexistent-project')
      
      expect(result).toBeNull()
    })

    it('should check if project has context sets', async () => {
      const projectName = 'test-project'
      
      const result = await opfsManager.hasContextSets(projectName)
      
      expect(result).toBe(true)
      expect(mockProjectsDir.getDirectoryHandle).toHaveBeenCalledWith(projectName)
    })

    it('should return false when project has no context sets', async () => {
      mockContextMaxDir.getFileHandle.mockRejectedValueOnce(new Error('Not found'))
      
      const result = await opfsManager.hasContextSets('empty-project')
      
      expect(result).toBe(false)
    })

    it('should delete context sets from project', async () => {
      const projectName = 'test-project'
      
      // Initialize OPFS first
      await opfsManager.initializeOPFS()
      
      const result = await opfsManager.deleteContextSets(projectName)
      
      expect(result).toBe(true)
      expect(mockContextMaxDir.removeEntry).toHaveBeenCalledWith('context-sets.json')
      expect(mockContextMaxDir.removeEntry).toHaveBeenCalledWith('metadata.json')
    })

    it('should get context sets metadata', async () => {
      const metadataContent = {
        lastSaved: Date.now(),
        version: '1.0',
        isWorkingCopy: true
      }
      
      mockFileHandle.getFile.mockResolvedValueOnce({
        text: vi.fn().mockResolvedValue(JSON.stringify(metadataContent))
      })
      
      const result = await opfsManager.getContextSetsMetadata('test-project')
      
      expect(result).toEqual(metadataContent)
    })
  })

  describe('Project File Management', () => {
    const mockSourceHandle = {
      name: 'test-project',
      entries: vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield ['file1.txt', { kind: 'file', getFile: vi.fn().mockResolvedValue(new Blob(['content'])) }]
          yield ['src', { 
            kind: 'directory',
            entries: vi.fn().mockReturnValue({
              async *[Symbol.asyncIterator]() {
                yield ['nested.js', { kind: 'file', getFile: vi.fn().mockResolvedValue(new Blob(['js content'])) }]
              }
            })
          }]
        }
      })
    }

    const mockTargetHandle = {
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue(mockWritable)
      }),
      getDirectoryHandle: vi.fn().mockReturnValue({
        getFileHandle: vi.fn().mockResolvedValue({
          createWritable: vi.fn().mockResolvedValue(mockWritable)
        })
      })
    }

    beforeEach(() => {
      mockProjectsDir.getDirectoryHandle.mockResolvedValue(mockTargetHandle)
    })

    it('should copy project to OPFS with progress tracking', async () => {
      const onProgress = vi.fn()
      
      const result = await opfsManager.copyProjectToOPFS(
        mockSourceHandle as any,
        'test-project',
        onProgress
      )
      
      expect(result).toBe('test-project')
      expect(onProgress).toHaveBeenCalled()
      expect(mockProjectsDir.getDirectoryHandle).toHaveBeenCalledWith('test-project', { create: true })
    })

    it('should handle copy errors gracefully', async () => {
      mockProjectsDir.getDirectoryHandle.mockRejectedValueOnce(new Error('OPFS error'))
      
      const result = await opfsManager.copyProjectToOPFS(
        mockSourceHandle as any,
        'test-project'
      )
      
      expect(result).toBeNull()
    })

    it('should get project from OPFS', async () => {
      const projectName = 'test-project'
      
      const result = await opfsManager.getProjectFromOPFS(projectName)
      
      expect(result).toBe(mockTargetHandle)
      expect(mockProjectsDir.getDirectoryHandle).toHaveBeenCalledWith(projectName)
    })

    it('should return null when project not found in OPFS', async () => {
      mockProjectsDir.getDirectoryHandle.mockRejectedValueOnce(new Error('Not found'))
      
      const result = await opfsManager.getProjectFromOPFS('nonexistent')
      
      expect(result).toBeNull()
    })

    it('should delete project from OPFS', async () => {
      const projectName = 'test-project'
      
      // Initialize OPFS first
      await opfsManager.initializeOPFS()
      
      const result = await opfsManager.deleteProjectFromOPFS(projectName)
      
      expect(result).toBe(true)
      expect(mockProjectsDir.removeEntry).toHaveBeenCalledWith(projectName, { recursive: true })
    })

    it('should handle delete errors', async () => {
      mockProjectsDir.removeEntry.mockRejectedValueOnce(new Error('Delete failed'))
      
      const result = await opfsManager.deleteProjectFromOPFS('test-project')
      
      expect(result).toBe(false)
    })

    it('should list OPFS projects', async () => {
      const result = await opfsManager.listOPFSProjects()
      
      expect(result).toEqual(['project1', 'project2'])
      expect(mockProjectsDir.entries).toHaveBeenCalled()
    })

    it('should handle listing errors', async () => {
      mockProjectsDir.entries.mockImplementationOnce(() => {
        throw new Error('Listing failed')
      })
      
      const result = await opfsManager.listOPFSProjects()
      
      expect(result).toEqual([])
    })
  })

  describe('Initialization', () => {
    it('should initialize OPFS successfully', async () => {
      const result = await opfsManager.initializeOPFS()
      
      expect(result).toBe(true)
      expect(navigator.storage.getDirectory).toHaveBeenCalled()
      expect(mockOPFSRoot.getDirectoryHandle).toHaveBeenCalledWith('contextmax-projects', { create: true })
    })

    it('should handle initialization failure', async () => {
      navigator.storage.getDirectory = vi.fn().mockRejectedValue(new Error('OPFS not available'))
      
      const result = await opfsManager.initializeOPFS()
      
      expect(result).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle save errors gracefully', async () => {
      mockWritable.write.mockRejectedValueOnce(new Error('Write failed'))
      
      const result = await opfsManager.saveContextSets('test-project', mockContextSetsData)
      
      expect(result).toBe(false)
    })

    it('should handle metadata save errors', async () => {
      mockContextMaxDir.getFileHandle
        .mockResolvedValueOnce(mockFileHandle) // context-sets.json succeeds
        .mockRejectedValueOnce(new Error('Metadata failed')) // metadata.json fails
      
      const result = await opfsManager.saveContextSets('test-project', mockContextSetsData)
      
      expect(result).toBe(false)
    })

    it('should handle load parsing errors', async () => {
      mockFileHandle.getFile.mockResolvedValueOnce({
        text: vi.fn().mockResolvedValue('invalid json')
      })
      
      const result = await opfsManager.loadContextSets('test-project')
      
      expect(result).toBeNull()
    })
  })
})