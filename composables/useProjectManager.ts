/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import type { FileTreeItem } from '~/composables/useFileSystem'
import { logger } from '~/utils/logger'

// Saved projects management interface
export interface SavedProject {
  name: string
  addedAt: number
  lastAccessed: number
}

export function useProjectManager() {
  const {
    setSelectedFolder,
    setFileTree,
    autoLoadContextSetsFromProject,
    goToWorkspace,
    isOPFSAvailable,
    getOPFSProjects,
    copyProjectToOPFS,
    clearProject,
    buildFilteredFileTree,
    isFileSystemSupported
  } = useProjectStore()

  const { success } = useNotifications()
  const { generateEmbeddingsOnDemand } = useSmartContextSuggestions()
  const { createProjectLoadingManager } = useLoadingStates()
  const { isLanguageSupported } = useRegexCodeParser()
  const { isModelReady } = useLLMLoader()

  // Create project loading manager
  const projectLoading = createProjectLoadingManager()

  // Saved projects management
  const SAVED_PROJECTS_KEY = 'contextmax-saved-projects'
  const savedProjects = ref<SavedProject[]>([])

  const autoLoadedFromProject = ref(false)
  const autoLoadError = ref('')
  
  // Reactive file tree for embedding generation
  const currentFileTree = ref<FileTreeItem[]>([])
  
  // Track if we've already processed embeddings for current file tree
  const processedEmbeddingsForFileTree = ref<string | null>(null)

  // Watch for both embeddings model readiness AND file tree changes
  watch(
    [() => isModelReady('embeddings').value, currentFileTree],
    async ([isReady, fileTree]) => {
      if (isReady && fileTree.length > 0) {
        // Create a simple hash of the file tree to avoid reprocessing the same files
        const fileTreeHash = JSON.stringify(fileTree.map(f => ({ path: f.path, type: f.type })))
        
        // Only process if we haven't already processed this file tree
        if (processedEmbeddingsForFileTree.value !== fileTreeHash) {
          try {
            const filesToProcess = await prepareFilesForEmbedding(fileTree)
            if (filesToProcess.length > 0) {
              await generateEmbeddingsOnDemand(filesToProcess)
              processedEmbeddingsForFileTree.value = fileTreeHash
            }
          } catch (error) {
            logger.warn('⚠️ Error during automatic embedding generation:', error)
          }
        }
      }
    },
    { immediate: true, deep: true }
  )

  function resetState() {
    autoLoadedFromProject.value = false
    autoLoadError.value = ''
    currentFileTree.value = []
    processedEmbeddingsForFileTree.value = null
  }

  // Load saved projects from localStorage
  const loadSavedProjectsFromStorage = () => {
    try {
      const saved = localStorage.getItem(SAVED_PROJECTS_KEY)
      if (!saved) {
        savedProjects.value = []
        return
      }
      
      const projects: SavedProject[] = JSON.parse(saved)
      savedProjects.value = projects.sort((a, b) => b.lastAccessed - a.lastAccessed)
    } catch (error) {
      logger.error('Failed to load saved projects:', error)
      savedProjects.value = []
    }
  }

  // Save saved projects to localStorage
  const saveSavedProjectsToStorage = () => {
    try {
      localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(savedProjects.value))
    } catch (error) {
      logger.error('Failed to save projects to localStorage:', error)
    }
  }

  // Add project to saved list
  const addToSavedProjects = (projectName: string) => {
    try {
      const existingIndex = savedProjects.value.findIndex((p: SavedProject) => p.name === projectName)
      
      if (existingIndex >= 0) {
        savedProjects.value[existingIndex].lastAccessed = Date.now()
      } else {
        savedProjects.value.push({
          name: projectName,
          addedAt: Date.now(),
          lastAccessed: Date.now()
        })
      }
      
      savedProjects.value.sort((a: SavedProject, b: SavedProject) => b.lastAccessed - a.lastAccessed)
      saveSavedProjectsToStorage()
    } catch (error) {
      logger.error('Failed to add project to saved list:', error)
    }
  }

  // Remove project from saved list
  const removeFromSavedProjects = (projectName: string) => {
    try {
      const index = savedProjects.value.findIndex((p: SavedProject) => p.name === projectName)
      if (index >= 0) {
        savedProjects.value.splice(index, 1)
        saveSavedProjectsToStorage()
      }
    } catch (error) {
      logger.error('Failed to remove project from saved list:', error)
    }
  }

  // Check if there are any saved projects
  const hasSavedProjects = (): boolean => {
    if (!import.meta.client) return false
    return savedProjects.value.length > 0
  }

  // Helper function to prepare files for embedding generation
  async function prepareFilesForEmbedding(fileTree: FileTreeItem[]): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = []
    
    const traverse = async (items: FileTreeItem[]) => {
      for (const item of items) {
        if (item.type === 'file' && item.handle && isLanguageSupported(item.path)) {
          try {
            const fileHandle = item.handle as FileSystemFileHandle
            const file = await fileHandle.getFile()
            const content = await file.text()
            files.push({ path: item.path, content })
          } catch (error) {
            logger.warn(`Failed to read file ${item.path}:`, error)
          }
        } else if (item.type === 'directory' && item.children) {
          await traverse(item.children)
        }
      }
    }
    
    await traverse(fileTree)
    return files
  }
  
  async function loadProjectFiles(directoryHandle: FileSystemDirectoryHandle, hadSavedDataBefore: boolean, forceOPFSRefresh: boolean = false, skipStartLoading: boolean = false) {
    if (!skipStartLoading) {
      projectLoading.startFileLoading()
    }
    autoLoadedFromProject.value = false
    autoLoadError.value = ''
    
    try {
      // Only try to auto-load context-sets.json if we don't already have saved data
      if (!hadSavedDataBefore) {
        const autoLoaded = await autoLoadContextSetsFromProject(directoryHandle)
        if (autoLoaded) {
          autoLoadedFromProject.value = true
        }
      } else {
      }
      
      // Always load the file tree to enable file browsing
      const files = await buildFilteredFileTree(directoryHandle)
      setFileTree(files)
      
      // Update reactive file tree to trigger embedding generation
      currentFileTree.value = files
      
      // Copy to OPFS for persistent access (always try if OPFS is supported and we don't have a copy)
      if (isOPFSAvailable()) {
        const projectName = directoryHandle.name
        let shouldCopyToOPFS = false
        
        if (!hadSavedDataBefore) {
          // Fresh project selection - always copy
          shouldCopyToOPFS = true
        } else if (forceOPFSRefresh) {
          // Force refresh for reload operations - always copy to update OPFS with fresh files
          shouldCopyToOPFS = true
        } else {
          // Reconnecting to existing project - check if OPFS copy exists
          try {
            const opfsProjects = await getOPFSProjects()
            const hasOPFSCopy = opfsProjects.includes(projectName)
            if (!hasOPFSCopy) {
              shouldCopyToOPFS = true
            }
          } catch (error) {
            logger.warn('Failed to check OPFS projects, will attempt copy anyway:', error)
            shouldCopyToOPFS = true
          }
        }
        
        if (shouldCopyToOPFS) {
          try {
            const copied = await copyProjectToOPFS(directoryHandle)
            if (copied) {
              // Add to saved projects when successfully copied
              addToSavedProjects(projectName)
            } else {
              logger.warn('Failed to copy project to OPFS, but continuing with regular functionality')
            }
          } catch (error) {
            logger.warn('OPFS copy failed, but continuing with regular functionality:', error)
          }
        } else {
          // Project already exists in OPFS, just update the saved projects list
          addToSavedProjects(projectName)
        }
      }
      
      // If we restored from localStorage, show success message
      if (hadSavedDataBefore) {
        success(
          'Project Restored Successfully',
          `Your project "${directoryHandle.name}" has been reconnected with your saved work.`
        )
        
      }
    } catch (error) {
      logger.error('Error loading project:', error)
      if (error instanceof Error) {
        autoLoadError.value = error.message
      }
      setFileTree([])
    } finally {
      projectLoading.stopFileLoading()
    }
  }

  // Switch to a different saved project using existing loadProjectFiles logic
  async function switchToProject(projectName: string): Promise<boolean> {
    
    try {
      // Update last accessed time
      addToSavedProjects(projectName)
      
      // Try to load project from OPFS using existing store method
      const { getProjectFromOPFS } = useProjectStore()
      const opfsHandle = await getProjectFromOPFS(projectName)
      if (!opfsHandle) {
        logger.error(`❌ Project not found in OPFS: ${projectName}`)
        return false
      }
      
      // Clear current state
      clearProject()
      resetState()
      
      // Set new folder
      setSelectedFolder(opfsHandle)
      
      // Load project files (this handles file tree building, context sets loading, etc.)
      await loadProjectFiles(opfsHandle, true) // Mark as having saved data to preserve context sets
      
      return true
    } catch (error) {
      logger.error(`❌ Failed to switch to project ${projectName}:`, error)
      return false
    }
  }

  async function selectProjectFolder() {
    if (!isFileSystemSupported.value) {
      return
    }

    try {
      
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      })
      
      
      // Start loading immediately to show loader without delay
      projectLoading.startFileLoading()
      
      
      setSelectedFolder(directoryHandle)
      await loadProjectFiles(directoryHandle, false, false, true) // Always treat as fresh selection, skip starting loading since we already started it
      
      goToWorkspace()
    } catch (error: unknown) {
      // Stop loading on error
      projectLoading.stopFileLoading()
      
      if (error instanceof Error && error.name !== 'AbortError') {
        logger.error('Error selecting folder for new project:', error)
        // Clear auto-detection state on error
        resetState()
        // TODO: Show user-friendly error message
      }
    }
  }

  // Reload files from local folder using existing selectProjectFolder logic
  async function reloadFilesFromLocal(): Promise<boolean> {
    
    if (!isFileSystemSupported.value) {
      return false
    }
    
    try {
      // Show directory picker using the same logic as selectProjectFolder
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      })
      
      if (!directoryHandle) {
        return false
      }
      
      
      // Start loading immediately to show loader without delay
      projectLoading.startFileLoading()
      
      // Check if this is the same project or a different one
      const { selectedFolder } = useProjectStore()
      const currentProjectName = selectedFolder?.name
      const newProjectName = directoryHandle.name
      
      if (currentProjectName && currentProjectName !== newProjectName) {
        logger.warn(`⚠️ Selected folder "${newProjectName}" differs from current project "${currentProjectName}"`)
        // We'll proceed but this might be intentional (user wants to switch projects via refresh)
      }
      
      // Update folder handle
      setSelectedFolder(directoryHandle)
      
      // Load project files (this handles everything including OPFS copy and context sets)
      const hadSavedDataBefore = currentProjectName === newProjectName
      // Force OPFS refresh when reloading to ensure fresh files are copied, skip starting loading since we already started it
      await loadProjectFiles(directoryHandle, hadSavedDataBefore, true, true)
      
      return true
    } catch (error) {
      // Stop loading on error
      projectLoading.stopFileLoading()
      
      if (error instanceof Error && error.name !== 'AbortError') {
        logger.error('❌ Error refreshing files from local folder:', error)
      }
      return false
    }
  }

  // Initialize saved projects on mount
  onMounted(() => {
    loadSavedProjectsFromStorage()
  })

  // Computed properties for saved projects
  const sortedSavedProjects = computed(() => {
    return [...savedProjects.value].sort((a, b) => b.lastAccessed - a.lastAccessed)
  })

  const recentProjects = computed(() => {
    return sortedSavedProjects.value.slice(0, 5) // Show last 5 projects
  })

  return {
    // Existing project manager functionality
    isFileSystemSupported,
    autoLoadedFromProject,
    autoLoadError,
    selectProjectFolder,
    resetState,
    
    // Saved projects functionality
    savedProjects: readonly(savedProjects),
    sortedSavedProjects,
    recentProjects,
    loadSavedProjectsFromStorage,
    addToSavedProjects,
    removeFromSavedProjects,
    hasSavedProjects,
    switchToProject,
    reloadFilesFromLocal,
    saveSavedProjectsToStorage
  }
} 