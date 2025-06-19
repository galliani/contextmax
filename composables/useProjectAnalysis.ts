/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export interface FileTreeItem {
  path: string
  name: string
  type: 'file' | 'directory'
  handle?: FileSystemDirectoryHandle | FileSystemFileHandle
  children?: FileTreeItem[]
}

export const useProjectAnalysis = () => {
  // Use the core analysis engine
  const smartSuggestionsComposable = useSmartContextSuggestions()
  const loadCachedAnalysis = smartSuggestionsComposable?.loadCachedAnalysis || (async () => {})
  const clearAnalysisState = smartSuggestionsComposable?.clearAnalysisState || (() => {})
  
  // Use the same reactive state instances from the shared composable
  const isAnalyzing = smartSuggestionsComposable?.isAnalyzing || ref(false)
  const analysisProgress = smartSuggestionsComposable?.analysisProgress || ref(0)
  const hasLoadedFromCache = smartSuggestionsComposable?.hasLoadedFromCache || ref(false)

  const { isLanguageSupported } = useRegexCodeParser()

  const accessibilityComposable = useAccessibility()
  const announceStatus = accessibilityComposable?.announceStatus || (() => {})

  // Helper function to get all files from tree
  const getAllFilesFromTree = (tree: FileTreeItem[]): FileTreeItem[] => {
    const files: FileTreeItem[] = []
    
    const traverse = (items: FileTreeItem[]) => {
      if (!Array.isArray(items)) return
      
      for (const item of items) {
        if (item?.type === 'file') {
          files.push(item)
        } else if (item?.children && Array.isArray(item.children)) {
          traverse(item.children)
        }
      }
    }
    
    traverse(tree)
    return files
  }

  // Prepare files for analysis with filtering and content loading
  const prepareFilesForAnalysis = async (rawFiles: FileTreeItem[]): Promise<Array<{ path: string; content: string }>> => {
    if (rawFiles.length === 0) {
      throw new Error('No files found for analysis')
    }

    console.log(`📁 Found ${rawFiles.length} total files in project`)

    // Create gitignore matcher
    announceStatus('Reading .gitignore rules...')
    const { createMatcher } = useGitignore()
    
    const allProjectFilePaths = rawFiles.map(f => ({ path: f.path, handle: f.handle }))
    const gitignoreMatcher = await createMatcher(allProjectFilePaths)

    // Filter files based on gitignore and language support
    announceStatus('Filtering project files based on rules...')
    
    const filesToAnalyzeHandles = rawFiles.filter(file => {
      // Ensure it's a valid file handle
      if (!file.handle || file.type !== 'file') {
        return false
      }

      // Check gitignore
      const relativePath = file.path.startsWith('/') ? file.path.substring(1) : file.path
      if (gitignoreMatcher.ignores(relativePath)) {
        return false
      }

      // Check language support
      return isLanguageSupported(file.path)
    })

    console.log(`🎯 Filtered to ${filesToAnalyzeHandles.length} relevant files for analysis`)

    if (filesToAnalyzeHandles.length === 0) {
      throw new Error('No valid files found for analysis after filtering')
    }

    // Load file content
    announceStatus(`Loading content for ${filesToAnalyzeHandles.length} filtered files...`)

    const filesToAnalyze: Array<{ path: string; content: string }> = []
    
    for (const file of filesToAnalyzeHandles) {
      try {
        const fileHandle = file.handle as FileSystemFileHandle
        const fileObj = await fileHandle.getFile()
        const content = await fileObj.text()
        
        filesToAnalyze.push({
          path: file.path,
          content: content
        })
      } catch (error) {
        console.warn(`Failed to load content for ${file.path}:`, error)
      }
    }

    if (filesToAnalyze.length === 0) {
      throw new Error('No valid files found after content loading')
    }

    console.log(`✅ Successfully loaded ${filesToAnalyze.length} files for analysis`)
    return filesToAnalyze
  }

  // Main project analysis function
  const performProjectAnalysis = async (
    fileTree: FileTreeItem[], 
    options: { 
      silent?: boolean
    } = {}
  ): Promise<{ success: boolean; filesAnalyzed: number }> => {
    try {
      const allFiles = getAllFilesFromTree(fileTree)
      
      if (allFiles.length === 0) {
        if (!options.silent) {
          announceStatus('No files found for analysis')
        }
        return { success: false, filesAnalyzed: 0 }
      }

      // Prepare files for analysis (filtering and content loading)
      const filesToAnalyze = await prepareFilesForAnalysis(allFiles)

      // Run the analysis
      if (!options.silent) {
        announceStatus(`Loading analysis for ${filesToAnalyze.length} files...`)
      }
      console.log(`🧠 Starting analysis of ${filesToAnalyze.length} files...`)
      
      await loadCachedAnalysis(filesToAnalyze)

      const message = `Analysis complete. Ready for search with ${filesToAnalyze.length} files.`
      if (!options.silent) {
        announceStatus(message)
      }
      console.log(`✅ ${message}`)
      
      console.log(`🔍 Post-analysis state check:`, {
        hasLoadedFromCache: hasLoadedFromCache.value,
        filesAnalyzed: filesToAnalyze.length
      })

      return { success: true, filesAnalyzed: filesToAnalyze.length }
    } catch (error) {
      console.error('Project analysis failed:', error)
      const errorMessage = `Analysis failed: ${error instanceof Error ? error.message : 'Please try again.'}`
      
      if (!options.silent) {
        announceStatus(errorMessage)
      }
      
      return { success: false, filesAnalyzed: 0 }
    }
  }

  return {
    // State
    isAnalyzing: readonly(isAnalyzing),
    analysisProgress: readonly(analysisProgress),
    hasLoadedFromCache: readonly(hasLoadedFromCache),
    
    // Methods
    performProjectAnalysis,
    clearAnalysisState,
    
    // Utilities
    getAllFilesFromTree,
    prepareFilesForAnalysis
  }
}