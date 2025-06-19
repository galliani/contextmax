/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Re-export types from sub-composables for backward compatibility
export type { 
  FileTreeItem,
  FileManifestEntry,
  FunctionRef,
  FileRef,
  WorkflowStep,
  EntryPoint,
  ContextSet,
  ContextSetsData
} from './useContextSets'

export type { SavedProject } from './useSavedProjects'
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
  const savedProjects = useSavedProjects()
  const loadingStates = useLoadingStates()
  
  // Create project-specific loading manager
  const projectLoading = loadingStates.createProjectLoadingManager()
  
  // View management
  const setCurrentView = (view: AppView) => {
    const previousView = globalState.currentView
    globalState.currentView = view
    console.log('Current view set to:', view)
    
    // Track navigation if view actually changed
    if (previousView !== view && import.meta.client) {
      const { trackNavigation } = useAnalyticsHelpers()
      trackNavigation(previousView, view)
    }
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
    console.log('File tree updated', {
      nodeCount: fileSystem.countFileTreeNodes(tree.map(item => fileSystem.removeHandles(item))),
      hasHandles: globalState.hasActiveHandles
    })
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
      console.log(`🟡 OPFS restoration already attempted for: ${projectPath}`)
      
      // Check if we actually have handles - if not, we need to rebuild
      const hasHandlesInTree = globalState.fileTree.length > 0 && fileSystem.checkFileTreeHasHandles(globalState.fileTree)
      
      if (!hasHandlesInTree) {
        console.log(`🟡 No handles found in file tree, forcing rebuild from OPFS...`)
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
        console.log(`🟡 Successfully loaded project from OPFS: ${projectPath}`)
        
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
        console.log(`🟡 Project not found in OPFS: ${projectPath}`)
        return false
      }
    } catch (error) {
      console.warn(`Failed to load project from OPFS: ${projectPath}`, error)
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
        console.log(`Project copied to OPFS: ${opfsPath}`)
        globalState.hasSuccessfulOPFSCopy = true // Mark as successfully copied
        
        // Add to saved projects list
        savedProjects.addToSavedProjects(projectName)
        
        saveToLocalStorage() // Save the updated state
        projectLoading.stopOPFSCopy(loadingId)
        return true
      }
      
      projectLoading.stopOPFSCopy(loadingId)
      return false
    } catch (error) {
      console.error('Failed to copy project to OPFS:', error)
      return false
    }
  }

  // Auto-load context sets from project with priority system
  const autoLoadContextSetsFromProject = async (directoryHandle: FileSystemDirectoryHandle): Promise<boolean> => {
    const projectName = directoryHandle.name
    
    // Always start with a clean slate when loading a new project
    contextSets.clearAll()
    
    console.log(`🔄 Loading context sets for project: ${projectName}`)
    
    // Priority 1: Check for working copy in OPFS (source of truth once user has made changes)
    try {
      const workingCopy = await opfsManager.loadContextSets(projectName)
      if (workingCopy) {
        contextSets.loadContextSetsData(workingCopy)
        console.log(`✅ Loaded working copy from OPFS: ${projectName}`)
        return true
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load working copy from OPFS for ${projectName}:`, error)
    }
    
    // Priority 2: Load stable version from project folder and create working copy
    try {
      const stableVersion = await persistence.tryLoadStableVersionFromProject(directoryHandle)
      if (stableVersion) {
        contextSets.loadContextSetsData(stableVersion)
        
        // Immediately create working copy from stable version
        await opfsManager.saveContextSets(projectName, stableVersion)
        console.log(`✅ Loaded stable version and created working copy: ${projectName}`)
        return true
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load stable version for ${projectName}:`, error)
    }
    
    // Priority 3: Start fresh (no context sets found)
    console.log(`✅ Starting fresh for project: ${projectName}`)
    return false
  }

  // Save working copy to OPFS
  const saveWorkingCopyToOPFS = async (projectName: string): Promise<boolean> => {
    try {
      const contextSetsData = contextSets.generateContextSetsJSON()
      const result = await opfsManager.saveContextSets(projectName, contextSetsData)
      return result
    } catch (error) {
      console.error(`Failed to save working copy to OPFS for ${projectName}:`, error)
      return false
    }
  }

  // Enhanced context set operations that auto-save to OPFS
  const createContextSet = (name: string, description: string = '') => {
    contextSets.createContextSet(name, description)
    
    // Auto-save to OPFS working copy
    if (globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
  }

  const setActiveContextSet = (name: string | null) => {
    const result = contextSets.setActiveContextSet(name)
    
    // Auto-save to OPFS working copy  
    if (result && globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
    
    return result
  }

  const addFileToActiveContextSet = (file: any) => {
    const result = contextSets.addFileToActiveContextSet(file.path)
    
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

  // Export operations
  const exportToProjectFolder = async (): Promise<{ success: boolean, error?: string, warning?: string }> => {
    const contextSetsData = contextSets.generateContextSetsJSON()
    return await persistence.exportToProjectFolder(globalState.selectedFolder, contextSetsData)
  }

  const previewContextSetsJSON = () => {
    const contextSetsData = contextSets.generateContextSetsJSON()
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
    savedProjects: savedProjects.savedProjects,

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
    generateContextSetsJSON: contextSets.generateContextSetsJSON,
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
    generateFileContextsIndex: contextSets.generateFileContextsIndex,
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
    exportToProjectFolder,
    hasStableVersionInProject: () => persistence.hasStableVersionInProject(globalState.selectedFolder),
    getExportStatus,
    previewContextSetsJSON,

    // Saved projects management
    loadSavedProjectsFromStorage: savedProjects.loadSavedProjectsFromStorage,
    addToSavedProjects: savedProjects.addToSavedProjects,
    getSavedProjects: () => savedProjects.savedProjects.value,
    removeFromSavedProjects: savedProjects.removeFromSavedProjects,
    hasSavedProjects: savedProjects.hasSavedProjects,
    switchToProject: (projectName: string) => savedProjects.switchToProject(
      projectName,
      opfsManager.getProjectFromOPFS,
      () => {
        globalState.selectedFolder = null
        globalState.fileTree = []
        globalState.hasActiveHandles = false
        globalState.opfsRestorationAttempted = false
        contextSets.clearAll()
      },
      (handle: FileSystemDirectoryHandle) => {
        globalState.selectedFolder = handle
        globalState.hasActiveHandles = true
        globalState.hasSuccessfulOPFSCopy = true
      },
      async (handle: FileSystemDirectoryHandle) => {
        const files = await fileSystem.rebuildFileTreeFromOPFS(handle)
        globalState.fileTree = files
      },
      autoLoadContextSetsFromProject,
      saveToLocalStorage
    ),
    reloadFilesFromLocal: () => savedProjects.reloadFilesFromLocal(
      () => fileSystem.showDirectoryPicker({ mode: 'read' }),
      () => globalState.selectedFolder?.name || null,
      projectLoading.startFileLoading,
      setSelectedFolder,
      fileSystem.buildFilteredFileTree,
      setFileTree,
      copyProjectToOPFS,
      autoLoadContextSetsFromProject
    ),

    // File system operations
    readDirectoryRecursively: fileSystem.readDirectoryRecursively,
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