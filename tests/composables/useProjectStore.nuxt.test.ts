// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProjectStore } from '~/composables/useProjectStore'

describe('useProjectStore', () => {
  let store: ReturnType<typeof useProjectStore>

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
    
    // Clear localStorage
    localStorage.clear()
    
    // Get fresh store instance
    store = useProjectStore()
    
    // Clear any existing project data
    store.clearProject()
  })

  describe('View Management', () => {
    it('should initialize with landing view', () => {
      expect(store.currentView.value).toBe('landing')
    })

    it('should switch to workspace view', () => {
      store.goToWorkspace()
      expect(store.currentView.value).toBe('workspace')
    })

    it('should switch to landing view', () => {
      store.goToWorkspace()
      store.goToLanding()
      expect(store.currentView.value).toBe('landing')
    })

    it('should set current view directly', () => {
      store.setCurrentView('workspace')
      expect(store.currentView.value).toBe('workspace')
    })
  })

  describe('File ID Management', () => {
    it('should generate unique file IDs', () => {
      const id1 = store.generateFileId()
      const id2 = store.generateFileId()
      
      expect(id1).toMatch(/^file_[a-z0-9]{8}$/)
      expect(id2).toMatch(/^file_[a-z0-9]{8}$/)
      expect(id1).not.toBe(id2)
    })

    it('should find file ID by path', () => {
      const filePath = 'src/components/test.vue'
      const fileId = store.getOrCreateFileId(filePath)
      
      expect(store.findFileIdByPath(filePath)).toBe(fileId)
    })

    it('should create new file ID if not found', () => {
      const filePath = 'src/new-file.js'
      const fileId = store.getOrCreateFileId(filePath)
      
      expect(fileId).toMatch(/^file_[a-z0-9]{8}$/)
      expect(store.findFileIdByPath(filePath)).toBe(fileId)
    })

    it('should return existing file ID for same path', () => {
      const filePath = 'src/existing-file.ts'
      const fileId1 = store.getOrCreateFileId(filePath)
      const fileId2 = store.getOrCreateFileId(filePath)
      
      expect(fileId1).toBe(fileId2)
    })
  })

  describe('Context Set Management', () => {
    it('should create a new context set', () => {
      const setName = 'test-set'
      const description = 'Test context set'
      
      store.createContextSet(setName, description)
      
      expect(store.contextSets.value[setName]).toEqual({
        description,
        files: [],
        workflow: []
      })
    })

    it('should not create duplicate context sets', () => {
      const setName = 'duplicate-set'
      
      store.createContextSet(setName, 'First description')
      store.createContextSet(setName, 'Second description')
      
      expect(store.contextSets.value[setName].description).toBe('First description')
    })

    it('should set active context set', () => {
      const setName = 'active-set'
      store.createContextSet(setName)
      
      store.setActiveContextSet(setName)
      
      expect(store.activeContextSetName.value).toBe(setName)
    })

    it('should update active context set', () => {
      const setName = 'update-set'
      store.createContextSet(setName, 'Original description')
      store.setActiveContextSet(setName)
      
      const updates = {
        description: 'Updated description',
        workflow: [{ fileRefs: ['file1'], description: 'Step 1' }]
      }
      
      store.updateActiveContextSet(updates)
      
      expect(store.contextSets.value[setName].description).toBe('Updated description')
      expect(store.contextSets.value[setName].workflow).toEqual(updates.workflow)
    })

    it('should delete context set', () => {
      const setName = 'delete-set'
      store.createContextSet(setName)
      store.setActiveContextSet(setName)
      
      store.deleteContextSet(setName)
      
      expect(store.contextSets.value[setName]).toBeUndefined()
      expect(store.activeContextSetName.value).toBe(null)
    })
  })

  describe('File Management in Context Sets', () => {
    beforeEach(() => {
      store.createContextSet('test-set')
      store.setActiveContextSet('test-set')
    })

    it('should add file to active context set', () => {
      const file = {
        name: 'test.vue',
        path: 'src/components/test.vue',
        type: 'file' as const
      }
      
      store.addFileToActiveContextSet(file)
      
      const fileId = store.findFileIdByPath(file.path)
      expect(fileId).toBeDefined()
      expect(store.contextSets.value['test-set'].files).toContain(fileId)
    })

    it('should not add duplicate files to context set', () => {
      const file = {
        name: 'duplicate.vue',
        path: 'src/components/duplicate.vue',
        type: 'file' as const
      }
      
      store.addFileToActiveContextSet(file)
      store.addFileToActiveContextSet(file)
      
      const fileId = store.findFileIdByPath(file.path)
      const files = store.contextSets.value['test-set'].files
      expect(files.filter(f => f === fileId)).toHaveLength(1)
    })

    it('should remove file from active context set', () => {
      const file = {
        name: 'remove.vue',
        path: 'src/components/remove.vue',
        type: 'file' as const
      }
      
      store.addFileToActiveContextSet(file)
      const fileId = store.findFileIdByPath(file.path)!
      
      store.removeFileFromActiveContextSet(fileId)
      
      expect(store.contextSets.value['test-set'].files).not.toContain(fileId)
    })
  })

  describe('File Reference Checking', () => {
    beforeEach(() => {
      store.createContextSet('ref-set')
      store.setActiveContextSet('ref-set')
    })

    it('should detect if file is referenced by any context set', () => {
      const file = {
        name: 'referenced.vue',
        path: 'src/components/referenced.vue',
        type: 'file' as const
      }
      
      store.addFileToActiveContextSet(file)
      const fileId = store.findFileIdByPath(file.path)!
      
      expect(store.isFileReferencedByAnyContextSet(fileId)).toBe(true)
    })

    it('should return false for unreferenced files', () => {
      const fileId = store.generateFileId()
      expect(store.isFileReferencedByAnyContextSet(fileId)).toBe(false)
    })
  })

  describe('Loading States', () => {
    it('should manage loading files state', () => {
      expect(store.isLoadingFiles.value).toBe(false)
      
      store.setIsLoadingFiles(true)
      expect(store.isLoadingFiles.value).toBe(true)
      
      store.setIsLoadingFiles(false)
      expect(store.isLoadingFiles.value).toBe(false)
    })
  })

  describe('Local Storage Integration', () => {
    it('should clear localStorage', () => {
      // Set some data first
      localStorage.setItem('contextmax-project-state', JSON.stringify({ test: 'data' }))
      
      store.clearLocalStorage()
      
      expect(localStorage.getItem('contextmax-project-state')).toBeNull()
    })
  })

  describe('Context Sets JSON Generation', () => {
    it('should generate valid ContextSetsData JSON', () => {
      // Set up test data
      store.createContextSet('test-export', 'Export test')
      const file = {
        name: 'export-test.vue',
        path: 'src/components/export-test.vue',
        type: 'file' as const
      }
      store.setActiveContextSet('test-export')
      store.addFileToActiveContextSet(file)
      
      const json = store.generateContextSetsJSON()
      
      expect(json.schemaVersion).toBe('1.0')
      expect(json.contextSets['test-export']).toBeDefined()
      expect(json.filesManifest).toBeDefined()
      expect(json.fileContextsIndex).toBeDefined()
    })

    it('should generate file contexts index', () => {
      store.createContextSet('index-test', 'Index test')
      const file = {
        name: 'index-test.vue',
        path: 'src/components/index-test.vue',
        type: 'file' as const
      }
      store.setActiveContextSet('index-test')
      store.addFileToActiveContextSet(file)
      
      const index = store.generateFileContextsIndex()
      const fileId = store.findFileIdByPath(file.path)!
      
      expect(index[fileId]).toBeDefined()
      expect(index[fileId]).toContainEqual({
        setName: 'index-test',
        lineRanges: undefined
      })
    })
  })

  describe('File Content Modal', () => {
    it('should close file content modal', () => {
      // Use internal state manipulation for testing since the exposed refs are readonly
      // In real usage, loadFileContent would set these values
      globalThis.localStorage.setItem('contextmax-project-state', JSON.stringify({
        selectedFolderName: null,
        fileTree: [],
        filesManifest: {},
        contextSets: {},
        activeContextSetName: null,
        timestamp: Date.now(),
        hasOPFSCopy: false,
        opfsProjectPath: null
      }))
      
      store.closeFileContentModal()
      
      expect(store.isFileContentModalOpen.value).toBe(false)
    })
  })

  describe('Single Initialization Behavior', () => {
    it('should prevent duplicate localStorage reads with multiple computed property accesses', () => {
      // Create spy to track localStorage.getItem calls
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
      getItemSpy.mockClear()
      
      // Create store instance
      const store1 = useProjectStore()
      
      // Access multiple computed properties repeatedly
      // This should only trigger ONE localStorage read on first access due to ensureInitialized
      const contextSets1 = store1.contextSets.value
      const contextSets2 = store1.contextSets.value
      const filesManifest1 = store1.filesManifest.value
      const filesManifest2 = store1.filesManifest.value
      const activeContextSet1 = store1.activeContextSet.value
      const activeContextSet2 = store1.activeContextSet.value
      
      // Verify the values are consistent (should be empty in test environment)
      expect(contextSets1).toBe(contextSets2)
      expect(filesManifest1).toBe(filesManifest2)
      expect(activeContextSet1).toBe(activeContextSet2)
      
      // localStorage.getItem should only have been called a maximum of once for our storage key
      const relevantCalls = getItemSpy.mock.calls.filter(call => call[0] === 'contextmax-project-state')
      expect(relevantCalls.length).toBeLessThanOrEqual(1)
      
      // Clean up spy
      getItemSpy.mockRestore()
    })
    
    it('should share global state across multiple store instances', () => {
      // Create multiple store instances
      const store1 = useProjectStore()
      const store2 = useProjectStore()
      const store3 = useProjectStore()
      
      // All instances should reference the same global state objects
      expect(store1.contextSets.value).toBe(store2.contextSets.value)
      expect(store2.contextSets.value).toBe(store3.contextSets.value)
      expect(store1.filesManifest.value).toBe(store2.filesManifest.value)
      expect(store2.filesManifest.value).toBe(store3.filesManifest.value)
      
      // When one store modifies state, others should see the change immediately
      store1.createContextSet('new-set-from-store1', 'Created by store1')
      
      // All other stores should immediately see the new context set
      expect(Object.keys(store2.contextSets.value)).toContain('new-set-from-store1')
      expect(Object.keys(store3.contextSets.value)).toContain('new-set-from-store1')
      expect(store2.contextSets.value['new-set-from-store1']).toBeDefined()
      expect(store3.contextSets.value['new-set-from-store1']).toBeDefined()
    })
    
    it('should only initialize once even with rapid successive calls', async () => {
      // Create multiple stores quickly in succession (simulating rapid component mounting)
      const stores = Array.from({ length: 5 }, () => useProjectStore())
      
      // Create spy after store creation to avoid counting their initialization
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
      getItemSpy.mockClear()
      
      // Access computed properties from all stores simultaneously
      const promises = stores.map(async (store, index) => {
        // Simulate async component mounting with different timing
        await new Promise(resolve => setTimeout(resolve, index * 10))
        return {
          contextSets: store.contextSets.value,
          filesManifest: store.filesManifest.value,
          activeContextSet: store.activeContextSet.value
        }
      })
      
      await Promise.all(promises)
      
      // localStorage should not be accessed during these rapid accesses since initialization already happened
      const relevantCalls = getItemSpy.mock.calls.filter(call => call[0] === 'contextmax-project-state')
      expect(relevantCalls).toHaveLength(0) // No additional calls should have been made
      
      // Clean up spy
      getItemSpy.mockRestore()
    })
  })

  describe('OPFS Support', () => {
    it('should detect OPFS availability', () => {
      // Since we're in a test environment, OPFS might not be available
      const isAvailable = store.isOPFSAvailable()
      expect(typeof isAvailable).toBe('boolean')
    })
  })

  describe('Project Clearing', () => {
    it('should clear all project data', () => {
      // Set up some data
      store.createContextSet('clear-test')
      store.setActiveContextSet('clear-test')
      // Use proper typing instead of any
      const mockHandle = { name: 'test' } as FileSystemDirectoryHandle
      store.setSelectedFolder(mockHandle)
      store.setFileTree([{ name: 'test', path: 'test', type: 'file' }])
      
      store.clearProject()
      
      expect(Object.keys(store.contextSets.value)).toHaveLength(0)
      expect(store.activeContextSetName.value).toBe(null)
      expect(store.selectedFolder.value).toBe(null)
      expect(store.fileTree.value).toEqual([])
      expect(Object.keys(store.filesManifest.value)).toHaveLength(0)
    })
  })

  describe('Orphaned Files Cleanup', () => {
    beforeEach(() => {
      store.createContextSet('test-set')
      store.setActiveContextSet('test-set')
    })

    it('should identify files referenced by context sets', () => {
      const file = {
        name: 'referenced.vue',
        path: 'src/components/referenced.vue',
        type: 'file' as const
      }
      
      store.addFileToActiveContextSet(file)
      const fileId = store.findFileIdByPath(file.path)
      
      expect(fileId).not.toBeNull()
      expect(store.isFileReferencedByAnyContextSet(fileId!)).toBe(true)
    })

    it('should identify orphaned files not referenced by any context set', () => {
      // Create a file directly in manifest without adding to context set
      const fileId = store.generateFileId()
      store.addFileToManifestForTesting(fileId, {
        path: 'src/orphaned/file.vue',
        comment: 'This file is orphaned'
      })
      
      expect(store.isFileReferencedByAnyContextSet(fileId)).toBe(false)
    })

    it('should clean up orphaned files from manifest', () => {
      // Add a file to context set (should be kept)
      const keptFile = {
        name: 'kept.vue',
        path: 'src/components/kept.vue',
        type: 'file' as const
      }
      store.addFileToActiveContextSet(keptFile)
      const keptFileId = store.findFileIdByPath(keptFile.path)!
      
      // Create orphaned files directly in manifest
      const orphanedId1 = store.generateFileId()
      const orphanedId2 = store.generateFileId()
      
      // Add orphaned files to manifest using helper function
      store.addFileToManifestForTesting(orphanedId1, {
        path: 'src/orphaned1.vue',
        comment: 'Orphaned file 1'
      })
      store.addFileToManifestForTesting(orphanedId2, {
        path: 'src/orphaned2.vue', 
        comment: 'Orphaned file 2'
      })
      
      // Verify setup
      expect(Object.keys(store.filesManifest.value)).toHaveLength(3)
      expect(store.isFileReferencedByAnyContextSet(keptFileId)).toBe(true)
      expect(store.isFileReferencedByAnyContextSet(orphanedId1)).toBe(false)
      expect(store.isFileReferencedByAnyContextSet(orphanedId2)).toBe(false)
      
      // Perform cleanup
      const cleanedCount = store.cleanupOrphanedFiles()
      
      // Verify results
      expect(cleanedCount).toBe(2)
      expect(Object.keys(store.filesManifest.value)).toHaveLength(1)
      expect(store.filesManifest.value[keptFileId]).toBeDefined()
      expect(store.filesManifest.value[orphanedId1]).toBeUndefined()
      expect(store.filesManifest.value[orphanedId2]).toBeUndefined()
    })

    it('should return zero when no orphaned files exist', () => {
      // Add a file to context set
      const file = {
        name: 'active.vue',
        path: 'src/components/active.vue',
        type: 'file' as const
      }
      store.addFileToActiveContextSet(file)
      
      // All files should be referenced
      const cleanedCount = store.cleanupOrphanedFiles()
      
      expect(cleanedCount).toBe(0)
      expect(Object.keys(store.filesManifest.value)).toHaveLength(1)
    })

    it('should handle cleanup with multiple context sets', () => {
      // Create second context set
      store.createContextSet('second-set')
      
      // Add file to first context set
      const file1 = {
        name: 'first.vue',
        path: 'src/components/first.vue',
        type: 'file' as const
      }
      store.addFileToActiveContextSet(file1)
      
      // Add file to second context set
      store.setActiveContextSet('second-set')
      const file2 = {
        name: 'second.vue',
        path: 'src/components/second.vue',
        type: 'file' as const
      }
      store.addFileToActiveContextSet(file2)
      
      // Add orphaned file
      const orphanedId = store.generateFileId()
      store.addFileToManifestForTesting(orphanedId, {
        path: 'src/orphaned.vue',
        comment: 'Orphaned file'
      })
      
      // Verify both files are referenced
      const file1Id = store.findFileIdByPath(file1.path)!
      const file2Id = store.findFileIdByPath(file2.path)!
      
      expect(store.isFileReferencedByAnyContextSet(file1Id)).toBe(true)
      expect(store.isFileReferencedByAnyContextSet(file2Id)).toBe(true)
      expect(store.isFileReferencedByAnyContextSet(orphanedId)).toBe(false)
      
      // Cleanup should only remove orphaned file
      const cleanedCount = store.cleanupOrphanedFiles()
      
      expect(cleanedCount).toBe(1)
      expect(Object.keys(store.filesManifest.value)).toHaveLength(2)
      expect(store.filesManifest.value[file1Id]).toBeDefined()
      expect(store.filesManifest.value[file2Id]).toBeDefined()
      expect(store.filesManifest.value[orphanedId]).toBeUndefined()
    })

    it('should handle cleanup when context set is deleted', () => {
      // Add files to context set
      const file1 = {
        name: 'test1.vue',
        path: 'src/components/test1.vue',
        type: 'file' as const
      }
      const file2 = {
        name: 'test2.vue',
        path: 'src/components/test2.vue',
        type: 'file' as const
      }
      
      store.addFileToActiveContextSet(file1)
      store.addFileToActiveContextSet(file2)
      
      // Verify files exist in manifest
      expect(Object.keys(store.filesManifest.value)).toHaveLength(2)
      const file1Id = store.findFileIdByPath(file1.path)
      const file2Id = store.findFileIdByPath(file2.path)
      
      expect(file1Id).not.toBeNull()
      expect(file2Id).not.toBeNull()
      expect(store.isFileReferencedByAnyContextSet(file1Id!)).toBe(true)
      expect(store.isFileReferencedByAnyContextSet(file2Id!)).toBe(true)
      
      // Delete the context set (should trigger automatic cleanup)
      store.deleteContextSet('test-set')
      
      // Files should be cleaned up automatically
      expect(store.isFileReferencedByAnyContextSet(file1Id!)).toBe(false)
      expect(store.isFileReferencedByAnyContextSet(file2Id!)).toBe(false)
      expect(Object.keys(store.filesManifest.value)).toHaveLength(0)
    })
  })

  describe('Project Switching and Clean Slate', () => {
    it('should clear existing context sets when switching to project without context-sets.json', async () => {
      // Set up initial project state with context sets
      store.createContextSet('old-project-set', 'From old project')
      store.setActiveContextSet('old-project-set')
      
      const file = {
        name: 'old-file.vue',
        path: 'src/components/old-file.vue',
        type: 'file' as const
      }
      store.addFileToActiveContextSet(file)
      
      // Verify initial state
      expect(Object.keys(store.contextSets.value)).toHaveLength(1)
      expect(store.activeContextSetName.value).toBe('old-project-set')
      expect(Object.keys(store.filesManifest.value)).toHaveLength(1)
      
      // Mock a new directory handle (simulating switching to new project)
      const mockNewProjectHandle = {
        name: 'new-project',
        getFileHandle: vi.fn().mockRejectedValue(new Error('File not found'))
      } as unknown as FileSystemDirectoryHandle
      
      // Simulate loading new project that has no context-sets.json
      const result = await store.autoLoadContextSetsFromProject(mockNewProjectHandle)
      
      // Should return false since no context-sets.json exists
      expect(result).toBe(false)
      
      // Should have clean slate - no context sets or files from previous project
      expect(Object.keys(store.contextSets.value)).toHaveLength(0)
      expect(store.activeContextSetName.value).toBe(null)
      expect(Object.keys(store.filesManifest.value)).toHaveLength(0)
    })
    
    it('should load context sets when switching to project with context-sets.json', async () => {
      // Set up initial project state with context sets  
      store.createContextSet('old-project-set', 'From old project')
      store.setActiveContextSet('old-project-set')
      
      // Verify initial state
      expect(Object.keys(store.contextSets.value)).toHaveLength(1)
      expect(store.activeContextSetName.value).toBe('old-project-set')
      
      // Mock context sets data for new project
      const newProjectData = {
        schemaVersion: '1.0',
        filesManifest: {
          'file_abc123': { path: 'src/new-file.vue', comment: 'New project file' }
        },
        contextSets: {
          'new-project-set': {
            description: 'From new project',
            files: ['file_abc123'],
            workflow: []
          }
        },
        fileContextsIndex: {
          'file_abc123': [{ setName: 'new-project-set' }]
        }
      }
      
      // Mock file content for context-sets.json
      const mockFile = {
        text: vi.fn().mockResolvedValue(JSON.stringify(newProjectData))
      }
      
      // Mock file handle for context-sets.json
      const mockFileHandle = {
        getFile: vi.fn().mockResolvedValue(mockFile)
      }
      
      // Mock new directory handle with context-sets.json
      const mockNewProjectHandle = {
        name: 'new-project-with-contexts',
        getFileHandle: vi.fn().mockResolvedValue(mockFileHandle)
      } as unknown as FileSystemDirectoryHandle
      
      // Simulate loading new project that has context-sets.json
      const result = await store.autoLoadContextSetsFromProject(mockNewProjectHandle)
      
      // Should return true since context-sets.json was loaded
      expect(result).toBe(true)
      
      // Should have replaced old context sets with new ones
      expect(Object.keys(store.contextSets.value)).toHaveLength(1)
      expect(store.contextSets.value['new-project-set']).toBeDefined()
      expect(store.contextSets.value['old-project-set']).toBeUndefined()
      expect(store.activeContextSetName.value).toBe('new-project-set')
      expect(Object.keys(store.filesManifest.value)).toHaveLength(1)
      expect(store.filesManifest.value['file_abc123']).toBeDefined()
    })
  })
}) 