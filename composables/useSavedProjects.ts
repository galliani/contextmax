/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Saved projects management interface
export interface SavedProject {
  name: string
  addedAt: number
  lastAccessed: number
}

export const useSavedProjects = () => {
  // Storage key
  const SAVED_PROJECTS_KEY = 'contextmax-saved-projects'

  // Reactive state
  const savedProjects = ref<SavedProject[]>([])

  // Load saved projects from localStorage into reactive state
  const loadSavedProjectsFromStorage = () => {
    try {
      const saved = localStorage.getItem(SAVED_PROJECTS_KEY)
      if (!saved) {
        savedProjects.value = []
        return
      }
      
      const projects: SavedProject[] = JSON.parse(saved)
      // Sort by last accessed (most recent first)
      savedProjects.value = projects.sort((a, b) => b.lastAccessed - a.lastAccessed)
    } catch (error) {
      console.error('Failed to load saved projects:', error)
      savedProjects.value = []
    }
  }

  // Save reactive saved projects to localStorage
  const saveSavedProjectsToStorage = () => {
    try {
      localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(savedProjects.value))
    } catch (error) {
      console.error('Failed to save projects to localStorage:', error)
    }
  }

  // Add project to saved list
  const addToSavedProjects = (projectName: string) => {
    try {
      // Work with the reactive array directly
      const existingIndex = savedProjects.value.findIndex((p: SavedProject) => p.name === projectName)
      
      if (existingIndex >= 0) {
        // Update last accessed time
        savedProjects.value[existingIndex].lastAccessed = Date.now()
      } else {
        // Add new project
        savedProjects.value.push({
          name: projectName,
          addedAt: Date.now(),
          lastAccessed: Date.now()
        })
      }
      
      // Sort by last accessed (most recent first)
      savedProjects.value.sort((a: SavedProject, b: SavedProject) => b.lastAccessed - a.lastAccessed)
      
      // Save to localStorage
      saveSavedProjectsToStorage()
      console.log(`Added project to saved list: ${projectName}`)
    } catch (error) {
      console.error('Failed to add project to saved list:', error)
    }
  }

  // Remove project from saved list
  const removeFromSavedProjects = (projectName: string) => {
    try {
      const index = savedProjects.value.findIndex((p: SavedProject) => p.name === projectName)
      if (index >= 0) {
        savedProjects.value.splice(index, 1)
        saveSavedProjectsToStorage()
        console.log(`Removed project from saved list: ${projectName}`)
      }
    } catch (error) {
      console.error('Failed to remove project from saved list:', error)
    }
  }

  // Check if there are any saved projects
  const hasSavedProjects = (): boolean => {
    if (!import.meta.client) return false
    return savedProjects.value.length > 0
  }

  // Switch to a different saved project
  const switchToProject = async (
    projectName: string,
    getProjectFromOPFS: (name: string) => Promise<FileSystemDirectoryHandle | null>,
    clearProjectState: () => void,
    setProjectState: (handle: FileSystemDirectoryHandle) => void,
    rebuildFileTree: (handle: FileSystemDirectoryHandle) => Promise<void>,
    autoLoadContextSets: (handle: FileSystemDirectoryHandle) => Promise<void>,
    saveLocalStorage: () => void
  ): Promise<boolean> => {
    console.log(`🔄 Switching to project: ${projectName}`)
    
    try {
      // Update last accessed time
      addToSavedProjects(projectName)
      
      // Try to load project from OPFS
      const opfsHandle = await getProjectFromOPFS(projectName)
      if (!opfsHandle) {
        console.error(`❌ Project not found in OPFS: ${projectName}`)
        return false
      }
      
      // Clear current state
      clearProjectState()
      
      // Set new folder
      setProjectState(opfsHandle)
      
      // Rebuild file tree from OPFS
      await rebuildFileTree(opfsHandle)
      
      // Load context sets from OPFS working copy
      await autoLoadContextSets(opfsHandle)
      
      // Save current state to localStorage
      saveLocalStorage()
      
      console.log(`✅ Successfully switched to project: ${projectName}`)
      return true
    } catch (error) {
      console.error(`❌ Failed to switch to project ${projectName}:`, error)
      return false
    }
  }

  // Reload files from local folder (file picker functionality)
  const reloadFilesFromLocal = async (
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandle | null>,
    getCurrentProjectName: () => string | null,
    setLoadingState: (loading: boolean) => void,
    setSelectedFolder: (handle: FileSystemDirectoryHandle) => void,
    readDirectoryRecursively: (handle: FileSystemDirectoryHandle) => Promise<any[]>,
    setFileTree: (files: any[]) => void,
    copyProjectToOPFS: (handle: FileSystemDirectoryHandle) => Promise<boolean>,
    autoLoadContextSets: (handle: FileSystemDirectoryHandle) => Promise<void>
  ): Promise<boolean> => {
    console.log('🔄 Starting file refresh from local folder...')
    
    try {
      // Show directory picker
      const directoryHandle = await showDirectoryPicker()
      if (!directoryHandle) {
        return false
      }
      
      console.log('Directory selected for refresh:', directoryHandle.name)
      
      // Check if this is the same project or a different one
      const currentProjectName = getCurrentProjectName()
      const newProjectName = directoryHandle.name
      
      if (currentProjectName && currentProjectName !== newProjectName) {
        console.warn(`⚠️ Selected folder "${newProjectName}" differs from current project "${currentProjectName}"`)
        // We'll proceed but this might be intentional (user wants to switch projects via refresh)
      }
      
      // Set loading state
      setLoadingState(true)
      
      // Update folder handle
      setSelectedFolder(directoryHandle)
      
      // Rebuild file tree
      const files = await readDirectoryRecursively(directoryHandle)
      setFileTree(files)
      
      // Copy to OPFS (this will overwrite existing if same project name)
      const copied = await copyProjectToOPFS(directoryHandle)
      if (copied) {
        console.log(`✅ Project files refreshed and copied to OPFS: ${newProjectName}`)
        
        // Add to saved projects if new
        addToSavedProjects(newProjectName)
      } else {
        console.warn('⚠️ Failed to copy refreshed files to OPFS, but continuing with regular functionality')
      }
      
      // If this is a different project, auto-load context sets
      if (currentProjectName !== newProjectName) {
        await autoLoadContextSets(directoryHandle)
      }
      
      console.log(`✅ File refresh completed for: ${newProjectName}`)
      return true
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('❌ Error refreshing files from local folder:', error)
      }
      return false
    } finally {
      setLoadingState(false)
    }
  }

  // Initialize saved projects on mount
  onMounted(() => {
    loadSavedProjectsFromStorage()
  })

  // Computed properties
  const sortedSavedProjects = computed(() => {
    return [...savedProjects.value].sort((a, b) => b.lastAccessed - a.lastAccessed)
  })

  const recentProjects = computed(() => {
    return sortedSavedProjects.value.slice(0, 5) // Show last 5 projects
  })

  return {
    // State
    savedProjects: readonly(savedProjects),
    
    // Computed
    sortedSavedProjects,
    recentProjects,
    
    // Actions
    loadSavedProjectsFromStorage,
    addToSavedProjects,
    removeFromSavedProjects,
    hasSavedProjects,
    switchToProject,
    reloadFilesFromLocal,
    
    // Internal utilities
    saveSavedProjectsToStorage
  }
}