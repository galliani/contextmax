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

  // File tree building
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

  // Helper function to rebuild file tree from OPFS
  const rebuildFileTreeFromOPFS = async (directoryHandle: FileSystemDirectoryHandle): Promise<FileTreeItem[]> => {
    try {
      console.log('🟡 Starting file tree rebuild from OPFS...')
      const files = await readDirectoryRecursively(directoryHandle, '')
      
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