/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { logger } from '~/utils/logger'

// Re-export types from sub-composables for backward compatibility
export type { 
  FileTreeItem,
  FileManifestEntry,
  FileIndexEntry,
  FunctionRef,
  FileRef,
  Workflow,
  WorkflowPoint,
  ContextSet,
  ContextSetsData
} from './useContextSets'

export type { SerializableProjectState } from './usePersistence'

// View states for navigation
export type AppView = 'landing' | 'workspace'

// Global reactive state (only the coordinator state)
const globalState = reactive({
  // View management
  currentView: 'landing' as AppView,
  
  // Project state
  selectedFolder: null as FileSystemDirectoryHandle | null,
  fileTree: [] as any[],
  
  // File content modal state
  currentFileContent: '',
  currentFileName: '',
  isFileContentModalOpen: false,
  
  // Track if file tree has handles or is restored from localStorage
  hasActiveHandles: false,
  
  // Track if OPFS restoration has been attempted to prevent duplicates
  opfsRestorationAttempted: false,
  
  // Track if the current project has been successfully copied to OPFS
  hasSuccessfulOPFSCopy: false
})

export const useProjectStore = () => {
  // Initialize all sub-composables
  const fileSystem = useFileSystem()
  const opfsManager = useOPFSManager()
  const contextSets = useContextSets()
  const persistence = usePersistence()
  const loadingStates = useLoadingStates()
  
  // Create project-specific loading manager
  const projectLoading = loadingStates.createProjectLoadingManager()
  
  // View management
  const setCurrentView = (view: AppView) => {
    const previousView = globalState.currentView
    globalState.currentView = view
    
  }

  const goToLanding = () => {
    setCurrentView('landing')
  }

  const goToWorkspace = () => {
    setCurrentView('workspace')
  }

  // Project management functions
  const setSelectedFolder = (folder: FileSystemDirectoryHandle | null) => {
    globalState.selectedFolder = folder
    
    if (folder) {
      // Auto-load from OPFS working copy or stable version
      autoLoadContextSetsFromProject(folder)
      globalState.hasActiveHandles = true // We now have an active folder handle
      saveToLocalStorage() // Auto-save when folder is selected
    }
  }

  const setFileTree = (tree: any[]) => {
    globalState.fileTree = tree
    globalState.hasActiveHandles = tree.length > 0 && tree.some(item => !!item.handle) // Check if we have actual handles
    saveToLocalStorage() // Auto-save when file tree changes
  }

  const clearProject = () => {
    globalState.selectedFolder = null
    globalState.fileTree = []
    globalState.currentFileContent = ''
    globalState.currentFileName = ''
    globalState.isFileContentModalOpen = false
    globalState.hasActiveHandles = false
    globalState.opfsRestorationAttempted = false
    globalState.hasSuccessfulOPFSCopy = false
    
    // Clear context sets and files manifest
    contextSets.clearAll()
    
    // Clear localStorage when project is cleared
    persistence.clearLocalStorage()
  }

  // File content management
  const loadFileContent = async (file: any) => {
    const result = await fileSystem.loadFileContent(file)
    if (result) {
      globalState.currentFileContent = result.content
      globalState.currentFileName = result.fileName
      globalState.isFileContentModalOpen = true
    }
  }

  const closeFileContentModal = () => {
    globalState.isFileContentModalOpen = false
  }

  // Save state to localStorage
  const saveToLocalStorage = () => {
    persistence.saveToLocalStorage({
      selectedFolderName: globalState.selectedFolder?.name || null,
      fileTree: globalState.fileTree.map(item => fileSystem.removeHandles(item)),
      hasOPFSCopy: globalState.hasSuccessfulOPFSCopy,
      opfsProjectPath: globalState.selectedFolder?.name || null
    })
  }

  // Load state from localStorage
  const loadFromLocalStorage = async (): Promise<{ metadataLoaded: boolean; opfsRestored: boolean }> => {
    const state = persistence.loadFromLocalStorage()
    if (!state) {
      return { metadataLoaded: false, opfsRestored: false }
    }
    
    // Restore only project metadata, not context sets (those come from OPFS)
    globalState.fileTree = state.fileTree
    globalState.hasActiveHandles = false // Initially false, will be set to true if OPFS project is loaded
    
    let opfsRestored = false
    
    // Always try to load from OPFS if we have a project path
    if (state.opfsProjectPath) {
      opfsRestored = await tryLoadFromOPFS(state.opfsProjectPath)
    }
    
    return { metadataLoaded: true, opfsRestored }
  }

  // Try to load project from OPFS
  const tryLoadFromOPFS = async (projectPath: string): Promise<boolean> => {
    // Guard against duplicate restoration attempts
    if (globalState.opfsRestorationAttempted) {
      // Check if we actually have handles - if not, we need to rebuild
      const hasHandlesInTree = globalState.fileTree.length > 0 && fileSystem.checkFileTreeHasHandles(globalState.fileTree)
      
      if (!hasHandlesInTree) {
        // Reset the flag and try again
        globalState.opfsRestorationAttempted = false
      } else {
        return hasHandlesInTree // Return true if we already have handles
      }
    }
    
    globalState.opfsRestorationAttempted = true
    
    try {
      const opfsHandle = await opfsManager.getProjectFromOPFS(projectPath)
      if (opfsHandle) {
        globalState.selectedFolder = opfsHandle
        globalState.hasActiveHandles = true
        globalState.hasSuccessfulOPFSCopy = true // Mark as successfully loaded from OPFS
        
        // Rebuild file tree with actual handles from OPFS
        const files = await fileSystem.rebuildFileTreeFromOPFS(opfsHandle)
        globalState.fileTree = files
        
        // Load context sets from OPFS working copy
        await autoLoadContextSetsFromProject(opfsHandle)
        
        // Notify success (only once per session)
        if (import.meta.client) {
          const { success } = useNotifications()
          success(
            'Project Fully Restored',
            `Project "${projectPath}" loaded seamlessly from local storage.`
          )
        }
        
        return true
      } else {
        return false
      }
    } catch (error) {
      logger.warn(`Failed to load project from OPFS: ${projectPath}`, error)
      return false
    }
  }

  // Copy project to OPFS for persistent storage
  const copyProjectToOPFS = async (sourceHandle: FileSystemDirectoryHandle): Promise<boolean> => {
    try {
      const projectName = sourceHandle.name
      
      // Set loading state using the loading manager
      const loadingId = projectLoading.startOPFSCopy(projectName)
      
      const opfsPath = await opfsManager.copyProjectToOPFS(sourceHandle, projectName, (progress) => {
        projectLoading.updateOPFSProgress(loadingId, progress)
      })
      
      if (opfsPath) {
        globalState.hasSuccessfulOPFSCopy = true // Mark as successfully copied
        
        // Note: Adding to saved projects list is now handled by useProjectManager
        
        saveToLocalStorage() // Save the updated state
        projectLoading.stopOPFSCopy(loadingId)
        return true
      }
      
      projectLoading.stopOPFSCopy(loadingId)
      return false
    } catch (error) {
      logger.error('Failed to copy project to OPFS:', error)
      return false
    }
  }

  // Auto-load context sets from project with priority system
  const autoLoadContextSetsFromProject = async (directoryHandle: FileSystemDirectoryHandle): Promise<boolean> => {
    const projectName = directoryHandle.name
    
    // Always start with a clean slate when loading a new project
    contextSets.clearAll()
    
    
    // Priority 1: Check for working copy in OPFS (source of truth once user has made changes)
    try {
      const workingCopy = await opfsManager.loadContextSets(projectName)
      if (workingCopy) {
        contextSets.loadContextSetsData(workingCopy)
        return true
      }
    } catch (error) {
      logger.warn(`⚠️ Failed to load working copy from OPFS for ${projectName}:`, error)
    }
    
    // Priority 2: Load stable version from project folder and create working copy
    try {
      const stableVersion = await persistence.tryLoadStableVersionFromProject(directoryHandle)
      if (stableVersion) {
        contextSets.loadContextSetsData(stableVersion)
        
        // Immediately create working copy from stable version
        await opfsManager.saveContextSets(projectName, stableVersion)
        return true
      }
    } catch (error) {
      logger.warn(`⚠️ Failed to load stable version for ${projectName}:`, error)
    }
    
    // Priority 3: Start fresh (no context sets found)
    return false
  }

  // Save working copy to OPFS
  const saveWorkingCopyToOPFS = async (projectName: string): Promise<boolean> => {
    try {
      const contextSetsData = contextSets.generateContextSetsJSON(projectName)
      const result = await opfsManager.saveContextSets(projectName, contextSetsData)
      return result
    } catch (error) {
      logger.error(`Failed to save working copy to OPFS for ${projectName}:`, error)
      return false
    }
  }

  // Enhanced context set operations that auto-save to OPFS
  const createContextSet = (name: string, description: string = ''): boolean => {
    const success = contextSets.createContextSet(name, description)
    
    // Auto-save to OPFS working copy only if creation was successful
    if (success && globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
    
    return success
  }

  const setActiveContextSet = (name: string | null) => {
    const result = contextSets.setActiveContextSet(name)
    
    // Auto-save to OPFS working copy  
    if (result && globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
    
    return result
  }

  const addFileToActiveContextSet = (file: any, options?: {
    classification?: string
    comment?: string
    functionRefs?: any[]
  }) => {
    const result = contextSets.addFileToActiveContextSet(file.path, options)
    
    if (result && globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
    
    return result
  }

  const removeFileFromActiveContextSet = (fileId: string) => {
    const result = contextSets.removeFileFromActiveContextSet(fileId)
    
    if (result && globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
    
    return result
  }

  const updateActiveContextSet = (updates: any) => {
    contextSets.updateActiveContextSet(updates)
    
    // Auto-save to OPFS working copy
    if (globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
  }

  const deleteContextSet = async (name: string) => {
    const result = await contextSets.deleteContextSet(name)
    
    // Auto-save to OPFS working copy
    if (result && globalState.selectedFolder) {
      const saveResult = await saveWorkingCopyToOPFS(globalState.selectedFolder.name)
      return saveResult
    }
    
    return result
  }

  const updateFileComment = (fileId: string, comment: string) => {
    const result = contextSets.updateFileComment(fileId, comment)
    
    if (result && globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
    
    return result
  }


  const previewContextSetsJSON = () => {
    const projectName = globalState.selectedFolder?.name
    const contextSetsData = contextSets.generateContextSetsJSON(projectName, true) // Include timestamp
    const result = persistence.previewContextSetsJSON(contextSetsData)
    
    if (result) {
      globalState.currentFileContent = result.content
      globalState.currentFileName = result.fileName
      globalState.isFileContentModalOpen = true
    }
  }

  const previewContextSetsJSONWithPrefix = () => {
    const projectName = globalState.selectedFolder?.name
    const contextSetsData = contextSets.generateContextSetsJSONWithPrefix(projectName, true) // Include timestamp
    const result = persistence.previewContextSetsJSON(contextSetsData)
    
    if (result) {
      globalState.currentFileContent = result.content
      globalState.currentFileName = result.fileName
      globalState.isFileContentModalOpen = true
    }
  }

  const getExportStatus = async () => {
    return await persistence.getExportStatus(
      globalState.selectedFolder,
      contextSets.hasContextSets.value,
      opfsManager.getContextSetsMetadata
    )
  }

  // Computed properties
  const hasDataLoaded = computed(() => {
    return globalState.selectedFolder || 
           Object.keys(contextSets.filesManifest.value).length > 0 || 
           Object.keys(contextSets.contextSets.value).length > 0
  })

  return {
    // State (readonly refs and computed)
    currentView: readonly(toRef(globalState, 'currentView')),
    selectedFolder: readonly(toRef(globalState, 'selectedFolder')),
    fileTree: computed(() => globalState.fileTree),
    currentFileContent: readonly(toRef(globalState, 'currentFileContent')),
    currentFileName: readonly(toRef(globalState, 'currentFileName')),
    isFileContentModalOpen: readonly(toRef(globalState, 'isFileContentModalOpen')),
    hasActiveHandles: readonly(toRef(globalState, 'hasActiveHandles')),
    opfsRestorationAttempted: readonly(toRef(globalState, 'opfsRestorationAttempted')),
    hasSuccessfulOPFSCopy: readonly(toRef(globalState, 'hasSuccessfulOPFSCopy')),

    // Delegated state from sub-composables
    filesManifest: contextSets.filesManifest,
    contextSets: contextSets.contextSets,
    activeContextSetName: contextSets.activeContextSetName,
    activeContextSet: contextSets.activeContextSet,
    contextSetNames: contextSets.contextSetNames,

    // Loading states
    isLoadingFiles: computed(() => projectLoading.isFileLoading()),
    isOPFSCopying: computed(() => projectLoading.isOPFSCopying()),
    opfsCopyProgress: computed(() => projectLoading.getOPFSProgress()),
    opfsCopyingProjectName: computed(() => projectLoading.getOPFSCopyingProject()),

    // Computed properties
    hasDataLoaded,

    // Actions - View management
    setCurrentView,
    goToLanding,
    goToWorkspace,

    // Actions - Project management
    setSelectedFolder,
    setFileTree,
    setIsLoadingFiles: projectLoading.startFileLoading, // For compatibility
    clearProject,
    autoLoadContextSetsFromProject,

    // Actions - Context sets (enhanced with auto-save)
    createContextSet,
    setActiveContextSet,
    updateActiveContextSet,
    deleteContextSet,
    addFileToActiveContextSet,
    removeFileFromActiveContextSet,

    // Actions - Files
    updateFileComment,
    updateFileManifestComment: updateFileComment, // Alias for compatibility
    loadFileContent,
    closeFileContentModal,

    // Actions - JSON generation
    generateContextSetsJSON: () => {
      const projectName = globalState.selectedFolder?.name
      return contextSets.generateContextSetsJSON(projectName)
    },
    generateContextSetsJSONWithPrefix: () => {
      const projectName = globalState.selectedFolder?.name
      return contextSets.generateContextSetsJSONWithPrefix(projectName)
    },
    loadContextSetsData: contextSets.loadContextSetsData,

    // Actions - Persistence
    saveToLocalStorage,
    loadFromLocalStorage,
    clearLocalStorage: persistence.clearLocalStorage,
    hasSavedData: persistence.hasSavedData,
    getSavedProjectName: persistence.getSavedProjectName,
    copyProjectToOPFS,

    // Utilities from sub-composables
    getOrCreateFileId: contextSets.getOrCreateFileId,
    findFileIdByPath: contextSets.findFileIdByPath,
    generateFileId: contextSets.generateFileId,
    generateFilesIndex: contextSets.generateFilesIndex,
    generateFileContextsIndex: contextSets.generateFileContextsIndex, // Alias for backward compatibility
    cleanupOrphanedFiles: contextSets.cleanupOrphanedFiles,
    isFileReferencedByAnyContextSet: contextSets.isFileReferencedByAnyContextSet,

    // OPFS-related functions
    isOPFSAvailable: opfsManager.isOPFSAvailable,
    getOPFSProjects: opfsManager.listOPFSProjects,
    deleteOPFSProject: opfsManager.deleteProjectFromOPFS,

    // Helper functions for testing
    setFilesManifestForTesting: contextSets.setFilesManifestForTesting,
    addFileToManifestForTesting: contextSets.addFileToManifestForTesting,

    // Export functions
    saveWorkingCopyToOPFS,
    hasStableVersionInProject: () => persistence.hasStableVersionInProject(globalState.selectedFolder),
    getExportStatus,
    previewContextSetsJSON,
    previewContextSetsJSONWithPrefix,


    // File system operations
    buildFilteredFileTree: fileSystem.buildFilteredFileTree,
    rebuildFileTreeFromOPFS: fileSystem.rebuildFileTreeFromOPFS,
    checkFileTreeHasHandles: fileSystem.checkFileTreeHasHandles,
    countFileTreeNodes: fileSystem.countFileTreeNodes,
    removeHandles: fileSystem.removeHandles,
    showDirectoryPicker: fileSystem.showDirectoryPicker,
    isValidProjectDirectory: fileSystem.isValidProjectDirectory,
    isFileSystemSupported: fileSystem.isFileSystemSupported
  }
}