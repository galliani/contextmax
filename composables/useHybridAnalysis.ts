/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { SmartSuggestion } from './useSmartContextSuggestions'

interface FileTreeItem {
  path: string
  name: string
  type: 'file' | 'directory'
  handle?: FileSystemDirectoryHandle | FileSystemFileHandle
  children?: FileTreeItem[]
}

export const useHybridAnalysis = () => {
  // IMPORTANT: Use the same shared global instance that SmartSuggestionsPanel uses
  // This ensures state consistency across all components
  const smartSuggestionsComposable = useSmartContextSuggestions()
  const analyzeProject = smartSuggestionsComposable?.analyzeProject || (async () => {})
  const generateSuggestions = smartSuggestionsComposable?.generateSuggestions || (() => [])
  const clearAnalysisState = smartSuggestionsComposable?.clearAnalysisState || (() => {})
  
  // Use the SAME reactive state instances from the shared composable
  const isAnalyzing = smartSuggestionsComposable?.isAnalyzing || ref(false)
  const analysisProgress = smartSuggestionsComposable?.analysisProgress || ref(0)
  const extractedKeywords = smartSuggestionsComposable?.extractedKeywords || ref([])
  const hasLoadedFromCache = smartSuggestionsComposable?.hasLoadedFromCache || ref(false)

  const treeSitterComposable = useTreeSitter()
  const initializeParser = treeSitterComposable?.initializeParser || (async () => false)
  const isInitialized = treeSitterComposable?.isInitialized || ref(false)
  const isLanguageSupported = treeSitterComposable?.isLanguageSupported || (() => false)

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

  // Extracted function for preparing files for analysis
  const prepareFilesForAnalysis = async (rawFiles: FileTreeItem[]): Promise<Array<{ path: string; content: string }>> => {
    if (rawFiles.length === 0) {
      throw new Error('No files found for analysis')
    }

    console.log(`📁 Found ${rawFiles.length} total files in project`)

    // --- 1. Create the Intelligent Matcher ---
    announceStatus('Reading .gitignore rules...')
    const { createMatcher } = useGitignore()
    
    // We only need paths and handles for this step
    const allProjectFilePaths = rawFiles.map(f => ({ path: f.path, handle: f.handle }))
    const gitignoreMatcher = await createMatcher(allProjectFilePaths)

    // --- 2. Pre-computation Filtering ---
    announceStatus('Filtering project files based on rules...')
    
    const filesToAnalyzeHandles = rawFiles.filter(file => {
      // First, ensure it's a valid file handle
      if (!file.handle || file.type !== 'file') {
        return false
      }

      // Use the gitignore matcher to check if the path should be excluded
      const relativePath = file.path.startsWith('/') ? file.path.substring(1) : file.path
      if (gitignoreMatcher.ignores(relativePath)) {
        return false // If the matcher says to ignore it, we discard it
      }

      // If not ignored, finally check if the language is supported by tree-sitter
      return isLanguageSupported(file.path)
    })

    console.log(`🎯 Filtered to ${filesToAnalyzeHandles.length} relevant files for analysis`)

    if (filesToAnalyzeHandles.length === 0) {
      throw new Error('No valid files found for analysis after filtering')
    }

    // --- 3. Load File Content ---
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

    console.log(`✅ Successfully loaded ${filesToAnalyze.length} files for hybrid analysis`)
    return filesToAnalyze
  }

  // Main analysis function that can be called from anywhere
  const performHybridAnalysis = async (
    fileTree: FileTreeItem[], 
    options: { 
      silent?: boolean,
      onComplete?: (suggestions: SmartSuggestion[]) => void 
    } = {}
  ): Promise<{ success: boolean; suggestions: SmartSuggestion[] }> => {
    try {
      const allFiles = getAllFilesFromTree(fileTree)
      
      if (allFiles.length === 0) {
        if (!options.silent) {
          announceStatus('No files found for analysis')
        }
        return { success: false, suggestions: [] }
      }

      // Initialize tree-sitter if not already done
      if (!isInitialized?.value) {
        if (!options.silent) {
          announceStatus('Initializing code parser...')
        }
        const success = await initializeParser()
        if (!success) {
          if (!options.silent) {
            announceStatus('Failed to initialize code parser')
          }
          return { success: false, suggestions: [] }
        }
      }

      // Prepare files for analysis (filtering and content loading)
      const filesToAnalyze = await prepareFilesForAnalysis(allFiles)

      // Run the actual analysis
      if (!options.silent) {
        announceStatus(`Analyzing ${filesToAnalyze.length} files with hybrid approach...`)
      }
      console.log(`🧠 Starting hybrid analysis of ${filesToAnalyze.length} files...`)
      
      await analyzeProject(filesToAnalyze)

      // Generate traditional suggestions
      const newSuggestions = generateSuggestions(filesToAnalyze) || []

      const message = `Hybrid analysis complete. Found ${newSuggestions.length} suggestions. Ready for keyword search.`
      if (!options.silent) {
        announceStatus(message)
      }
      console.log(`✅ ${message}`)
      
      // Add debug logging to verify keywords are set
      console.log(`🔍 Post-analysis keyword check:`, {
        extractedKeywordsLength: extractedKeywords.value?.length || 0,
        hasLoadedFromCache: hasLoadedFromCache.value,
        sampleKeywords: extractedKeywords.value?.slice(0, 3) || []
      })

      // Call completion callback if provided
      options.onComplete?.(newSuggestions)

      return { success: true, suggestions: newSuggestions }
    } catch (error) {
      console.error('Hybrid analysis failed:', error)
      const errorMessage = `Analysis failed: ${error instanceof Error ? error.message : 'Please try again.'}`
      
      if (!options.silent) {
        announceStatus(errorMessage)
      }
      
      return { success: false, suggestions: [] }
    }
  }

  return {
    // State
    isAnalyzing: readonly(isAnalyzing),
    analysisProgress: readonly(analysisProgress),
    extractedKeywords: readonly(extractedKeywords),
    hasLoadedFromCache: readonly(hasLoadedFromCache),
    
    // Methods
    performHybridAnalysis,
    clearAnalysisState,
    
    // Utilities
    getAllFilesFromTree,
    prepareFilesForAnalysis
  }
} 