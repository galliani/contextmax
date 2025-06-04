export interface FileTreeItem {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeItem[]
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle
}

export interface FileManifestEntry {
  path: string
  comment: string
}

export interface LineRange {
  start: number
  end: number
  comment?: string
}

export interface FileRef {
  fileRef: string
  lineRanges?: LineRange[]
  comment?: string
}

export interface WorkflowStep {
  fileRefs: string[]
  description: string
}

export interface ContextSet {
  description: string
  files: (string | FileRef)[]
  workflow: WorkflowStep[]
}

export interface ContextSetsData {
  schemaVersion: string
  filesManifest: Record<string, FileManifestEntry>
  contextSets: Record<string, ContextSet>
  fileContextsIndex: Record<string, Array<{ setName: string, lineRanges?: LineRange[] }>>
}

// Serializable project state for localStorage
export interface SerializableProjectState {
  selectedFolderName: string | null
  fileTree: Omit<FileTreeItem, 'handle'>[] // Store complete file tree structure
  filesManifest: Record<string, FileManifestEntry>
  contextSets: Record<string, ContextSet>
  activeContextSetName: string | null
  timestamp: number
  hasOPFSCopy: boolean // Track if we have an OPFS copy
  opfsProjectPath: string | null // Path to the project in OPFS
}

// View states for navigation
export type AppView = 'landing' | 'workspace'

// Global reactive state
const globalState = reactive({
  // View management
  currentView: 'landing' as AppView,
  
  // Project state
  selectedFolder: null as FileSystemDirectoryHandle | null,
  fileTree: [] as FileTreeItem[],
  isLoadingFiles: false,
  
  // Files Manifest (ID-based)
  filesManifest: {} as Record<string, FileManifestEntry>,
  
  // Context Sets
  contextSets: {} as Record<string, ContextSet>,
  
  // NEW: Active context set state
  activeContextSetName: null as string | null,
  
  // File content modal state
  currentFileContent: '',
  currentFileName: '',
  isFileContentModalOpen: false,
  
  // Track if file tree has handles or is restored from localStorage
  hasActiveHandles: false,
  
  // Track if OPFS restoration has been attempted to prevent duplicates
  opfsRestorationAttempted: false,
  
  // Track if the current project has been successfully copied to OPFS
  hasSuccessfulOPFSCopy: false,
  
  // OPFS loading state
  isOPFSCopying: false,
  opfsCopyProgress: 0,
  opfsCopyingProjectName: null as string | null,
  
  // Track if initial load has been attempted to prevent multiple calls
  hasInitializedFromStorage: false
})

// OPFS support detection and utilities
const isOPFSSupported = () => {
  return typeof window !== 'undefined' && 'navigator' in window && 'storage' in navigator && 'getDirectory' in navigator.storage
}

// OPFS project manager
class OPFSProjectManager {
  private projectsDir: FileSystemDirectoryHandle | null = null
  
  async initialize() {
    if (!isOPFSSupported()) {
      console.warn('OPFS not supported in this browser')
      return false
    }
    
    try {
      const opfsRoot = await navigator.storage.getDirectory()
      this.projectsDir = await opfsRoot.getDirectoryHandle('contextmax-projects', { create: true })
      console.log('OPFS initialized successfully')
      return true
    } catch (error) {
      console.error('Failed to initialize OPFS:', error)
      return false
    }
  }
  
  async copyProjectToOPFS(sourceHandle: FileSystemDirectoryHandle, projectName: string, onProgress?: (progress: number) => void): Promise<string | null> {
    if (!this.projectsDir) {
      await this.initialize()
      if (!this.projectsDir) return null
    }
    
    try {
      // Create or get project directory
      const projectDir = await this.projectsDir.getDirectoryHandle(projectName, { create: true })
      
      // Count total files first for progress tracking
      const totalFiles = await this.countFilesRecursive(sourceHandle)
      let copiedFiles = 0
      
      // Copy all files recursively with progress tracking
      await this.copyDirectoryRecursive(sourceHandle, projectDir, () => {
        copiedFiles++
        const progress = Math.round((copiedFiles / totalFiles) * 100)
        onProgress?.(progress)
      })
      
      console.log(`Project "${projectName}" copied to OPFS successfully`)
      return projectName
    } catch (error) {
      console.error('Failed to copy project to OPFS:', error)
      return null
    }
  }
  
  private async countFilesRecursive(directoryHandle: FileSystemDirectoryHandle): Promise<number> {
    const ignorePatterns = [
      'node_modules', '.nuxt', 'dist', 'build', '.next', '.svelte-kit', 
      'target', 'vendor', 'Thumbs.db', '.git', '.DS_Store'
    ]
    
    let count = 0
    
    for await (const [name, handle] of directoryHandle.entries()) {
      // Skip hidden files and ignored patterns
      if (name.startsWith('.') || ignorePatterns.some(pattern => name.includes(pattern))) {
        continue
      }
      
      if (handle.kind === 'file') {
        count++
      } else if (handle.kind === 'directory') {
        count += await this.countFilesRecursive(handle as FileSystemDirectoryHandle)
      }
    }
    
    return count
  }
  
  private async copyDirectoryRecursive(source: FileSystemDirectoryHandle, target: FileSystemDirectoryHandle, onFileComplete?: () => void) {
    const ignorePatterns = [
      'node_modules', '.nuxt', 'dist', 'build', '.next', '.svelte-kit', 
      'target', 'vendor', 'Thumbs.db', '.git', '.DS_Store'
    ]
    
    for await (const [name, handle] of source.entries()) {
      // Skip hidden files and ignored patterns
      if (name.startsWith('.') || ignorePatterns.some(pattern => name.includes(pattern))) {
        continue
      }
      
      try {
        if (handle.kind === 'directory') {
          const targetDir = await target.getDirectoryHandle(name, { create: true })
          await this.copyDirectoryRecursive(handle as FileSystemDirectoryHandle, targetDir, onFileComplete)
        } else {
          const file = await (handle as FileSystemFileHandle).getFile()
          const targetFile = await target.getFileHandle(name, { create: true })
          const writable = await targetFile.createWritable()
          await writable.write(file)
          await writable.close()
          onFileComplete?.()
        }
      } catch (error) {
        console.warn(`Failed to copy ${name}:`, error)
        // Continue with other files
      }
    }
  }
  
  async getProjectFromOPFS(projectName: string): Promise<FileSystemDirectoryHandle | null> {
    if (!this.projectsDir) {
      await this.initialize()
      if (!this.projectsDir) return null
    }
    
    try {
      return await this.projectsDir.getDirectoryHandle(projectName)
    } catch (error) {
      console.warn(`Project "${projectName}" not found in OPFS:`, error)
      return null
    }
  }
  
  async deleteProjectFromOPFS(projectName: string): Promise<boolean> {
    if (!this.projectsDir) return false
    
    try {
      await this.projectsDir.removeEntry(projectName, { recursive: true })
      console.log(`Project "${projectName}" deleted from OPFS`)
      return true
    } catch (error) {
      console.error(`Failed to delete project "${projectName}" from OPFS:`, error)
      return false
    }
  }
  
  async listOPFSProjects(): Promise<string[]> {
    if (!this.projectsDir) {
      await this.initialize()
      if (!this.projectsDir) return []
    }
    
    const projects: string[] = []
    try {
      for await (const [name] of this.projectsDir.entries()) {
        projects.push(name)
      }
    } catch (error) {
      console.error('Failed to list OPFS projects:', error)
    }
    
    return projects
  }
}

// Create global OPFS manager instance
const opfsManager = new OPFSProjectManager()

export const useProjectStore = () => {
  // LocalStorage key
  const STORAGE_KEY = 'contextmax-project-state'

  // Save state to localStorage
  const saveToLocalStorage = () => {
    try {
      const serializableState: SerializableProjectState = {
        selectedFolderName: globalState.selectedFolder?.name || null,
        fileTree: globalState.fileTree.map(item => removeHandles(item)),
        filesManifest: { ...globalState.filesManifest },
        contextSets: { ...globalState.contextSets },
        activeContextSetName: globalState.activeContextSetName,
        timestamp: Date.now(),
        hasOPFSCopy: globalState.hasSuccessfulOPFSCopy,
        opfsProjectPath: globalState.selectedFolder?.name || null
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState))
      console.log('Project state saved to localStorage', {
        folderName: serializableState.selectedFolderName,
        filesCount: Object.keys(serializableState.filesManifest).length,
        fileTreeNodes: countFileTreeNodes(serializableState.fileTree),
        contextSetsCount: Object.keys(serializableState.contextSets).length,
        hasOPFSCopy: serializableState.hasOPFSCopy
      })
    } catch (error) {
      console.error('Failed to save project state to localStorage:', error)
    }
  }

  // Load state from localStorage
  const loadFromLocalStorage = (): boolean => {
    // Prevent multiple initializations
    if (globalState.hasInitializedFromStorage) {
      console.log('Project store already initialized from localStorage, skipping...')
      return true
    }
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        globalState.hasInitializedFromStorage = true
        return false
      }

      const state: SerializableProjectState = JSON.parse(stored)
      
      // Restore state
      globalState.fileTree = state.fileTree as FileTreeItem[]
      globalState.filesManifest = state.filesManifest
      globalState.contextSets = state.contextSets
      globalState.activeContextSetName = state.activeContextSetName
      globalState.hasActiveHandles = false // Initially false, will be set to true if OPFS project is loaded
      globalState.hasInitializedFromStorage = true
      
      console.log('Project state loaded from localStorage', {
        folderName: state.selectedFolderName,
        filesCount: Object.keys(state.filesManifest).length,
        fileTreeNodes: countFileTreeNodes(state.fileTree),
        contextSetsCount: Object.keys(state.contextSets).length,
        hasOPFSCopy: state.hasOPFSCopy
      })
      
      // Try to load from OPFS if available
      if (state.hasOPFSCopy && state.opfsProjectPath) {
        tryLoadFromOPFS(state.opfsProjectPath)
      }
      
      return true
    } catch (error) {
      console.error('Failed to load project state from localStorage:', error)
      globalState.hasInitializedFromStorage = true
      return false
    }
  }

  // Try to load project from OPFS
  const tryLoadFromOPFS = async (projectPath: string) => {
    // Guard against duplicate restoration attempts
    if (globalState.opfsRestorationAttempted) {
      console.log(`🟡 OPFS restoration already attempted for: ${projectPath}`)
      console.log(`🟡 Current hasActiveHandles state:`, globalState.hasActiveHandles)
      
      // Check if we actually have handles - if not, we need to rebuild
      const hasHandlesInTree = globalState.fileTree.length > 0 && checkFileTreeHasHandles(globalState.fileTree)
      console.log(`🟡 File tree has handles:`, hasHandlesInTree)
      
      if (!hasHandlesInTree) {
        console.log(`🟡 No handles found in file tree, forcing rebuild from OPFS...`)
        // Reset the flag and try again
        globalState.opfsRestorationAttempted = false
      } else {
        return
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
        await rebuildFileTreeFromOPFS(opfsHandle)
        
        // Notify success (only once per session)
        if (import.meta.client) {
          const { success } = useNotifications()
          success(
            'Project Fully Restored',
            `Project "${projectPath}" loaded seamlessly from local storage.`
          )
        }
      }
    } catch (error) {
      console.warn(`Failed to load project from OPFS: ${projectPath}`, error)
    }
  }

  // Helper function to check if file tree has handles recursively
  const checkFileTreeHasHandles = (items: FileTreeItem[]): boolean => {
    for (const item of items) {
      if (!item.handle) {
        return false
      }
      if (item.children && !checkFileTreeHasHandles(item.children)) {
        return false
      }
    }
    return true
  }

  // Helper function to rebuild file tree from OPFS
  const rebuildFileTreeFromOPFS = async (directoryHandle: FileSystemDirectoryHandle) => {
    try {
      console.log('🟡 Starting file tree rebuild from OPFS...')
      const files = await readDirectoryRecursively(directoryHandle, '')
      globalState.fileTree = files
      
      const hasHandlesAfterRebuild = checkFileTreeHasHandles(files)
      console.log('🟡 File tree rebuilt from OPFS:', {
        nodeCount: countFileTreeNodes(files.map(item => removeHandles(item))),
        hasHandles: hasHandlesAfterRebuild,
        topLevelItems: files.length,
        samplePaths: files.slice(0, 3).map(item => ({ path: item.path, hasHandle: !!item.handle }))
      })
      
      if (!hasHandlesAfterRebuild) {
        console.error('🟡 WARNING: File tree rebuild completed but files still have no handles!')
      }
    } catch (error) {
      console.error('🟡 Failed to rebuild file tree from OPFS:', error)
    }
  }

  // Helper function to read directory recursively (same as in pages/index.vue)
  const readDirectoryRecursively = async (
    directoryHandle: FileSystemDirectoryHandle, 
    currentPath: string
  ): Promise<FileTreeItem[]> => {
    const items: FileTreeItem[] = []
    
    // Ignore patterns for common directories/files we don't want to show
    const ignorePatterns = [
      'node_modules',
      '.nuxt',
      'dist',
      'build',
      '.next',
      '.svelte-kit',
      'target',
      'vendor',
      'Thumbs.db'
    ]

    try {
      for await (const [name, handle] of directoryHandle.entries()) {
        // Skip files/directories that start with a dot (sensitive files)
        if (name.startsWith('.')) {
          continue
        }
        
        // Skip ignored patterns
        if (ignorePatterns.some(pattern => name.includes(pattern))) {
          continue
        }

        const itemPath = currentPath ? `${currentPath}/${name}` : name

        if (handle.kind === 'directory') {
          const children = await readDirectoryRecursively(handle as FileSystemDirectoryHandle, itemPath)
          items.push({
            name,
            path: itemPath,
            type: 'directory',
            children,
            handle: handle as FileSystemDirectoryHandle
          })
        } else {
          items.push({
            name,
            path: itemPath,
            type: 'file',
            handle: handle as FileSystemFileHandle
          })
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error)
    }

    // Sort: directories first, then files, both alphabetically
    return items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  // Copy project to OPFS for persistent storage
  const copyProjectToOPFS = async (sourceHandle: FileSystemDirectoryHandle): Promise<boolean> => {
    try {
      const projectName = sourceHandle.name
      
      // Set loading state
      globalState.isOPFSCopying = true
      globalState.opfsCopyProgress = 0
      globalState.opfsCopyingProjectName = projectName
      
      const opfsPath = await opfsManager.copyProjectToOPFS(sourceHandle, projectName, (progress) => {
        globalState.opfsCopyProgress = progress
      })
      
      if (opfsPath) {
        console.log(`Project copied to OPFS: ${opfsPath}`)
        globalState.hasSuccessfulOPFSCopy = true // Mark as successfully copied
        saveToLocalStorage() // Save the updated state
        return true
      }
      
      return false
    } catch (error) {
      console.error('Failed to copy project to OPFS:', error)
      return false
    } finally {
      // Clear loading state
      globalState.isOPFSCopying = false
      globalState.opfsCopyProgress = 0
      globalState.opfsCopyingProjectName = null
    }
  }

  // Helper to count file tree nodes
  const countFileTreeNodes = (tree: Omit<FileTreeItem, 'handle'>[]): number => {
    let count = 0
    const traverse = (items: Omit<FileTreeItem, 'handle'>[]) => {
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

  // Clear localStorage
  const clearLocalStorage = () => {
    localStorage.removeItem(STORAGE_KEY)
    console.log('Project state cleared from localStorage')
  }

  // Helper to remove handles from file tree for serialization
  const removeHandles = (item: FileTreeItem): Omit<FileTreeItem, 'handle'> => {
    const { handle, ...rest } = item
    return {
      ...rest,
      children: item.children?.map(child => removeHandles(child))
    }
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
    for (const [id, entry] of Object.entries(globalState.filesManifest)) {
      if (entry.path === filePath) {
        return id
      }
    }
    return null
  }

  // Get file ID by path (or create new entry)
  const getOrCreateFileId = (filePath: string): string => {
    // Check if file already exists in manifest
    for (const [id, entry] of Object.entries(globalState.filesManifest)) {
      if (entry.path === filePath) {
        return id
      }
    }
    
    // Create new file entry
    const newId = generateFileId()
    globalState.filesManifest[newId] = {
      path: filePath,
      comment: ''
    }
    
    console.log('Auto-created new file manifest entry:', { id: newId, path: filePath })
    saveToLocalStorage() // Auto-save on changes
    return newId
  }

  // Create new context set
  const createContextSet = (name: string, description: string = '') => {
    if (globalState.contextSets[name]) {
      // Don't throw error, just return silently for duplicates
      return
    }
    
    globalState.contextSets[name] = {
      description,
      files: [],
      workflow: []
    }
    
    saveToLocalStorage() // Auto-save when context set is created
    console.log(`Created new context set: ${name}`)
  }

  // Set active context set
  const setActiveContextSet = (name: string | null) => {
    if (name && !globalState.contextSets[name]) {
      console.warn(`Context set "${name}" does not exist`)
      return false
    }
    
    globalState.activeContextSetName = name
    console.log('Set active context set:', name)
    saveToLocalStorage() // Auto-save on changes
    return true
  }

  // Add file to active context set (and implicitly to files manifest)
  const addFileToActiveContextSet = (file: FileTreeItem) => {
    if (!globalState.activeContextSetName) {
      throw new Error('No active context set selected')
    }
    
    if (file.type !== 'file') {
      throw new Error('Only files can be added to context sets')
    }

    const fileId = getOrCreateFileId(file.path)
    const activeSet = globalState.contextSets[globalState.activeContextSetName]
    
    // Check if file is already in this context set
    const alreadyIncluded = activeSet.files.some(fileEntry => {
      const entryId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
      return entryId === fileId
    })
    
    if (alreadyIncluded) {
      console.warn('File already included in active context set:', file.path)
      return false
    }
    
    // Add file as simple string reference (whole file)
    activeSet.files.push(fileId)
    
    console.log('Added file to active context set:', { file: file.path, setName: globalState.activeContextSetName })
    saveToLocalStorage() // Auto-save on changes
    return true
  }

  // Remove file from active context set
  const removeFileFromActiveContextSet = (fileId: string) => {
    if (!globalState.activeContextSetName) {
      throw new Error('No active context set selected')
    }
    
    const activeSet = globalState.contextSets[globalState.activeContextSetName]
    const index = activeSet.files.findIndex(fileEntry => {
      const entryId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
      return entryId === fileId
    })
    
    if (index !== -1) {
      activeSet.files.splice(index, 1)
      console.log('Removed file from active context set:', { fileId, setName: globalState.activeContextSetName })
      
      // Clean up orphaned files after removal
      const orphanedCount = cleanupOrphanedFiles()
      if (orphanedCount > 0) {
        console.log(`Cleaned up ${orphanedCount} orphaned files after removal`)
      }
      
      saveToLocalStorage() // Auto-save on changes
      return true
    }
    
    return false
  }

  // Update active context set details
  const updateActiveContextSet = (updates: { name?: string, description?: string, workflow?: WorkflowStep[] }) => {
    if (!globalState.activeContextSetName) {
      throw new Error('No active context set selected')
    }
    
    const currentName = globalState.activeContextSetName
    const currentSet = globalState.contextSets[currentName]
    
    // Handle name change
    if (updates.name && updates.name !== currentName) {
      if (globalState.contextSets[updates.name]) {
        throw new Error(`Context set "${updates.name}" already exists`)
      }
      
      // Create new entry with new name
      globalState.contextSets[updates.name] = { ...currentSet }
      
      // Update other fields if provided
      if (updates.description !== undefined) {
        globalState.contextSets[updates.name].description = updates.description
      }
      if (updates.workflow !== undefined) {
        globalState.contextSets[updates.name].workflow = [...updates.workflow]
      }
      
      // Remove old entry
      const { [currentName]: removed, ...rest } = globalState.contextSets
      globalState.contextSets = rest
      
      // Update active reference
      globalState.activeContextSetName = updates.name
      
      console.log('Renamed context set:', { from: currentName, to: updates.name })
    } else {
      // Just update fields
      if (updates.description !== undefined) {
        currentSet.description = updates.description
      }
      if (updates.workflow !== undefined) {
        currentSet.workflow = [...updates.workflow]
      }
    }
    
    saveToLocalStorage() // Auto-save on changes
  }

  // Helper function to check if a file is still referenced by any context sets
  const isFileReferencedByAnyContextSet = (fileId: string): boolean => {
    for (const set of Object.values(globalState.contextSets)) {
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
    for (const fileId of Object.keys(globalState.filesManifest)) {
      if (!isFileReferencedByAnyContextSet(fileId)) {
        orphanedFiles.push(fileId)
      }
    }
    
    // Remove orphaned files from manifest using a new object
    if (orphanedFiles.length > 0) {
      const newManifest: Record<string, FileManifestEntry> = {}
      for (const [fileId, entry] of Object.entries(globalState.filesManifest)) {
        if (!orphanedFiles.includes(fileId)) {
          newManifest[fileId] = entry
        }
      }
      globalState.filesManifest = newManifest
      
      console.log('Cleaned up orphaned files from manifest:', orphanedFiles)
    }
    
    return orphanedFiles.length
  }

  // Delete context set with proper cleanup
  const deleteContextSet = (name: string) => {
    if (!globalState.contextSets[name]) {
      return false
    }
    
    // Get files referenced by the context set being deleted
    const contextSetToDelete = globalState.contextSets[name]
    const referencedFiles = contextSetToDelete.files.map(fileEntry => 
      typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
    )
    
    console.log('Deleting context set:', name, 'with referenced files:', referencedFiles)
    
    // Remove the context set
    const { [name]: removed, ...rest } = globalState.contextSets
    globalState.contextSets = rest
    
    // If this was the active set, clear active selection
    if (globalState.activeContextSetName === name) {
      globalState.activeContextSetName = null
    }
    
    // Clean up orphaned files from manifest
    const orphanedCount = cleanupOrphanedFiles()
    
    console.log('Deleted context set:', name, `- cleaned up ${orphanedCount} orphaned files`)
    saveToLocalStorage() // Auto-save on changes
    return true
  }

  // Update file comment in files manifest
  const updateFileComment = (fileId: string, comment: string) => {
    if (globalState.filesManifest[fileId]) {
      globalState.filesManifest[fileId].comment = comment
      saveToLocalStorage() // Auto-save on changes
      return true
    }
    return false
  }

  // Update file comment in files manifest (alias for consistency)
  const updateFileManifestComment = (fileId: string, comment: string) => {
    return updateFileComment(fileId, comment)
  }

  // Generate file contexts index
  const generateFileContextsIndex = (): Record<string, Array<{ setName: string, lineRanges?: LineRange[] }>> => {
    const index: Record<string, Array<{ setName: string, lineRanges?: LineRange[] }>> = {}
    
    for (const [setName, set] of Object.entries(globalState.contextSets)) {
      for (const fileEntry of set.files) {
        const fileId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
        
        if (!globalState.filesManifest[fileId]) continue
        
        if (!index[fileId]) {
          index[fileId] = []
        }
        
        const contextReference: { setName: string, lineRanges?: LineRange[] } = { setName }
        
        if (typeof fileEntry === 'object' && fileEntry.lineRanges) {
          contextReference.lineRanges = fileEntry.lineRanges
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
      filesManifest: { ...globalState.filesManifest },
      contextSets: { ...globalState.contextSets },
      fileContextsIndex: generateFileContextsIndex()
    }
  }

  // Load context sets from JSON data
  const loadContextSetsData = (data: ContextSetsData) => {
    // First, load context sets
    globalState.contextSets = { ...data.contextSets }
    
    // Then, only import files that are actually referenced by the loaded context sets
    const referencedFileIds = new Set<string>()
    
    // Collect all file IDs that are actually used in context sets
    for (const contextSet of Object.values(globalState.contextSets)) {
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
    
    globalState.filesManifest = filteredFilesManifest
    
    console.log('Loaded context sets data with filtered manifest:', { 
      totalFilesInJSON: Object.keys(data.filesManifest).length,
      actuallyReferencedFiles: Object.keys(filteredFilesManifest).length,
      contextSetsCount: Object.keys(globalState.contextSets).length
    })
    
    // Clean up any orphaned files (though there shouldn't be any now)
    const orphanedCount = cleanupOrphanedFiles()
    if (orphanedCount > 0) {
      console.log(`Cleaned up ${orphanedCount} orphaned files after loading data`)
    }
    
    // Set first context set as active if any exist
    const setNames = Object.keys(globalState.contextSets)
    if (setNames.length > 0) {
      globalState.activeContextSetName = setNames[0]
    }
    
    console.log('Final loaded state:', { 
      filesCount: Object.keys(globalState.filesManifest).length,
      contextSetsCount: setNames.length,
      activeSet: globalState.activeContextSetName
    })
    
    saveToLocalStorage() // Save to localStorage after loading
  }

  // Project management functions
  const setSelectedFolder = (folder: FileSystemDirectoryHandle | null) => {
    globalState.selectedFolder = folder
    if (folder) {
      globalState.hasActiveHandles = true // We now have an active folder handle
      saveToLocalStorage() // Auto-save when folder is selected
    }
  }

  const setFileTree = (tree: FileTreeItem[]) => {
    globalState.fileTree = tree
    globalState.hasActiveHandles = tree.length > 0 && tree.some(item => !!item.handle) // Check if we have actual handles
    saveToLocalStorage() // Auto-save when file tree changes
    console.log('File tree updated', {
      nodeCount: countFileTreeNodes(tree.map(item => removeHandles(item))),
      hasHandles: globalState.hasActiveHandles
    })
  }

  const setIsLoadingFiles = (loading: boolean) => {
    globalState.isLoadingFiles = loading
  }

  const clearProject = () => {
    globalState.selectedFolder = null
    globalState.fileTree = []
    globalState.filesManifest = {}
    globalState.contextSets = {}
    globalState.activeContextSetName = null
    globalState.isLoadingFiles = false
    globalState.currentFileContent = ''
    globalState.currentFileName = ''
    globalState.isFileContentModalOpen = false
    globalState.hasActiveHandles = false
    globalState.opfsRestorationAttempted = false
    globalState.hasSuccessfulOPFSCopy = false
    globalState.hasInitializedFromStorage = false
    clearLocalStorage() // Clear localStorage when project is cleared
  }

  // Check if OPFS is supported
  const isOPFSAvailable = () => {
    return isOPFSSupported()
  }

  // Get list of projects in OPFS
  const getOPFSProjects = async (): Promise<string[]> => {
    return await opfsManager.listOPFSProjects()
  }

  // Delete project from OPFS
  const deleteOPFSProject = async (projectName: string): Promise<boolean> => {
    return await opfsManager.deleteProjectFromOPFS(projectName)
  }

  // File content management
  const loadFileContent = async (file: FileTreeItem) => {
    console.log('🟡 loadFileContent called with:', { 
      name: file.name, 
      path: file.path, 
      type: file.type, 
      hasHandle: !!file.handle 
    })
    
    if (file.type !== 'file') {
      console.log('🟡 Not a file, returning')
      return
    }
    
    if (!file.handle) {
      console.log('🟡 No file handle, returning')
      return
    }
    
    try {
      console.log('🟡 Attempting to read file content...')
      const fileHandle = file.handle as FileSystemFileHandle
      const fileObj = await fileHandle.getFile()
      const content = await fileObj.text()
      
      console.log('🟡 File content loaded, length:', content.length)
      
      globalState.currentFileContent = content
      globalState.currentFileName = file.path
      globalState.isFileContentModalOpen = true
      
      console.log('🟡 Modal state set:', {
        fileName: globalState.currentFileName,
        contentLength: globalState.currentFileContent.length,
        modalOpen: globalState.isFileContentModalOpen
      })
    } catch (error) {
      console.error('🟡 Error loading file content:', error)
    }
  }

  const closeFileContentModal = () => {
    globalState.isFileContentModalOpen = false
  }

  // Auto-load context sets from project
  const autoLoadContextSetsFromProject = async (directoryHandle: FileSystemDirectoryHandle): Promise<boolean> => {
    // Always start with a clean slate when loading a new project
    globalState.contextSets = {}
    globalState.activeContextSetName = null
    globalState.filesManifest = {}
    
    console.log('Starting with clean slate for new project:', directoryHandle.name)
    
    try {
      const fileHandle = await directoryHandle.getFileHandle('context-sets.json')
      const file = await fileHandle.getFile()
      const content = await file.text()
      const data = JSON.parse(content) as ContextSetsData
      
      loadContextSetsData(data)
      console.log('Successfully loaded context-sets.json from project:', directoryHandle.name)
      return true
    } catch (error) {
      console.log('No existing context-sets.json found or error loading:', error)
      console.log('Project will start with empty context sets')
      
      // Save the clean state to localStorage
      saveToLocalStorage()
      return false
    }
  }

  // Helper function for testing - allows direct manipulation of files manifest
  const setFilesManifestForTesting = (manifest: Record<string, FileManifestEntry>) => {
    globalState.filesManifest = { ...manifest }
  }

  // Helper function for testing - add file directly to manifest
  const addFileToManifestForTesting = (fileId: string, entry: FileManifestEntry) => {
    globalState.filesManifest[fileId] = entry
  }

  // Ensure the store is initialized when needed (client-side only)
  const ensureInitialized = () => {
    if (import.meta.client && !globalState.hasInitializedFromStorage) {
      loadFromLocalStorage()
    }
  }

  return {
    // State (readonly refs and computed)
    currentView: readonly(toRef(globalState, 'currentView')),
    selectedFolder: readonly(toRef(globalState, 'selectedFolder')),
    fileTree: computed(() => {
      ensureInitialized()
      return globalState.fileTree
    }),
    isLoadingFiles: readonly(toRef(globalState, 'isLoadingFiles')),
    filesManifest: computed(() => {
      ensureInitialized()
      return globalState.filesManifest
    }),
    contextSets: computed(() => {
      ensureInitialized()
      return globalState.contextSets
    }),
    activeContextSetName: computed(() => {
      ensureInitialized()
      return globalState.activeContextSetName
    }),
    currentFileContent: readonly(toRef(globalState, 'currentFileContent')),
    currentFileName: readonly(toRef(globalState, 'currentFileName')),
    isFileContentModalOpen: readonly(toRef(globalState, 'isFileContentModalOpen')),
    hasActiveHandles: readonly(toRef(globalState, 'hasActiveHandles')),
    opfsRestorationAttempted: readonly(toRef(globalState, 'opfsRestorationAttempted')),
    hasSuccessfulOPFSCopy: readonly(toRef(globalState, 'hasSuccessfulOPFSCopy')),
    
    // OPFS loading state
    isOPFSCopying: readonly(toRef(globalState, 'isOPFSCopying')),
    opfsCopyProgress: readonly(toRef(globalState, 'opfsCopyProgress')),
    opfsCopyingProjectName: readonly(toRef(globalState, 'opfsCopyingProjectName')),

    // Computed properties
    activeContextSet: computed(() => {
      ensureInitialized()
      if (!globalState.activeContextSetName || !globalState.contextSets[globalState.activeContextSetName]) {
        return null
      }
      return {
        name: globalState.activeContextSetName,
        ...globalState.contextSets[globalState.activeContextSetName]
      }
    }),
    contextSetNames: computed(() => {
      ensureInitialized()
      return Object.keys(globalState.contextSets)
    }),
    hasDataLoaded: computed(() => {
      ensureInitialized()
      return globalState.selectedFolder || 
             Object.keys(globalState.filesManifest).length > 0 || 
             Object.keys(globalState.contextSets).length > 0
    }),

    // Actions - View management
    setCurrentView,
    goToLanding,
    goToWorkspace,

    // Actions - Project management
    setSelectedFolder,
    setFileTree,
    setIsLoadingFiles,
    clearProject,
    autoLoadContextSetsFromProject,

    // Actions - Context sets
    createContextSet,
    setActiveContextSet,
    updateActiveContextSet,
    deleteContextSet,
    addFileToActiveContextSet,
    removeFileFromActiveContextSet,

    // Actions - Files
    updateFileComment,
    updateFileManifestComment,
    loadFileContent,
    closeFileContentModal,

    // Actions - JSON generation
    generateContextSetsJSON,
    loadContextSetsData,

    // Actions - Persistence
    saveToLocalStorage,
    loadFromLocalStorage,
    clearLocalStorage,
    hasSavedData,
    getSavedProjectName,
    copyProjectToOPFS,

    // Utilities
    getOrCreateFileId,
    findFileIdByPath,
    generateFileId,
    generateFileContextsIndex,
    cleanupOrphanedFiles,
    isFileReferencedByAnyContextSet,

    // OPFS-related functions
    isOPFSAvailable,
    getOPFSProjects,
    deleteOPFSProject,

    // Helper functions for testing
    setFilesManifestForTesting,
    addFileToManifestForTesting
  }
} 