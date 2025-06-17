/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export interface FileManifestEntry {
  path: string
  comment: string
}

export interface FunctionRef {
  name: string
  comment?: string
}

export interface FileRef {
  fileRef: string
  functionRefs?: FunctionRef[]
  comment?: string
}

export interface WorkflowStep {
  fileRefs: string[]
  description: string
}

export interface EntryPoint {
  fileRef: string
  function: string
  protocol: 'http' | 'ui' | 'cli' | 'function' | 'queue' | 'file' | 'hook' | 'websocket' | 'sse'
  method: string
  identifier: string
}

export interface ContextSet {
  description: string
  files: (string | FileRef)[]
  workflow: WorkflowStep[]
  entryPoints?: EntryPoint[]
  systemBehavior?: {
    processing?: {
      mode?: 'synchronous' | 'asynchronous' | 'streaming' | 'batch'
    }
  }
}

export interface ContextSetsData {
  schemaVersion: string
  filesManifest: Record<string, FileManifestEntry>
  contextSets: Record<string, ContextSet>
  fileContextsIndex: Record<string, Array<{ setName: string, functionRefs?: FunctionRef[] }>>
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
      path: filePath,
      comment: ''
    }
    
    console.log('Auto-created new file manifest entry:', { id: newId, path: filePath })
    return newId
  }

  // Create new context set
  const createContextSet = (name: string, description: string = '') => {
    if (contextSets.value[name]) {
      // Don't throw error, just return silently for duplicates
      return
    }
    
    contextSets.value[name] = {
      description,
      files: [],
      workflow: []
    }
    
    console.log(`Created new context set: ${name}`)
  }

  // Set active context set
  const setActiveContextSet = (name: string | null) => {
    if (name && !contextSets.value[name]) {
      console.warn(`Context set "${name}" does not exist`)
      return false
    }
    
    activeContextSetName.value = name
    console.log('Set active context set:', name)
    return true
  }

  // Add file to active context set (and implicitly to files manifest)
  const addFileToActiveContextSet = (filePath: string) => {
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
      console.warn('File already included in active context set:', filePath)
      return false
    }
    
    // Add file as simple string reference (whole file)
    activeSet.files.push(fileId)
    
    console.log('Added file to active context set:', { file: filePath, setName: activeContextSetName.value })
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
      console.log('Removed file from active context set:', { fileId, setName: activeContextSetName.value })
      
      // Clean up orphaned files after removal
      const orphanedCount = cleanupOrphanedFiles()
      if (orphanedCount > 0) {
        console.log(`Cleaned up ${orphanedCount} orphaned files after removal`)
      }
      
      return true
    }
    
    return false
  }

  // Update active context set details
  const updateActiveContextSet = (updates: { 
    name?: string, 
    description?: string, 
    workflow?: WorkflowStep[], 
    entryPoints?: EntryPoint[],
    systemBehavior?: { processing?: { mode?: 'synchronous' | 'asynchronous' | 'streaming' | 'batch' } }
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
      if (updates.workflow !== undefined) {
        contextSets.value[updates.name].workflow = [...updates.workflow]
      }
      if (updates.entryPoints !== undefined) {
        contextSets.value[updates.name].entryPoints = [...updates.entryPoints]
      }
      if (updates.systemBehavior !== undefined) {
        contextSets.value[updates.name].systemBehavior = { ...updates.systemBehavior }
      }
      
      // Remove old entry
      const { [currentName]: removed, ...rest } = contextSets.value
      contextSets.value = rest
      
      // Update active reference
      activeContextSetName.value = updates.name
      
      console.log('Renamed context set:', { from: currentName, to: updates.name })
    } else {
      // Just update fields
      if (updates.description !== undefined) {
        currentSet.description = updates.description
      }
      if (updates.workflow !== undefined) {
        currentSet.workflow = [...updates.workflow]
      }
      if (updates.entryPoints !== undefined) {
        currentSet.entryPoints = [...updates.entryPoints]
      }
      if (updates.systemBehavior !== undefined) {
        currentSet.systemBehavior = { ...updates.systemBehavior }
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
      
      console.log('Cleaned up orphaned files from manifest:', orphanedFiles)
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
    
    console.log('Deleting context set:', name, 'with referenced files:', referencedFiles)
    
    // Remove the context set
    const { [name]: removed, ...rest } = contextSets.value
    contextSets.value = rest
    
    // If this was the active set, clear active selection
    if (activeContextSetName.value === name) {
      activeContextSetName.value = null
    }
    
    // Clean up orphaned files from manifest
    const orphanedCount = cleanupOrphanedFiles()
    
    console.log('Deleted context set:', name, `- cleaned up ${orphanedCount} orphaned files`)
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

  // Generate file contexts index
  const generateFileContextsIndex = (): Record<string, Array<{ setName: string, functionRefs?: FunctionRef[] }>> => {
    const index: Record<string, Array<{ setName: string, functionRefs?: FunctionRef[] }>> = {}
    
    for (const [setName, set] of Object.entries(contextSets.value)) {
      for (const fileEntry of set.files) {
        const fileId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
        
        if (!filesManifest.value[fileId]) continue
        
        if (!index[fileId]) {
          index[fileId] = []
        }
        
        const contextReference: { setName: string, functionRefs?: FunctionRef[] } = { setName }
        
        if (typeof fileEntry === 'object' && fileEntry.functionRefs) {
          contextReference.functionRefs = fileEntry.functionRefs
        }
        
        index[fileId].push(contextReference)
      }
    }
    
    return index
  }

  // Generate complete context sets JSON
  const generateContextSetsJSON = (): ContextSetsData => {
    return {
      schemaVersion: "1.0",
      filesManifest: { ...filesManifest.value },
      contextSets: { ...contextSets.value },
      fileContextsIndex: generateFileContextsIndex()
    }
  }

  // Load context sets from JSON data
  const loadContextSetsData = (data: ContextSetsData) => {
    // First, load context sets
    contextSets.value = { ...data.contextSets }
    
    // Then, only import files that are actually referenced by the loaded context sets
    const referencedFileIds = new Set<string>()
    
    // Collect all file IDs that are actually used in context sets
    for (const contextSet of Object.values(contextSets.value)) {
      for (const fileEntry of contextSet.files) {
        const fileId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
        referencedFileIds.add(fileId)
      }
    }
    
    // Only import files that are actually referenced
    const filteredFilesManifest: Record<string, FileManifestEntry> = {}
    for (const fileId of referencedFileIds) {
      if (data.filesManifest[fileId]) {
        filteredFilesManifest[fileId] = data.filesManifest[fileId]
      }
    }
    
    filesManifest.value = filteredFilesManifest
    
    console.log('Loaded context sets data with filtered manifest:', { 
      totalFilesInJSON: Object.keys(data.filesManifest).length,
      actuallyReferencedFiles: Object.keys(filteredFilesManifest).length,
      contextSetsCount: Object.keys(contextSets.value).length
    })
    
    // Clean up any orphaned files (though there shouldn't be any now)
    const orphanedCount = cleanupOrphanedFiles()
    if (orphanedCount > 0) {
      console.log(`Cleaned up ${orphanedCount} orphaned files after loading data`)
    }
    
    // Set first context set as active if any exist
    const setNames = Object.keys(contextSets.value)
    if (setNames.length > 0) {
      activeContextSetName.value = setNames[0]
    }
    
    console.log('Final loaded state:', { 
      filesCount: Object.keys(filesManifest.value).length,
      contextSetsCount: setNames.length,
      activeSet: activeContextSetName.value
    })
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
    loadContextSetsData,
    generateFileContextsIndex,

    // Utility operations
    clearAll,

    // Testing helpers
    setFilesManifestForTesting,
    addFileToManifestForTesting
  }
}