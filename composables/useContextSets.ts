/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { logger } from '~/utils/logger'

export interface FileManifestEntry {
  path: string
  comment?: string
}

export interface FileIndexEntry {
  path: string
  contexts: string[]
}

export interface FunctionRef {
  name: string
  comment?: string
}

export interface FileRef {
  fileRef: string
  functionRefs?: FunctionRef[]
  comment?: string
  classification?: string
}

export interface Workflow {
  start: WorkflowPoint
  end: WorkflowPoint
}

export interface WorkflowPoint {
  fileRef: string
  function: string
  protocol?: 'http' | 'ui' | 'cli' | 'function' | 'queue' | 'file' | 'hook' | 'websocket' | 'sse'
  method?: string
  identifier?: string
}

export interface ContextSet {
  description?: string
  files: (string | FileRef)[]
  workflows: Workflow[]
  uses?: string[] // Array of child context names that this context uses
  systemBehavior?: {
    processing?: {
      mode?: 'synchronous' | 'asynchronous' | 'streaming' | 'batch'
    }
  }
}

export interface ContextSetsData {
  schemaVersion: string
  projectName?: string
  lastUpdated?: string
  filesIndex: Record<string, FileIndexEntry>
  sets: Record<string, ContextSet>
}

// Global state for context sets (shared across all instances)
const globalContextSets = ref<Record<string, ContextSet>>({})
const globalActiveContextSetName = ref<string | null>(null)
const globalFilesManifest = ref<Record<string, FileManifestEntry>>({})

export const useContextSets = () => {
  // Use global refs to ensure state sharing
  const contextSets = globalContextSets
  const activeContextSetName = globalActiveContextSetName
  const filesManifest = globalFilesManifest

  // Generate unique ID for files manifest
  const generateFileId = (): string => {
    // Generate a random 8-character alphanumeric string
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = 'file_'
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // Find existing file ID by path (without creating new entry)
  const findFileIdByPath = (filePath: string): string | null => {
    // Check if file already exists in manifest
    for (const [id, entry] of Object.entries(filesManifest.value)) {
      if (entry.path === filePath) {
        return id
      }
    }
    return null
  }

  // Get file ID by path (or create new entry)
  const getOrCreateFileId = (filePath: string): string => {
    // Check if file already exists in manifest
    for (const [id, entry] of Object.entries(filesManifest.value)) {
      if (entry.path === filePath) {
        return id
      }
    }
    
    // Create new file entry
    const newId = generateFileId()
    filesManifest.value[newId] = {
      path: filePath
    }
    
    return newId
  }

  // Create new context set
  const createContextSet = (name: string, description: string = ''): boolean => {
    if (contextSets.value[name]) {
      // Don't throw error, just return false for duplicates
      logger.warn(`Context set "${name}" already exists`)
      return false
    }
    
    const contextSet: ContextSet = {
      files: [],
      workflows: [],
      uses: []
    }
    
    // Only add description if it's not empty
    if (description && description.trim()) {
      contextSet.description = description
    }
    
    contextSets.value[name] = contextSet
    
    return true
  }

  // Set active context set
  const setActiveContextSet = (name: string | null) => {
    if (name && !contextSets.value[name]) {
      logger.warn(`Context set "${name}" does not exist`)
      return false
    }
    
    activeContextSetName.value = name
    return true
  }

  // Add file to active context set (and implicitly to files manifest)
  const addFileToActiveContextSet = (filePath: string, options?: {
    classification?: string
    comment?: string
    functionRefs?: FunctionRef[]
  }) => {
    if (!activeContextSetName.value) {
      throw new Error('No active context set selected')
    }
    
    const fileId = getOrCreateFileId(filePath)
    const activeSet = contextSets.value[activeContextSetName.value]
    
    // Check if file is already in this context set
    const alreadyIncluded = activeSet.files.some(fileEntry => {
      const entryId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
      return entryId === fileId
    })
    
    if (alreadyIncluded) {
      logger.warn('File already included in active context set:', filePath)
      return false
    }
    
    // Add file with metadata if provided, otherwise as simple string reference
    const cleanedFunctionRefs = options?.functionRefs ? cleanFunctionRefs(options.functionRefs) : undefined
    const hasNonEmptyFunctionRefs = cleanedFunctionRefs && cleanedFunctionRefs.length > 0
    
    if (options?.classification || (options?.comment && options.comment.trim()) || hasNonEmptyFunctionRefs) {
      const fileRef: FileRef = {
        fileRef: fileId,
        ...(options.classification && { classification: options.classification }),
        ...(options.comment && options.comment.trim() && { comment: options.comment }),
        ...(hasNonEmptyFunctionRefs && { functionRefs: cleanedFunctionRefs })
      }
      activeSet.files.push(fileRef)
    } else {
      // Add file as simple string reference (whole file)
      activeSet.files.push(fileId)
    }
    
    return true
  }

  // Remove file from active context set
  const removeFileFromActiveContextSet = (fileId: string) => {
    if (!activeContextSetName.value) {
      throw new Error('No active context set selected')
    }
    
    const activeSet = contextSets.value[activeContextSetName.value]
    const index = activeSet.files.findIndex(fileEntry => {
      const entryId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
      return entryId === fileId
    })
    
    if (index !== -1) {
      activeSet.files.splice(index, 1)
      
      // Clean up orphaned files after removal
      const orphanedCount = cleanupOrphanedFiles()
      if (orphanedCount > 0) {
      }
      
      return true
    }
    
    return false
  }

  // Update active context set details
  const updateActiveContextSet = (updates: { 
    name?: string, 
    description?: string, 
    workflows?: Workflow[],
    uses?: string[],
    systemBehavior?: { processing?: { mode?: 'synchronous' | 'asynchronous' | 'streaming' | 'batch' } } | null
  }) => {
    if (!activeContextSetName.value) {
      throw new Error('No active context set selected')
    }
    
    const currentName = activeContextSetName.value
    const currentSet = contextSets.value[currentName]
    
    // Handle name change
    if (updates.name && updates.name !== currentName) {
      if (contextSets.value[updates.name]) {
        throw new Error(`Context set "${updates.name}" already exists`)
      }
      
      // Create new entry with new name
      contextSets.value[updates.name] = { ...currentSet }
      
      // Update other fields if provided
      if (updates.description !== undefined) {
        contextSets.value[updates.name].description = updates.description
      }
      if (updates.workflows !== undefined) {
        contextSets.value[updates.name].workflows = [...updates.workflows]
      }
      if (updates.uses !== undefined) {
        contextSets.value[updates.name].uses = [...updates.uses]
      }
      if (updates.systemBehavior !== undefined) {
        if (updates.systemBehavior === null) {
          delete contextSets.value[updates.name].systemBehavior
        } else {
          contextSets.value[updates.name].systemBehavior = { ...updates.systemBehavior }
        }
      }
      
      // Remove old entry
      const { [currentName]: removed, ...rest } = contextSets.value
      contextSets.value = rest
      
      // Update active reference
      activeContextSetName.value = updates.name
      
    } else {
      // Just update fields
      if (updates.description !== undefined) {
        currentSet.description = updates.description
      }
      if (updates.workflows !== undefined) {
        currentSet.workflows = [...updates.workflows]
      }
      if (updates.uses !== undefined) {
        currentSet.uses = [...updates.uses]
      }
      if (updates.systemBehavior !== undefined) {
        if (updates.systemBehavior === null) {
          delete currentSet.systemBehavior
        } else {
          currentSet.systemBehavior = { ...updates.systemBehavior }
        }
      }
    }
  }

  // Helper function to check if a file is still referenced by any context sets
  const isFileReferencedByAnyContextSet = (fileId: string): boolean => {
    for (const set of Object.values(contextSets.value)) {
      for (const fileEntry of set.files) {
        const entryId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
        if (entryId === fileId) {
          return true
        }
      }
    }
    return false
  }

  // Helper function to clean up orphaned files from manifest
  const cleanupOrphanedFiles = (): number => {
    const orphanedFiles: string[] = []
    
    // Find files in manifest that are not referenced by any context set
    for (const fileId of Object.keys(filesManifest.value)) {
      if (!isFileReferencedByAnyContextSet(fileId)) {
        orphanedFiles.push(fileId)
      }
    }
    
    // Remove orphaned files from manifest using a new object
    if (orphanedFiles.length > 0) {
      const newManifest: Record<string, FileManifestEntry> = {}
      for (const [fileId, entry] of Object.entries(filesManifest.value)) {
        if (!orphanedFiles.includes(fileId)) {
          newManifest[fileId] = entry
        }
      }
      filesManifest.value = newManifest
      
    }
    
    return orphanedFiles.length
  }

  // Delete context set with proper cleanup
  const deleteContextSet = async (name: string) => {
    if (!contextSets.value[name]) {
      return false
    }
    
    // Get files referenced by the context set being deleted
    const contextSetToDelete = contextSets.value[name]
    const referencedFiles = contextSetToDelete.files.map(fileEntry => 
      typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
    )
    
    
    // Remove the context set
    const { [name]: removed, ...rest } = contextSets.value
    contextSets.value = rest
    
    // If this was the active set, clear active selection
    if (activeContextSetName.value === name) {
      activeContextSetName.value = null
    }
    
    // Clean up orphaned files from manifest
    const orphanedCount = cleanupOrphanedFiles()
    
    return true
  }

  // Update file comment in files manifest
  const updateFileComment = (fileId: string, comment: string) => {
    if (filesManifest.value[fileId]) {
      filesManifest.value[fileId].comment = comment
      return true
    }
    return false
  }

  // Generate files index
  const generateFilesIndex = (): Record<string, FileIndexEntry> => {
    const index: Record<string, FileIndexEntry> = {}
    
    // First, add all files that are referenced by context sets
    for (const [setName, set] of Object.entries(contextSets.value)) {
      for (const fileEntry of set.files) {
        const fileId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
        
        if (!filesManifest.value[fileId]) continue
        
        if (!index[fileId]) {
          index[fileId] = {
            path: filesManifest.value[fileId].path,
            contexts: []
          }
        }
        
        if (!index[fileId].contexts.includes(setName)) {
          index[fileId].contexts.push(setName)
        }
      }
    }
    
    return index
  }

  // Generate complete context sets JSON
  const generateContextSetsJSON = (projectName?: string, includeTimestamp?: boolean): ContextSetsData => {
    // Clean up context sets before exporting
    const cleanedSets: Record<string, ContextSet> = {}
    for (const [name, contextSet] of Object.entries(contextSets.value)) {
      cleanedSets[name] = cleanContextSet(contextSet)
    }
    
    return {
      schemaVersion: "1.0",
      ...(projectName && { projectName }),
      ...(includeTimestamp && { lastUpdated: new Date().toISOString() }),
      filesIndex: generateFilesIndex(),
      sets: cleanedSets
    }
  }

  // Helper function to clean up empty properties from objects
  const cleanEmptyProperties = <T extends Record<string, any>>(obj: T): T => {
    const cleaned = { ...obj }
    Object.keys(cleaned).forEach(key => {
      const value = cleaned[key]
      if (value === '' || value === undefined || value === null) {
        delete cleaned[key]
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) {
        delete cleaned[key]
      }
    })
    return cleaned
  }

  // Helper function to clean up function refs
  const cleanFunctionRefs = (functionRefs: FunctionRef[]): FunctionRef[] => {
    return functionRefs.map(ref => cleanEmptyProperties(ref))
  }

  // Helper function to clean up file refs
  const cleanFileRefs = (files: (string | FileRef)[]): (string | FileRef)[] => {
    return files.map(file => {
      if (typeof file === 'string') {
        return file
      }
      const cleaned = cleanEmptyProperties(file)
      if (cleaned.functionRefs) {
        cleaned.functionRefs = cleanFunctionRefs(cleaned.functionRefs)
        // Remove functionRefs if it becomes empty after cleaning
        if (cleaned.functionRefs.length === 0) {
          delete cleaned.functionRefs
        }
      }
      return cleaned
    })
  }

  // Helper function to clean up context sets
  const cleanContextSet = (contextSet: ContextSet): ContextSet => {
    const cleaned = cleanEmptyProperties(contextSet)
    if (cleaned.files) {
      cleaned.files = cleanFileRefs(cleaned.files)
    }
    return cleaned
  }

  // Generate context sets JSON with 'context:' prefix for export/preview
  const generateContextSetsJSONWithPrefix = (projectName?: string, includeTimestamp?: boolean): ContextSetsData => {
    const baseData = generateContextSetsJSON(projectName, includeTimestamp)
    
    // Transform context set names to have 'context:' prefix
    const prefixedSets: Record<string, ContextSet> = {}
    for (const [name, contextSet] of Object.entries(baseData.sets)) {
      const prefixedName = name.startsWith('context:') ? name : `context:${name}`
      const cleanedContextSet = cleanContextSet({
        ...contextSet,
        // Also update the 'uses' array to have prefixed names
        uses: contextSet.uses?.filter(use => use.trim()).map(usedName => 
          usedName.startsWith('context:') ? usedName : `context:${usedName}`
        ) || []
      })
      
      prefixedSets[prefixedName] = cleanedContextSet
    }
    
    // Update filesIndex to reference prefixed context names
    const prefixedFilesIndex: Record<string, FileIndexEntry> = {}
    for (const [fileId, fileIndex] of Object.entries(baseData.filesIndex)) {
      prefixedFilesIndex[fileId] = {
        ...fileIndex,
        contexts: fileIndex.contexts.map(contextName => 
          contextName.startsWith('context:') ? contextName : `context:${contextName}`
        )
      }
    }
    
    return {
      ...baseData,
      sets: prefixedSets,
      filesIndex: prefixedFilesIndex
    }
  }

  // Load context sets from JSON data
  const loadContextSetsData = (data: ContextSetsData) => {
    // First, load context sets from either new 'sets' or legacy 'contextSets' format
    if (data.sets) {
      contextSets.value = { ...data.sets }
    } else if ((data as any).contextSets) {
      // Legacy format support
      contextSets.value = { ...(data as any).contextSets }
    }
    
    // Convert filesIndex to filesManifest for internal use
    // We still use filesManifest internally but generate filesIndex on export
    const newFilesManifest: Record<string, FileManifestEntry> = {}
    
    if (data.filesIndex) {
      // New format with filesIndex
      for (const [fileId, fileIndex] of Object.entries(data.filesIndex)) {
        newFilesManifest[fileId] = {
          path: fileIndex.path
        }
      }
    } else if ((data as any).filesManifest) {
      // Legacy format support
      const legacyData = data as any
      const referencedFileIds = new Set<string>()
      
      // Collect all file IDs that are actually used in context sets
      for (const contextSet of Object.values(contextSets.value)) {
        for (const fileEntry of contextSet.files) {
          const fileId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
          referencedFileIds.add(fileId)
        }
      }
      
      // Only import files that are actually referenced
      for (const fileId of referencedFileIds) {
        if (legacyData.filesManifest[fileId]) {
          newFilesManifest[fileId] = legacyData.filesManifest[fileId]
        }
      }
    }
    
    filesManifest.value = newFilesManifest
    
    // Clean up any orphaned files (though there shouldn't be any now)
    const orphanedCount = cleanupOrphanedFiles()
    if (orphanedCount > 0) {
    }
    
    // Try to restore last selected context set from localStorage, fallback to first available
    const setNames = Object.keys(contextSets.value)
    if (setNames.length > 0) {
      let selectedSet = setNames[0] // Default to first
      
      // Try to restore from localStorage
      if (typeof window !== 'undefined') {
        try {
          const lastSelected = localStorage.getItem('contextmax-last-context-set')
          if (lastSelected && setNames.includes(lastSelected)) {
            selectedSet = lastSelected
          }
        } catch (error) {
          logger.warn('Failed to read last context set from localStorage:', error)
        }
      }
      
      activeContextSetName.value = selectedSet
    }
    
  }

  // Clear all context sets and files
  const clearAll = () => {
    contextSets.value = {}
    activeContextSetName.value = null
    filesManifest.value = {}
  }

  // Helper functions for testing
  const setFilesManifestForTesting = (manifest: Record<string, FileManifestEntry>) => {
    filesManifest.value = { ...manifest }
  }

  const addFileToManifestForTesting = (fileId: string, entry: FileManifestEntry) => {
    filesManifest.value[fileId] = entry
  }

  // Computed properties
  const activeContextSet = computed(() => {
    if (!activeContextSetName.value || !contextSets.value[activeContextSetName.value]) {
      return null
    }
    return {
      name: activeContextSetName.value,
      ...contextSets.value[activeContextSetName.value]
    }
  })

  const contextSetNames = computed(() => Object.keys(contextSets.value))

  const hasContextSets = computed(() => Object.keys(contextSets.value).length > 0)

  return {
    // State (reactive refs)
    contextSets: readonly(contextSets),
    activeContextSetName: readonly(activeContextSetName),
    filesManifest: readonly(filesManifest),

    // Computed properties
    activeContextSet,
    contextSetNames,
    hasContextSets,

    // Context set operations
    createContextSet,
    setActiveContextSet,
    updateActiveContextSet,
    deleteContextSet,

    // File operations
    addFileToActiveContextSet,
    removeFileFromActiveContextSet,
    updateFileComment,

    // File manifest utilities
    generateFileId,
    findFileIdByPath,
    getOrCreateFileId,
    cleanupOrphanedFiles,
    isFileReferencedByAnyContextSet,

    // JSON operations
    generateContextSetsJSON,
    generateContextSetsJSONWithPrefix,
    loadContextSetsData,
    generateFilesIndex,
    generateFileContextsIndex: generateFilesIndex, // Alias for backward compatibility

    // Utility operations
    clearAll,

    // Testing helpers
    setFilesManifestForTesting,
    addFileToManifestForTesting
  }
}