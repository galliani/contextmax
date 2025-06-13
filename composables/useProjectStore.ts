/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
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

// Serializable project state for localStorage (UI preferences only)
export interface SerializableProjectState {
  selectedFolderName: string | null
  fileTree: Omit<FileTreeItem, 'handle'>[] // Store complete file tree structure
  timestamp: number
  hasOPFSCopy: boolean // Track if we have an OPFS copy
  opfsProjectPath: string | null // Path to the project in OPFS
  // Note: filesManifest and contextSets are now stored in OPFS, not localStorage
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
  
  // Saved projects (reactive)
  savedProjects: [] as SavedProject[],
  
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
  opfsCopyingProjectName: null as string | null
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
  
  // === Context Sets Management (NEW) ===
  
  /**
   * Save context sets to OPFS working copy for a specific project
   */
  async saveContextSetsToProject(projectName: string, contextSetsData: ContextSetsData): Promise<boolean> {
    if (!this.projectsDir) {
      await this.initialize()
      if (!this.projectsDir) return false
    }
    
    try {
      // Get or create project directory
      const projectDir = await this.projectsDir.getDirectoryHandle(projectName, { create: true })
      
      // Get or create .contextmax subdirectory
      const contextmaxDir = await projectDir.getDirectoryHandle('.contextmax', { create: true })
      
      // Save context-sets.json as working copy
      const contextSetsJSON = JSON.stringify(contextSetsData, null, 2)
      const fileHandle = await contextmaxDir.getFileHandle('context-sets.json', { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(contextSetsJSON)
      await writable.close()
      
      // Save metadata
      const metadata = {
        lastSaved: Date.now(),
        version: '1.0',
        isWorkingCopy: true
      }
      const metadataHandle = await contextmaxDir.getFileHandle('metadata.json', { create: true })
      const metadataWritable = await metadataHandle.createWritable()
      await metadataWritable.write(JSON.stringify(metadata, null, 2))
      await metadataWritable.close()
      
      console.log(`✅ Context sets saved to OPFS working copy: ${projectName}`)
      return true
    } catch (error) {
      console.error(`❌ Failed to save context sets to OPFS for ${projectName}:`, error)
      return false
    }
  }
  
  /**
   * Load context sets from OPFS working copy for a specific project
   */
  async loadContextSetsFromProject(projectName: string): Promise<ContextSetsData | null> {
    if (!this.projectsDir) {
      await this.initialize()
      if (!this.projectsDir) return null
    }
    
    try {
      const projectDir = await this.projectsDir.getDirectoryHandle(projectName)
      const contextmaxDir = await projectDir.getDirectoryHandle('.contextmax')
      const fileHandle = await contextmaxDir.getFileHandle('context-sets.json')
      
      const file = await fileHandle.getFile()
      const content = await file.text()
      const contextSetsData: ContextSetsData = JSON.parse(content)
      
      console.log(`✅ Context sets loaded from OPFS working copy: ${projectName}`)
      return contextSetsData
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.log(`ℹ️ No working copy found in OPFS for ${projectName}:`, errorMessage)
      return null
    }
  }
  
  /**
   * Check if a project has context sets in OPFS working copy
   */
  async hasContextSetsInProject(projectName: string): Promise<boolean> {
    if (!this.projectsDir) {
      await this.initialize()
      if (!this.projectsDir) return false
    }
    
    try {
      const projectDir = await this.projectsDir.getDirectoryHandle(projectName)
      const contextmaxDir = await projectDir.getDirectoryHandle('.contextmax')
      await contextmaxDir.getFileHandle('context-sets.json')
      return true
    } catch {
      return false
    }
  }
  
  /**
   * Delete context sets from OPFS working copy for a specific project
   */
  async deleteContextSetsFromProject(projectName: string): Promise<boolean> {
    if (!this.projectsDir) return false
    
    try {
      const projectDir = await this.projectsDir.getDirectoryHandle(projectName)
      const contextmaxDir = await projectDir.getDirectoryHandle('.contextmax')
      
      // Remove context-sets.json and metadata.json
      await contextmaxDir.removeEntry('context-sets.json')
      await contextmaxDir.removeEntry('metadata.json')
      
      // Remove .contextmax directory if empty
      try {
        await projectDir.removeEntry('.contextmax', { recursive: true })
      } catch {
        // Directory might not be empty, that's okay
      }
      
      console.log(`✅ Context sets deleted from OPFS working copy: ${projectName}`)
      return true
    } catch (error) {
      console.error(`❌ Failed to delete context sets from OPFS for ${projectName}:`, error)
      return false
    }
  }
  
  /**
   * Get metadata for context sets working copy
   */
  async getContextSetsMetadata(projectName: string): Promise<unknown | null> {
    if (!this.projectsDir) {
      await this.initialize()
      if (!this.projectsDir) return null
    }
    
    try {
      const projectDir = await this.projectsDir.getDirectoryHandle(projectName)
      const contextmaxDir = await projectDir.getDirectoryHandle('.contextmax')
      const metadataHandle = await contextmaxDir.getFileHandle('metadata.json')
      
      const file = await metadataHandle.getFile()
      const content = await file.text()
      return JSON.parse(content)
    } catch {
      return null
    }
  }
  
  // === Existing Project File Management ===
  
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

// Saved projects management interface
interface SavedProject {
  name: string
  addedAt: number
  lastAccessed: number
}

export const useProjectStore = () => {
  // LocalStorage key
  const STORAGE_KEY = 'contextmax-project-state'
  const SAVED_PROJECTS_KEY = 'contextmax-saved-projects'

  // Load saved projects from localStorage into reactive state
  const loadSavedProjectsFromStorage = () => {
    try {
      const saved = localStorage.getItem(SAVED_PROJECTS_KEY)
      if (!saved) {
        globalState.savedProjects = []
        return
      }
      
      const projects: SavedProject[] = JSON.parse(saved)
      // Sort by last accessed (most recent first)
      globalState.savedProjects = projects.sort((a, b) => b.lastAccessed - a.lastAccessed)
    } catch (error) {
      console.error('Failed to load saved projects:', error)
      globalState.savedProjects = []
    }
  }

  // Save reactive saved projects to localStorage
  const saveSavedProjectsToStorage = () => {
    try {
      localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(globalState.savedProjects))
    } catch (error) {
      console.error('Failed to save projects to localStorage:', error)
    }
  }

  // Add project to saved list
  const addToSavedProjects = (projectName: string) => {
    try {
      // Work with the reactive array directly
      const existingIndex = globalState.savedProjects.findIndex((p: SavedProject) => p.name === projectName)
      
      if (existingIndex >= 0) {
        // Update last accessed time
        globalState.savedProjects[existingIndex].lastAccessed = Date.now()
      } else {
        // Add new project
        globalState.savedProjects.push({
          name: projectName,
          addedAt: Date.now(),
          lastAccessed: Date.now()
        })
      }
      
      // Sort by last accessed (most recent first)
      globalState.savedProjects.sort((a: SavedProject, b: SavedProject) => b.lastAccessed - a.lastAccessed)
      
      // Save to localStorage
      saveSavedProjectsToStorage()
      console.log(`Added project to saved list: ${projectName}`)
    } catch (error) {
      console.error('Failed to add project to saved list:', error)
    }
  }

  // Get list of saved projects (returns reactive array)
  const getSavedProjects = (): SavedProject[] => {
    return globalState.savedProjects
  }

  // Remove project from saved list
  const removeFromSavedProjects = (projectName: string) => {
    try {
      const index = globalState.savedProjects.findIndex((p: SavedProject) => p.name === projectName)
      if (index >= 0) {
        globalState.savedProjects.splice(index, 1)
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
    return globalState.savedProjects.length > 0
  }

  // Switch to a different saved project
  const switchToProject = async (projectName: string): Promise<boolean> => {
    console.log(`🔄 Switching to project: ${projectName}`)
    
    try {
      // Update last accessed time
      addToSavedProjects(projectName)
      
      // Try to load project from OPFS
      const opfsHandle = await opfsManager.getProjectFromOPFS(projectName)
      if (!opfsHandle) {
        console.error(`❌ Project not found in OPFS: ${projectName}`)
        return false
      }
      
      // Clear current state
      globalState.selectedFolder = null
      globalState.fileTree = []
      globalState.filesManifest = {}
      globalState.contextSets = {}
      globalState.activeContextSetName = null
      globalState.hasActiveHandles = false
      globalState.opfsRestorationAttempted = false
      
      // Set new folder
      globalState.selectedFolder = opfsHandle
      globalState.hasActiveHandles = true
      globalState.hasSuccessfulOPFSCopy = true
      
      // Rebuild file tree from OPFS
      await rebuildFileTreeFromOPFS(opfsHandle)
      
      // Load context sets from OPFS working copy
      await autoLoadContextSetsFromProject(opfsHandle)
      
      // Save current state to localStorage
      saveToLocalStorage()
      
      console.log(`✅ Successfully switched to project: ${projectName}`)
      return true
    } catch (error) {
      console.error(`❌ Failed to switch to project ${projectName}:`, error)
      return false
    }
  }

  // Refresh files from local folder (file picker functionality)
  const refreshFilesFromLocal = async (): Promise<boolean> => {
    console.log('🔄 Starting file refresh from local folder...')
    
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      console.error('File System Access API not supported')
      return false
    }

    try {
      // Show directory picker
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'read'
      })
      
      console.log('Directory selected for refresh:', directoryHandle.name)
      
      // Check if this is the same project or a different one
      const currentProjectName = globalState.selectedFolder?.name
      const newProjectName = directoryHandle.name
      
      if (currentProjectName && currentProjectName !== newProjectName) {
        console.warn(`⚠️ Selected folder "${newProjectName}" differs from current project "${currentProjectName}"`)
        // We'll proceed but this might be intentional (user wants to switch projects via refresh)
      }
      
      // Set loading state
      setIsLoadingFiles(true)
      
      // Update folder handle
      setSelectedFolder(directoryHandle)
      
      // Rebuild file tree
      const files = await readDirectoryRecursively(directoryHandle, '')
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
        await autoLoadContextSetsFromProject(directoryHandle)
      }
      
      console.log(`✅ File refresh completed for: ${newProjectName}`)
      return true
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('❌ Error refreshing files from local folder:', error)
      }
      return false
    } finally {
      setIsLoadingFiles(false)
    }
  }

  // Save state to localStorage
  const saveToLocalStorage = () => {
    try {
      const serializableState: SerializableProjectState = {
        selectedFolderName: globalState.selectedFolder?.name || null,
        fileTree: globalState.fileTree.map(item => removeHandles(item)),
        timestamp: Date.now(),
        hasOPFSCopy: globalState.hasSuccessfulOPFSCopy,
        opfsProjectPath: globalState.selectedFolder?.name || null
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState))
      console.log('Project state saved to localStorage', {
        folderName: serializableState.selectedFolderName,
        fileTreeNodes: countFileTreeNodes(serializableState.fileTree),
        hasOPFSCopy: serializableState.hasOPFSCopy
      })
    } catch (error) {
      console.error('Failed to save project state to localStorage:', error)
    }
  }

  // Load state from localStorage
  const loadFromLocalStorage = async (): Promise<{ metadataLoaded: boolean; opfsRestored: boolean }> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return { metadataLoaded: false, opfsRestored: false }
      }

      const state: SerializableProjectState = JSON.parse(stored)
      
      // Restore only project metadata, not context sets (those come from OPFS)
      globalState.fileTree = state.fileTree as FileTreeItem[]
      globalState.hasActiveHandles = false // Initially false, will be set to true if OPFS project is loaded
      
      console.log('Project metadata loaded from localStorage', {
        folderName: state.selectedFolderName,
        fileTreeNodes: countFileTreeNodes(state.fileTree),
        hasOPFSCopy: state.hasOPFSCopy
      })
      
      let opfsRestored = false
      
      // Always try to load from OPFS if we have a project path, regardless of hasOPFSCopy flag
      // This provides better recovery in case the flag was incorrectly set
      if (state.opfsProjectPath) {
        opfsRestored = await tryLoadFromOPFS(state.opfsProjectPath)
      }
      
      return { metadataLoaded: true, opfsRestored }
    } catch (error) {
      console.error('Failed to load project metadata from localStorage:', error)
      return { metadataLoaded: false, opfsRestored: false }
    }
  }

  // Try to load project from OPFS
  const tryLoadFromOPFS = async (projectPath: string): Promise<boolean> => {
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
        await rebuildFileTreeFromOPFS(opfsHandle)
        
        // CRITICAL FIX: Also load context sets from OPFS working copy
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
        
        // Add to saved projects list
        addToSavedProjects(projectName)
        
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
    // No longer auto-save to localStorage - only OPFS
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
    
    // Auto-save to OPFS working copy
    if (globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
    
    // No longer save to localStorage
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
    
    // Auto-save to OPFS working copy  
    if (globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
    
    // No longer save to localStorage
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
    
    // Auto-save to OPFS working copy
    if (globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
    
    // No longer save to localStorage
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
      
      // Auto-save to OPFS working copy
      if (globalState.selectedFolder) {
        saveWorkingCopyToOPFS(globalState.selectedFolder.name)
      }
      
      // No longer save to localStorage
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
      if (updates.entryPoints !== undefined) {
        globalState.contextSets[updates.name].entryPoints = [...updates.entryPoints]
      }
      if (updates.systemBehavior !== undefined) {
        globalState.contextSets[updates.name].systemBehavior = { ...updates.systemBehavior }
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
      if (updates.entryPoints !== undefined) {
        currentSet.entryPoints = [...updates.entryPoints]
      }
      if (updates.systemBehavior !== undefined) {
        currentSet.systemBehavior = { ...updates.systemBehavior }
      }
    }
    
    // Auto-save to OPFS working copy
    if (globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
    
    // No longer save to localStorage
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
    
    // Auto-save to OPFS working copy
    if (globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
    
    // No longer save to localStorage
    return true
  }

  // Update file comment in files manifest
  const updateFileComment = (fileId: string, comment: string) => {
    if (globalState.filesManifest[fileId]) {
      globalState.filesManifest[fileId].comment = comment
      
      // Auto-save to OPFS working copy
      if (globalState.selectedFolder) {
        saveWorkingCopyToOPFS(globalState.selectedFolder.name)
      }
      
      // No longer save to localStorage
      return true
    }
    return false
  }

  // Update file comment in files manifest (alias for consistency)
  const updateFileManifestComment = (fileId: string, comment: string) => {
    return updateFileComment(fileId, comment)
  }

  // Generate file contexts index
  const generateFileContextsIndex = (): Record<string, Array<{ setName: string, functionRefs?: FunctionRef[] }>> => {
    const index: Record<string, Array<{ setName: string, functionRefs?: FunctionRef[] }>> = {}
    
    for (const [setName, set] of Object.entries(globalState.contextSets)) {
      for (const fileEntry of set.files) {
        const fileId = typeof fileEntry === 'string' ? fileEntry : fileEntry.fileRef
        
        if (!globalState.filesManifest[fileId]) continue
        
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
    
    // Auto-save to OPFS working copy (this creates/updates the working copy)
    if (globalState.selectedFolder) {
      saveWorkingCopyToOPFS(globalState.selectedFolder.name)
    }
    
    // No longer save to localStorage
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

  // Helper function to load stable version from project folder
  const tryLoadStableVersionFromProject = async (directoryHandle: FileSystemDirectoryHandle): Promise<ContextSetsData | null> => {
    try {
      const fileHandle = await directoryHandle.getFileHandle('context-sets.json')
      const file = await fileHandle.getFile()
      const content = await file.text()
      const data = JSON.parse(content) as ContextSetsData
      
      console.log(`✅ Loaded stable version from project folder: ${directoryHandle.name}`)
      return data
    } catch {
      console.log(`ℹ️ No stable version found in project folder: ${directoryHandle.name}`)
      return null
    }
  }

  // Helper function to save current state as working copy to OPFS
  const saveWorkingCopyToOPFS = async (projectName: string): Promise<boolean> => {
    if (Object.keys(globalState.contextSets).length === 0) {
      return false // Nothing to save
    }
    
    try {
      const contextSetsData = generateContextSetsJSON()
      return await opfsManager.saveContextSetsToProject(projectName, contextSetsData)
    } catch (error) {
      console.error(`❌ Failed to save working copy to OPFS for ${projectName}:`, error)
      return false
    }
  }

  // Export working copy to stable version in project folder
  const exportToProjectFolder = async (): Promise<{ success: boolean, error?: string, warning?: string }> => {
    if (!globalState.selectedFolder) {
      return { success: false, error: 'No project folder selected' }
    }

    if (Object.keys(globalState.contextSets).length === 0) {
      return { success: false, error: 'No context sets to export' }
    }

    try {
      // Check if File System Access API is supported
      if (!('showDirectoryPicker' in window)) {
        // Fallback to regular download if API not supported
        const contextSetsData = generateContextSetsJSON()
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
      const permissionStatus = await (globalState.selectedFolder as any).queryPermission({ mode: 'readwrite' })
      if (permissionStatus !== 'granted') {
        // Request write permission
        const newPermissionStatus = await (globalState.selectedFolder as any).requestPermission({ mode: 'readwrite' })
        if (newPermissionStatus !== 'granted') {
          // Fallback to regular download if permission not granted
          const contextSetsData = generateContextSetsJSON()
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
      const contextSetsData = generateContextSetsJSON()
      const jsonContent = JSON.stringify(contextSetsData, null, 2)

      // Try to write the file to the project directory
      const fileHandle = await globalState.selectedFolder.getFileHandle('context-sets.json', { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(jsonContent)
      await writable.close()

      console.log(`✅ Successfully exported context sets to project folder: ${globalState.selectedFolder.name}`)
      return { success: true }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        // Fallback to regular download if permission error
        try {
          const contextSetsData = generateContextSetsJSON()
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
        console.error('❌ Failed to export context sets to project folder:', error)
        return { 
          success: false, 
          error: `Failed to export: ${errorMessage}` 
        }
      }
    }
  }

  // Check if stable version exists in project folder
  const hasStableVersionInProject = async (): Promise<boolean> => {
    if (!globalState.selectedFolder) {
      return false
    }

    try {
      await globalState.selectedFolder.getFileHandle('context-sets.json')
      return true
    } catch {
      return false
    }
  }

  // Get metadata about working copy vs stable version
  const getExportStatus = async (): Promise<{
    hasWorkingCopy: boolean
    hasStableVersion: boolean
    workingCopyMetadata?: unknown
    canExport: boolean
  }> => {
    const hasWorkingCopy = Object.keys(globalState.contextSets).length > 0
    const hasStableVersion = await hasStableVersionInProject()
    
    let workingCopyMetadata: unknown = null
    if (hasWorkingCopy && globalState.selectedFolder) {
      workingCopyMetadata = await opfsManager.getContextSetsMetadata(globalState.selectedFolder.name)
    }

    return {
      hasWorkingCopy,
      hasStableVersion,
      workingCopyMetadata,
      canExport: hasWorkingCopy && globalState.selectedFolder !== null
    }
  }

  // Auto-load context sets from project with priority system
  const autoLoadContextSetsFromProject = async (directoryHandle: FileSystemDirectoryHandle): Promise<boolean> => {
    const projectName = directoryHandle.name
    
    // Always start with a clean slate when loading a new project
    globalState.contextSets = {}
    globalState.activeContextSetName = null
    globalState.filesManifest = {}
    
    console.log(`🔄 Loading context sets for project: ${projectName}`)
    
    // Priority 1: Check for working copy in OPFS (source of truth once user has made changes)
    try {
      const workingCopy = await opfsManager.loadContextSetsFromProject(projectName)
      if (workingCopy) {
        loadContextSetsData(workingCopy)
        console.log(`✅ Loaded working copy from OPFS: ${projectName}`)
        return true
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load working copy from OPFS for ${projectName}:`, error)
    }
    
    // Priority 2: Load stable version from project folder and create working copy
    try {
      const stableVersion = await tryLoadStableVersionFromProject(directoryHandle)
      if (stableVersion) {
        loadContextSetsData(stableVersion)
        
        // Immediately create working copy from stable version
        await opfsManager.saveContextSetsToProject(projectName, stableVersion)
        console.log(`✅ Loaded stable version and created working copy: ${projectName}`)
        return true
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load stable version for ${projectName}:`, error)
    }
    
    // Priority 3: Start fresh (no context sets found)
    console.log(`✅ Starting fresh for project: ${projectName}`)
    
    // No need to save to localStorage anymore since we're using OPFS
    return false
  }

  // Helper function for testing - allows direct manipulation of files manifest
  const setFilesManifestForTesting = (manifest: Record<string, FileManifestEntry>) => {
    globalState.filesManifest = { ...manifest }
  }

  // Helper function for testing - add file directly to manifest
  const addFileToManifestForTesting = (fileId: string, entry: FileManifestEntry) => {
    globalState.filesManifest[fileId] = entry
  }

  return {
    // State (readonly refs and computed)
    currentView: readonly(toRef(globalState, 'currentView')),
    selectedFolder: readonly(toRef(globalState, 'selectedFolder')),
    fileTree: computed(() => globalState.fileTree),
    isLoadingFiles: readonly(toRef(globalState, 'isLoadingFiles')),
    filesManifest: computed(() => globalState.filesManifest),
    contextSets: computed(() => globalState.contextSets),
    activeContextSetName: computed(() => globalState.activeContextSetName),
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

    // Saved projects (reactive)
    savedProjects: computed(() => globalState.savedProjects),

    // Computed properties
    activeContextSet: computed(() => {
      if (!globalState.activeContextSetName || !globalState.contextSets[globalState.activeContextSetName]) {
        return null
      }
      return {
        name: globalState.activeContextSetName,
        ...globalState.contextSets[globalState.activeContextSetName]
      }
    }),
    contextSetNames: computed(() => Object.keys(globalState.contextSets)),
    hasDataLoaded: computed(() => {
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
    addFileToManifestForTesting,

    // New functions
    saveWorkingCopyToOPFS,
    exportToProjectFolder,
    hasStableVersionInProject,
    getExportStatus,

    // Saved projects management
    loadSavedProjectsFromStorage,
    addToSavedProjects,
    getSavedProjects,
    removeFromSavedProjects,
    hasSavedProjects,
    switchToProject,
    refreshFilesFromLocal
  }
} 