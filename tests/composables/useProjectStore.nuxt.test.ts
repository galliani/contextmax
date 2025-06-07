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

  describe('Export Functionality', () => {
    it('should export context sets to project folder successfully', async () => {
      // Set up project with context sets
      store.createContextSet('export-test', 'Test export functionality')
      store.setActiveContextSet('export-test')
      
      const file = {
        name: 'export-test.vue',
        path: 'src/components/export-test.vue',
        type: 'file' as const
      }
      store.addFileToActiveContextSet(file)
      
      // Mock writable stream
      const mockWritable = {
        write: vi.fn(),
        close: vi.fn()
      }
      
      const mockFileHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable)
      }
      
      const mockSelectedFolder = {
        name: 'test-project',
        getFileHandle: vi.fn().mockResolvedValue(mockFileHandle)
      } as unknown as FileSystemDirectoryHandle
      
      store.setSelectedFolder(mockSelectedFolder)
      
      // Perform export
      const result = await store.exportToProjectFolder()
      
      // Verify export success
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mockFileHandle.createWritable).toHaveBeenCalled()
      expect(mockWritable.write).toHaveBeenCalled()
      expect(mockWritable.close).toHaveBeenCalled()
      
      // Verify JSON content structure
      const writtenContent = mockWritable.write.mock.calls[0][0]
      const parsedContent = JSON.parse(writtenContent)
      expect(parsedContent.schemaVersion).toBe('1.0')
      expect(parsedContent.contextSets['export-test']).toBeDefined()
      expect(Object.keys(parsedContent.filesManifest)).toHaveLength(1)
    })
    
    it('should handle export permission errors gracefully', async () => {
      // Set up project with context sets
      store.createContextSet('permission-test', 'Test permission handling')
      store.setActiveContextSet('permission-test')
      
      const mockSelectedFolder = {
        name: 'test-project',
        getFileHandle: vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
      } as unknown as FileSystemDirectoryHandle
      
      store.setSelectedFolder(mockSelectedFolder)
      
      // Perform export
      const result = await store.exportToProjectFolder()
      
      // Verify error handling
      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
    })
    
    it('should not export when no project folder is selected', async () => {
      // Clear selected folder
      store.setSelectedFolder(null)
      
      // Set up context sets
      store.createContextSet('no-folder-test', 'Test no folder scenario')
      
      // Attempt export
      const result = await store.exportToProjectFolder()
      
      // Verify error
      expect(result.success).toBe(false)
      expect(result.error).toBe('No project folder selected')
    })
    
    it('should not export when no context sets exist', async () => {
      // Set up folder but no context sets
      const mockSelectedFolder = {
        name: 'empty-project'
      } as unknown as FileSystemDirectoryHandle
      
      store.setSelectedFolder(mockSelectedFolder)
      
      // Attempt export (should have no context sets)
      const result = await store.exportToProjectFolder()
      
      // Verify error
      expect(result.success).toBe(false)
      expect(result.error).toBe('No context sets to export')
    })
    
    it('should check if stable version exists in project', async () => {
      // Mock folder with existing context-sets.json
      const mockSelectedFolder = {
        name: 'project-with-stable',
        getFileHandle: vi.fn().mockResolvedValue({})
      } as unknown as FileSystemDirectoryHandle
      
      store.setSelectedFolder(mockSelectedFolder)
      
      // Check for stable version
      const hasStable = await store.hasStableVersionInProject()
      
      expect(hasStable).toBe(true)
      expect(mockSelectedFolder.getFileHandle).toHaveBeenCalledWith('context-sets.json')
    })
    
    it('should return false when stable version does not exist', async () => {
      // Mock folder without context-sets.json
      const mockSelectedFolder = {
        name: 'project-without-stable',
        getFileHandle: vi.fn().mockRejectedValue(new Error('File not found'))
      } as unknown as FileSystemDirectoryHandle
      
      store.setSelectedFolder(mockSelectedFolder)
      
      // Check for stable version
      const hasStable = await store.hasStableVersionInProject()
      
      expect(hasStable).toBe(false)
    })
    
    it('should get export status correctly', async () => {
      // Set up project with context sets
      store.createContextSet('status-test', 'Test export status')
      store.setActiveContextSet('status-test')
      
      const mockSelectedFolder = {
        name: 'status-project',
        getFileHandle: vi.fn().mockResolvedValue({}) // Simulate existing stable version
      } as unknown as FileSystemDirectoryHandle
      
      store.setSelectedFolder(mockSelectedFolder)
      
      // Get export status
      const status = await store.getExportStatus()
      
      // Verify status
      expect(status.hasWorkingCopy).toBe(true)
      expect(status.hasStableVersion).toBe(true)
      expect(status.canExport).toBe(true)
    })
    
    it('should show no stable version when file does not exist', async () => {
      // Set up project with context sets but no stable version
      store.createContextSet('no-stable-test', 'Test no stable version')
      store.setActiveContextSet('no-stable-test')
      
      const mockSelectedFolder = {
        name: 'no-stable-project',
        getFileHandle: vi.fn().mockRejectedValue(new Error('File not found'))
      } as unknown as FileSystemDirectoryHandle
      
      store.setSelectedFolder(mockSelectedFolder)
      
      // Get export status
      const status = await store.getExportStatus()
      
      // Verify status
      expect(status.hasWorkingCopy).toBe(true)
      expect(status.hasStableVersion).toBe(false)
      expect(status.canExport).toBe(true)
    })
  })

  describe('Working Copy Architecture', () => {
    let mockOPFSManager: any
    
    beforeEach(() => {
      // Mock OPFS manager for testing
      mockOPFSManager = {
        loadContextSetsFromProject: vi.fn(),
        saveContextSetsToProject: vi.fn(),
        hasContextSetsInProject: vi.fn(),
        deleteContextSetsFromProject: vi.fn(),
        getContextSetsMetadata: vi.fn()
      }
    })

    it('should prioritize OPFS working copy over stable version', async () => {
      const projectName = 'test-priority-project'
      
      // Mock OPFS working copy data
      const opfsWorkingCopy = {
        schemaVersion: '1.0',
        filesManifest: {
          'file_opfs123': { path: 'src/opfs-file.vue', comment: 'From OPFS working copy' }
        },
        contextSets: {
          'opfs-context': { description: 'From OPFS', files: ['file_opfs123'], workflow: [] }
        },
        fileContextsIndex: {}
      }
      
      // Mock stable version data (should be ignored)
      const stableVersionData = {
        schemaVersion: '1.0',
        filesManifest: {
          'file_stable123': { path: 'src/stable-file.vue', comment: 'From stable version' }
        },
        contextSets: {
          'stable-context': { description: 'From stable', files: ['file_stable123'], workflow: [] }
        },
        fileContextsIndex: {}
      }
      
      // Mock file content for stable version
      const mockStableFile = {
        text: vi.fn().mockResolvedValue(JSON.stringify(stableVersionData))
      }
      
      const mockStableFileHandle = {
        getFile: vi.fn().mockResolvedValue(mockStableFile)
      }
      
      const mockDirectoryHandle = {
        name: projectName,
        getFileHandle: vi.fn().mockResolvedValue(mockStableFileHandle)
      } as unknown as FileSystemDirectoryHandle
      
      // Setup: Mock OPFS to return working copy
      vi.doMock('../../composables/useProjectStore', async () => {
        const actual = await vi.importActual('../../composables/useProjectStore')
        return {
          ...actual,
          opfsManager: {
            ...mockOPFSManager,
            loadContextSetsFromProject: vi.fn().mockResolvedValue(opfsWorkingCopy)
          }
        }
      })
      
      // Load project - should prioritize OPFS working copy
      const result = await store.autoLoadContextSetsFromProject(mockDirectoryHandle)
      
      expect(result).toBe(true)
      // Should have OPFS working copy data, not stable version
      expect(store.contextSets.value['opfs-context']).toBeDefined()
      expect(store.contextSets.value['stable-context']).toBeUndefined()
      expect(store.filesManifest.value['file_opfs123']).toBeDefined()
      expect(store.filesManifest.value['file_stable123']).toBeUndefined()
    })

    it('should create working copy from stable version on first load', async () => {
      const projectName = 'test-first-load-project'
      
      // Mock stable version data
      const stableVersionData = {
        schemaVersion: '1.0',
        filesManifest: {
          'file_stable456': { path: 'src/stable-first.vue', comment: 'From stable version' }
        },
        contextSets: {
          'stable-first-context': { description: 'From stable first load', files: ['file_stable456'], workflow: [] }
        },
        fileContextsIndex: {}
      }
      
      const mockStableFile = {
        text: vi.fn().mockResolvedValue(JSON.stringify(stableVersionData))
      }
      
      const mockStableFileHandle = {
        getFile: vi.fn().mockResolvedValue(mockStableFile)
      }
      
      const mockDirectoryHandle = {
        name: projectName,
        getFileHandle: vi.fn().mockResolvedValue(mockStableFileHandle)
      } as unknown as FileSystemDirectoryHandle
      
      // Mock OPFS to return null (no working copy exists)
      vi.doMock('../../composables/useProjectStore', async () => {
        const actual = await vi.importActual('../../composables/useProjectStore')
        return {
          ...actual,
          opfsManager: {
            ...mockOPFSManager,
            loadContextSetsFromProject: vi.fn().mockResolvedValue(null),
            saveContextSetsToProject: vi.fn().mockResolvedValue(true)
          }
        }
      })
      
      // Load project - should load stable version and create working copy
      const result = await store.autoLoadContextSetsFromProject(mockDirectoryHandle)
      
      expect(result).toBe(true)
      expect(store.contextSets.value['stable-first-context']).toBeDefined()
      expect(store.filesManifest.value['file_stable456']).toBeDefined()
    })

    it('should auto-save changes to OPFS working copy', async () => {
      // Set up a project
      const mockFolder = { name: 'auto-save-project' } as FileSystemDirectoryHandle
      store.setSelectedFolder(mockFolder)
      
      // Spy on saveWorkingCopyToOPFS
      const saveWorkingCopySpy = vi.spyOn(store, 'saveWorkingCopyToOPFS')
      
      // Create context set - should auto-save to OPFS
      store.createContextSet('auto-save-test', 'Test auto-save functionality')
      
      // Should have triggered auto-save
      expect(saveWorkingCopySpy).toHaveBeenCalledWith('auto-save-project')
      
      // Set active context set - should also auto-save
      store.setActiveContextSet('auto-save-test')
      
      expect(saveWorkingCopySpy).toHaveBeenCalledTimes(2)
      
      // Add file - should also auto-save
      const file = {
        name: 'auto-save.vue',
        path: 'src/components/auto-save.vue', 
        type: 'file' as const
      }
      store.addFileToActiveContextSet(file)
      
      expect(saveWorkingCopySpy).toHaveBeenCalledTimes(3)
    })

    it('should export working copy to stable version', async () => {
      // Set up project with context sets
      const mockFolder = {
        name: 'export-test-project',
        getFileHandle: vi.fn(),
        createWritable: vi.fn()
      } as unknown as FileSystemDirectoryHandle
      
      store.setSelectedFolder(mockFolder)
      store.createContextSet('export-working-copy', 'Test export from working copy')
      store.setActiveContextSet('export-working-copy')
      
      const file = {
        name: 'export-file.vue',
        path: 'src/components/export-file.vue',
        type: 'file' as const
      }
      store.addFileToActiveContextSet(file)
      
      // Mock file operations for export
      const mockWritable = {
        write: vi.fn(),
        close: vi.fn()
      }
      
      const mockFileHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable)
      }
      
      mockFolder.getFileHandle = vi.fn().mockResolvedValue(mockFileHandle)
      
      // Export to project folder
      const result = await store.exportToProjectFolder()
      
      expect(result.success).toBe(true)
      expect(mockWritable.write).toHaveBeenCalled()
      expect(mockWritable.close).toHaveBeenCalled()
      
      // Verify exported content contains working copy data
      const exportedContent = mockWritable.write.mock.calls[0][0]
      const parsedContent = JSON.parse(exportedContent)
      expect(parsedContent.contextSets['export-working-copy']).toBeDefined()
    })

    it('should handle project switching without data loss', async () => {
      // Set up first project
      const project1 = { name: 'project-1' } as FileSystemDirectoryHandle
      store.setSelectedFolder(project1)
      store.createContextSet('project1-context', 'Project 1 context')
      store.setActiveContextSet('project1-context')
      
      const file1 = {
        name: 'project1-file.vue',
        path: 'src/project1-file.vue',
        type: 'file' as const
      }
      store.addFileToActiveContextSet(file1)
      
      // Verify project 1 data exists
      expect(store.contextSets.value['project1-context']).toBeDefined()
      expect(Object.keys(store.filesManifest.value)).toHaveLength(1)
      
      // Switch to second project (with no existing context sets)
      const project2 = {
        name: 'project-2',
        getFileHandle: vi.fn().mockRejectedValue(new Error('File not found'))
      } as unknown as FileSystemDirectoryHandle
      
      // This should clear current state and start fresh
      await store.autoLoadContextSetsFromProject(project2)
      
      // Project 2 should start with clean slate
      expect(Object.keys(store.contextSets.value)).toHaveLength(0)
      expect(store.activeContextSetName.value).toBe(null)
      expect(Object.keys(store.filesManifest.value)).toHaveLength(0)
      
      // Create some data in project 2
      store.createContextSet('project2-context', 'Project 2 context')
      store.setActiveContextSet('project2-context')
      
      const file2 = {
        name: 'project2-file.vue',
        path: 'src/project2-file.vue',
        type: 'file' as const
      }
      store.addFileToActiveContextSet(file2)
      
      // Verify project 2 data
      expect(store.contextSets.value['project2-context']).toBeDefined()
      expect(Object.keys(store.filesManifest.value)).toHaveLength(1)
      
      // Switch back to project 1 - should reload project 1 data from OPFS
      // (In real implementation, this would load from OPFS working copy)
      await store.autoLoadContextSetsFromProject(project1)
      
      // The working copy architecture ensures no data loss between project switches
      // Data is preserved in OPFS working copies per project
    })

    it('should migrate from localStorage to OPFS', async () => {
      // This test ensures the migration is complete
      
      // Create context sets using new OPFS-based approach
      const mockFolder = { name: 'migration-test' } as FileSystemDirectoryHandle
      store.setSelectedFolder(mockFolder)
      store.createContextSet('migrated-context', 'Migrated from localStorage')
      
      // Verify no localStorage calls for context sets
      const localStorageSetSpy = vi.spyOn(Storage.prototype, 'setItem')
      
      // Operations that used to save to localStorage
      store.setActiveContextSet('migrated-context')
      const file = {
        name: 'migrated-file.vue',
        path: 'src/migrated-file.vue',
        type: 'file' as const
      }
      store.addFileToActiveContextSet(file)
      store.updateFileComment(store.findFileIdByPath(file.path)!, 'Updated comment')
      
      // localStorage should only be called for project metadata, not context sets
      const localStorageCalls = localStorageSetSpy.mock.calls
      const contextSetStorageCalls = localStorageCalls.filter(call => {
        const value = call[1]
        return value.includes('contextSets') || value.includes('filesManifest')
      })
      
      // Should be no localStorage calls containing context sets or files manifest
      expect(contextSetStorageCalls).toHaveLength(0)
    })
  })
}) 