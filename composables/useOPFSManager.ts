/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { ContextSetsData } from './useContextSets'

// OPFS support detection and utilities
const isOPFSSupported = () => {
  return typeof window !== 'undefined' && 'navigator' in window && 'storage' in navigator && 'getDirectory' in navigator.storage
}

// OPFS project manager class
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
  
  // === Context Sets Management ===
  
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
  
  // === Project File Management ===
  
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

export const useOPFSManager = () => {
  // Create global OPFS manager instance
  const opfsManager = new OPFSProjectManager()

  // Check if OPFS is supported
  const isOPFSAvailable = () => {
    return isOPFSSupported()
  }

  // Context sets operations
  const saveContextSets = async (projectName: string, contextSetsData: ContextSetsData): Promise<boolean> => {
    return await opfsManager.saveContextSetsToProject(projectName, contextSetsData)
  }

  const loadContextSets = async (projectName: string): Promise<ContextSetsData | null> => {
    return await opfsManager.loadContextSetsFromProject(projectName)
  }

  const hasContextSets = async (projectName: string): Promise<boolean> => {
    return await opfsManager.hasContextSetsInProject(projectName)
  }

  const deleteContextSets = async (projectName: string): Promise<boolean> => {
    return await opfsManager.deleteContextSetsFromProject(projectName)
  }

  const getContextSetsMetadata = async (projectName: string): Promise<unknown | null> => {
    return await opfsManager.getContextSetsMetadata(projectName)
  }

  // Project file operations
  const copyProjectToOPFS = async (
    sourceHandle: FileSystemDirectoryHandle, 
    projectName: string, 
    onProgress?: (progress: number) => void
  ): Promise<string | null> => {
    return await opfsManager.copyProjectToOPFS(sourceHandle, projectName, onProgress)
  }

  const getProjectFromOPFS = async (projectName: string): Promise<FileSystemDirectoryHandle | null> => {
    return await opfsManager.getProjectFromOPFS(projectName)
  }

  const deleteProjectFromOPFS = async (projectName: string): Promise<boolean> => {
    return await opfsManager.deleteProjectFromOPFS(projectName)
  }

  const listOPFSProjects = async (): Promise<string[]> => {
    return await opfsManager.listOPFSProjects()
  }

  // Initialize OPFS
  const initializeOPFS = async (): Promise<boolean> => {
    return await opfsManager.initialize()
  }

  return {
    // Status
    isOPFSAvailable,
    
    // Initialization
    initializeOPFS,
    
    // Context sets operations
    saveContextSets,
    loadContextSets,
    hasContextSets,
    deleteContextSets,
    getContextSetsMetadata,
    
    // Project file operations
    copyProjectToOPFS,
    getProjectFromOPFS,
    deleteProjectFromOPFS,
    listOPFSProjects
  }
}