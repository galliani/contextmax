/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import type { FileTreeItem } from '~/composables/useFileSystem'

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
    readDirectoryRecursively,
    isFileSystemSupported
  } = useProjectStore()

  const { trackProjectSelection, trackProjectRestored } = useAnalyticsHelpers()
  const { success } = useNotifications()
  const { performHybridAnalysis } = useHybridAnalysis()
  const { createProjectLoadingManager } = useLoadingStates()

  // Create project loading manager
  const projectLoading = createProjectLoadingManager()

  const autoLoadedFromProject = ref(false)
  const autoLoadError = ref('')

  function resetState() {
    autoLoadedFromProject.value = false
    autoLoadError.value = ''
  }
  
  async function loadProjectFiles(directoryHandle: FileSystemDirectoryHandle, hadSavedDataBefore: boolean) {
    projectLoading.startFileLoading()
    autoLoadedFromProject.value = false
    autoLoadError.value = ''
    
    try {
      // Only try to auto-load context-sets.json if we don't already have saved data
      if (!hadSavedDataBefore) {
        console.log('Attempting to auto-load context-sets.json...')
        const autoLoaded = await autoLoadContextSetsFromProject(directoryHandle)
        if (autoLoaded) {
          autoLoadedFromProject.value = true
          console.log('Successfully auto-loaded existing context-sets.json')
        }
      } else {
        console.log('Skipping auto-load from project file - using saved localStorage data')
      }
      
      // Always load the file tree to enable file browsing
      const files = await readDirectoryRecursively(directoryHandle, '')
      setFileTree(files)
      
      // Copy to OPFS for persistent access (always try if OPFS is supported and we don't have a copy)
      if (isOPFSAvailable()) {
        const projectName = directoryHandle.name
        let shouldCopyToOPFS = false
        
        if (!hadSavedDataBefore) {
          // Fresh project selection - always copy
          shouldCopyToOPFS = true
          console.log('Copying new project to OPFS for persistent access...')
        } else {
          // Reconnecting to existing project - check if OPFS copy exists
          try {
            const opfsProjects = await getOPFSProjects()
            const hasOPFSCopy = opfsProjects.includes(projectName)
            if (!hasOPFSCopy) {
              shouldCopyToOPFS = true
              console.log('No OPFS copy found for existing project, creating one...')
            } else {
              console.log('OPFS copy already exists for project, skipping copy')
            }
          } catch (error) {
            console.warn('Failed to check OPFS projects, will attempt copy anyway:', error)
            shouldCopyToOPFS = true
          }
        }
        
        if (shouldCopyToOPFS) {
          try {
            const copied = await copyProjectToOPFS(directoryHandle)
            if (copied) {
              console.log('Project successfully copied to OPFS')
              
              // Auto-trigger hybrid analysis for new projects
              try {
                console.log('🚀 Auto-triggering hybrid analysis for new project...')
                const analysisResult = await performHybridAnalysis(files, { silent: false })
                if (analysisResult.success) {
                  console.log('✅ Automatic hybrid analysis completed successfully')
                } else {
                  console.warn('⚠️ Automatic hybrid analysis failed, but continuing')
                }
              } catch (error) {
                console.warn('⚠️ Error during automatic hybrid analysis:', error)
              }
            } else {
              console.warn('Failed to copy project to OPFS, but continuing with regular functionality')
            }
          } catch (error) {
            console.warn('OPFS copy failed, but continuing with regular functionality:', error)
          }
        }
      }
      
      // If we restored from localStorage, show success message
      if (hadSavedDataBefore) {
        success(
          'Project Restored Successfully',
          `Your project "${directoryHandle.name}" has been reconnected with your saved work.`
        )
        
        // Track project restoration
        trackProjectRestored(directoryHandle.name)
      }
    } catch (error) {
      console.error('Error loading project:', error)
      if (error instanceof Error) {
        autoLoadError.value = error.message
      }
      setFileTree([])
    } finally {
      projectLoading.stopFileLoading()
    }
  }

  async function selectProjectFolder() {
    console.log('selectProjectFolder called (Add Project), isFileSystemSupported:', isFileSystemSupported.value)

    if (!isFileSystemSupported.value) {
      console.log('File System Access API not supported')
      return
    }

    try {
      console.log('Calling showDirectoryPicker for new project...')
      
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      })
      
      console.log('Directory selected for new project:', directoryHandle)
      
      // Track successful project selection
      trackProjectSelection()
      
      setSelectedFolder(directoryHandle)
      await loadProjectFiles(directoryHandle, false) // Always treat as fresh selection
      
      console.log('✅ New project added successfully - navigating to workspace')
      goToWorkspace()
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error selecting folder for new project:', error)
        // Clear auto-detection state on error
        resetState()
        // TODO: Show user-friendly error message
      }
    }
  }

  return {
    isFileSystemSupported,
    autoLoadedFromProject,
    autoLoadError,
    selectProjectFolder,
    resetState
  }
} 