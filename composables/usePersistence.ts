/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { logger } from '~/utils/logger'

export interface FileSystemDirectoryHandleWithPermission extends FileSystemDirectoryHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

// Serializable project state for localStorage (UI preferences only)
export interface SerializableProjectState {
  selectedFolderName: string | null
  fileTree: Omit<any, 'handle'>[] // Store complete file tree structure without handles
  timestamp: number
  hasOPFSCopy: boolean // Track if we have an OPFS copy
  opfsProjectPath: string | null // Path to the project in OPFS
  // Note: filesManifest and contextSets are now stored in OPFS, not localStorage
}

export const usePersistence = () => {
  // LocalStorage keys
  const STORAGE_KEY = 'contextmax-project-state'

  // Save state to localStorage
  const saveToLocalStorage = (state: {
    selectedFolderName: string | null
    fileTree: any[]
    hasOPFSCopy: boolean
    opfsProjectPath: string | null
  }) => {
    try {
      const serializableState: SerializableProjectState = {
        selectedFolderName: state.selectedFolderName,
        fileTree: state.fileTree,
        timestamp: Date.now(),
        hasOPFSCopy: state.hasOPFSCopy,
        opfsProjectPath: state.opfsProjectPath
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState))
    } catch (error) {
      logger.error('Failed to save project state to localStorage:', error)
    }
  }

  // Load state from localStorage
  const loadFromLocalStorage = (): SerializableProjectState | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return null
      }

      const state: SerializableProjectState = JSON.parse(stored)
      
      return state
    } catch (error) {
      logger.error('Failed to load project metadata from localStorage:', error)
      return null
    }
  }

  // Clear localStorage
  const clearLocalStorage = () => {
    localStorage.removeItem(STORAGE_KEY)
  }

  // Check if there's saved data
  const hasSavedData = (): boolean => {
    if (!import.meta.client) return false // Only check on client side
    return localStorage.getItem(STORAGE_KEY) !== null
  }

  // Get saved project name
  const getSavedProjectName = (): string | null => {
    if (!import.meta.client) return null // Only check on client side
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return null
      const state: SerializableProjectState = JSON.parse(stored)
      return state.selectedFolderName
    } catch {
      return null
    }
  }

  // Helper to count nodes in tree
  const countNodes = (tree: any[]): number => {
    let count = 0
    const traverse = (items: any[]) => {
      for (const item of items) {
        count++
        if (item.children) {
          traverse(item.children)
        }
      }
    }
    traverse(tree)
    return count
  }

  // Export working copy to stable version in project folder
  const exportToProjectFolder = async (
    selectedFolder: FileSystemDirectoryHandle | null,
    contextSetsData: any
  ): Promise<{ success: boolean, error?: string, warning?: string }> => {
    if (!selectedFolder) {
      return { success: false, error: 'No project folder selected' }
    }

    if (Object.keys(contextSetsData.contextSets || {}).length === 0) {
      return { success: false, error: 'No context sets to export' }
    }

    try {
      // Check if File System Access API is supported
      if (!('showDirectoryPicker' in window)) {
        // Fallback to regular download if API not supported
        const jsonContent = JSON.stringify(contextSetsData, null, 2)
        const blob = new Blob([jsonContent], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'context-sets.json'
        a.click()
        URL.revokeObjectURL(url)
        return { 
          success: true, 
          warning: 'File saved to Downloads folder (browser API not supported)' 
        }
      }

      // Check if we have write permissions
      const permissionStatus = await (selectedFolder as FileSystemDirectoryHandleWithPermission).queryPermission({ mode: 'readwrite' })
      if (permissionStatus !== 'granted') {
        // Request write permission
        const newPermissionStatus = await (selectedFolder as FileSystemDirectoryHandleWithPermission).requestPermission({ mode: 'readwrite' })
        if (newPermissionStatus !== 'granted') {
          // Fallback to regular download if permission not granted
          const jsonContent = JSON.stringify(contextSetsData, null, 2)
          const blob = new Blob([jsonContent], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'context-sets.json'
          a.click()
          URL.revokeObjectURL(url)
          return { 
            success: true, 
            warning: 'File saved to Downloads folder (write permission not granted)' 
          }
        }
      }

      // Generate the context sets JSON data
      const jsonContent = JSON.stringify(contextSetsData, null, 2)

      // Try to write the file to the project directory
      const fileHandle = await selectedFolder.getFileHandle('context-sets.json', { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(jsonContent)
      await writable.close()

      return { success: true }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        // Fallback to regular download if permission error
        try {
          const jsonContent = JSON.stringify(contextSetsData, null, 2)
          const blob = new Blob([jsonContent], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'context-sets.json'
          a.click()
          URL.revokeObjectURL(url)
          return { 
            success: true, 
            warning: 'File saved to Downloads folder (permission denied)' 
          }
        } catch (downloadError) {
          return { 
            success: false, 
            error: 'Failed to export file: Permission denied and download fallback failed' 
          }
        }
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        return { 
          success: false, 
          error: 'Export cancelled by user.' 
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.error('❌ Failed to export context sets to project folder:', error)
        return { 
          success: false, 
          error: `Failed to export: ${errorMessage}` 
        }
      }
    }
  }

  // Check if stable version exists in project folder
  const hasStableVersionInProject = async (selectedFolder: FileSystemDirectoryHandle | null): Promise<boolean> => {
    if (!selectedFolder) {
      return false
    }

    try {
      await selectedFolder.getFileHandle('context-sets.json')
      return true
    } catch {
      return false
    }
  }

  // Helper function to load stable version from project folder
  const tryLoadStableVersionFromProject = async (directoryHandle: FileSystemDirectoryHandle): Promise<any | null> => {
    try {
      const fileHandle = await directoryHandle.getFileHandle('context-sets.json')
      const file = await fileHandle.getFile()
      const content = await file.text()
      const data = JSON.parse(content)
      
      return data
    } catch {
      return null
    }
  }

  // Get metadata about working copy vs stable version
  const getExportStatus = async (
    selectedFolder: FileSystemDirectoryHandle | null,
    hasWorkingCopy: boolean,
    getContextSetsMetadata: (projectName: string) => Promise<unknown | null>
  ): Promise<{
    hasWorkingCopy: boolean
    hasStableVersion: boolean
    workingCopyMetadata?: unknown
    canExport: boolean
  }> => {
    const hasStableVersion = await hasStableVersionInProject(selectedFolder)
    
    let workingCopyMetadata: unknown = null
    if (hasWorkingCopy && selectedFolder) {
      workingCopyMetadata = await getContextSetsMetadata(selectedFolder.name)
    }

    return {
      hasWorkingCopy,
      hasStableVersion,
      workingCopyMetadata,
      canExport: hasWorkingCopy && selectedFolder !== null
    }
  }

  // Preview context sets JSON
  const previewContextSetsJSON = (contextSetsData: any): { content: string; fileName: string } | null => {
    if (Object.keys(contextSetsData.contextSets || {}).length === 0) {
      if (import.meta.client) {
        const { warning } = useNotifications()
        warning('No Content', 'There are no context sets to preview.')
      } else {
        logger.warn('No context sets to preview.')
      }
      return null
    }

    try {
      const jsonString = JSON.stringify(contextSetsData, null, 2)
      return {
        content: jsonString,
        fileName: 'context-sets.json (Preview)'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (import.meta.client) {
        const { errorWithRetry } = useNotifications()
        errorWithRetry('Preview Failed', `Could not generate JSON preview: ${message}`, () => previewContextSetsJSON(contextSetsData))
      } else {
        logger.error('Error generating context sets JSON for preview:', error)
      }
      return null
    }
  }

  return {
    // LocalStorage operations
    saveToLocalStorage,
    loadFromLocalStorage,
    clearLocalStorage,
    hasSavedData,
    getSavedProjectName,

    // Export/Import operations
    exportToProjectFolder,
    hasStableVersionInProject,
    tryLoadStableVersionFromProject,
    getExportStatus,
    previewContextSetsJSON,

    // Utility
    countNodes
  }
}