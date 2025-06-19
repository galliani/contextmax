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

export const useFileSystem = () => {
  const isFileSystemSupported = ref(false)

  onMounted(() => {
    isFileSystemSupported.value = typeof window !== 'undefined' && 'showDirectoryPicker' in window
  })

  // Helper function to collect all files recursively for gitignore processing
  const collectAllFiles = async (
    directoryHandle: FileSystemDirectoryHandle, 
    currentPath: string = '',
    allFiles: Array<{ path: string; handle: FileSystemHandle }> = []
  ): Promise<Array<{ path: string; handle: FileSystemHandle }>> => {
    try {
      for await (const [name, handle] of directoryHandle.entries()) {
        const itemPath = currentPath ? `${currentPath}/${name}` : name
        
        allFiles.push({ path: itemPath, handle })
        
        if (handle.kind === 'directory') {
          await collectAllFiles(handle as FileSystemDirectoryHandle, itemPath, allFiles)
        }
      }
    } catch (error) {
      console.error(`Error collecting files from directory ${currentPath}:`, error)
    }
    
    return allFiles
  }

  // File tree building with gitignore filtering
  const readDirectoryRecursively = async (
    directoryHandle: FileSystemDirectoryHandle, 
    currentPath: string,
    gitignoreMatcher?: any
  ): Promise<FileTreeItem[]> => {
    const items: FileTreeItem[] = []
    
    // Basic ignore patterns for critical system files (kept for safety)
    const basicIgnorePatterns = [
      'node_modules',
      '.git',
      'Thumbs.db'
    ]

    try {
      for await (const [name, handle] of directoryHandle.entries()) {
        const itemPath = currentPath ? `${currentPath}/${name}` : name
        
        // Apply basic ignore patterns first
        if (basicIgnorePatterns.some(pattern => name === pattern)) {
          continue
        }
        
        // Apply gitignore filtering if available
        if (gitignoreMatcher && gitignoreMatcher.ignores(itemPath)) {
          continue
        }

        if (handle.kind === 'directory') {
          const children = await readDirectoryRecursively(
            handle as FileSystemDirectoryHandle, 
            itemPath, 
            gitignoreMatcher
          )
          
          // Only include directory if it has children or if gitignore allows it
          if (children.length > 0) {
            items.push({
              name,
              path: itemPath,
              type: 'directory',
              children,
              handle: handle as FileSystemDirectoryHandle
            })
          }
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

  // Main function to build filtered file tree
  const buildFilteredFileTree = async (
    directoryHandle: FileSystemDirectoryHandle
  ): Promise<FileTreeItem[]> => {
    try {
      console.log('🔍 Building filtered file tree with gitignore support...')
      
      // First, collect all files to create gitignore matcher
      const allFiles = await collectAllFiles(directoryHandle)
      console.log(`📁 Collected ${allFiles.length} total files/directories`)
      
      // Create gitignore matcher
      const { createMatcher } = useGitignore()
      const gitignoreMatcher = await createMatcher(allFiles)
      
      // Build the filtered file tree
      const filteredTree = await readDirectoryRecursively(directoryHandle, '', gitignoreMatcher)
      
      console.log(`✅ Built filtered file tree with ${countFileTreeNodes(filteredTree.map(item => removeHandles(item)))} nodes`)
      
      return filteredTree
    } catch (error) {
      console.error('❌ Error building filtered file tree:', error)
      // Fallback to basic filtering if gitignore fails
      console.log('🔄 Falling back to basic file tree building...')
      return await readDirectoryRecursively(directoryHandle, '')
    }
  }

  // Helper function to rebuild file tree from OPFS
  const rebuildFileTreeFromOPFS = async (directoryHandle: FileSystemDirectoryHandle): Promise<FileTreeItem[]> => {
    try {
      console.log('🟡 Starting file tree rebuild from OPFS...')
      const files = await buildFilteredFileTree(directoryHandle)
      
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
      
      return files
    } catch (error) {
      console.error('🟡 Failed to rebuild file tree from OPFS:', error)
      return []
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

  // Helper to remove handles from file tree for serialization
  const removeHandles = (item: FileTreeItem): Omit<FileTreeItem, 'handle'> => {
    const { handle, ...rest } = item
    return {
      ...rest,
      children: item.children?.map(child => removeHandles(child))
    }
  }

  // File content operations
  const loadFileContent = async (file: FileTreeItem): Promise<{ content: string; fileName: string } | null> => {
    console.log('🟡 loadFileContent called with:', { 
      name: file.name, 
      path: file.path, 
      type: file.type, 
      hasHandle: !!file.handle 
    })
    
    if (file.type !== 'file') {
      console.log('🟡 Not a file, returning')
      return null
    }
    
    if (!file.handle) {
      console.log('🟡 No file handle, returning')
      return null
    }
    
    try {
      console.log('🟡 Attempting to read file content...')
      const fileHandle = file.handle as FileSystemFileHandle
      const fileObj = await fileHandle.getFile()
      const content = await fileObj.text()
      
      console.log('🟡 File content loaded, length:', content.length)
      
      return {
        content,
        fileName: file.path
      }
    } catch (error) {
      console.error('🟡 Error loading file content:', error)
      return null
    }
  }

  // File picker operations
  const showDirectoryPicker = async (options?: {
    mode?: 'read' | 'readwrite'
  }): Promise<FileSystemDirectoryHandle | null> => {
    if (!isFileSystemSupported.value) {
      console.error('File System Access API not supported')
      return null
    }

    try {
      const directoryHandle = await window.showDirectoryPicker({
        mode: options?.mode || 'readwrite'
      })
      return directoryHandle
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error selecting directory:', error)
      }
      return null
    }
  }

  // File validation utilities
  const isValidProjectDirectory = async (directoryHandle: FileSystemDirectoryHandle): Promise<boolean> => {
    try {
      // Check if it's a valid project by looking for common project files
      const entries = []
      for await (const [name] of directoryHandle.entries()) {
        entries.push(name)
        if (entries.length > 50) break // Don't check too many files
      }
      
      // Look for common project indicators
      const projectIndicators = [
        'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
        'Gemfile', 'requirements.txt', 'setup.py', 'pyproject.toml',
        'Cargo.toml', 'go.mod', '.gitignore', 'README.md', 'README.txt'
      ]
      
      return entries.some(name => projectIndicators.includes(name))
    } catch (error) {
      console.warn('Error validating project directory:', error)
      return true // Default to true if we can't validate
    }
  }

  return {
    // State
    isFileSystemSupported,
    
    // File tree operations
    readDirectoryRecursively,
    buildFilteredFileTree,
    rebuildFileTreeFromOPFS,
    checkFileTreeHasHandles,
    countFileTreeNodes,
    removeHandles,
    
    // File content operations
    loadFileContent,
    
    // File picker operations
    showDirectoryPicker,
    
    // Validation utilities
    isValidProjectDirectory
  }
}