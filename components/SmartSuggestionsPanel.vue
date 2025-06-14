/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
<template>
  <div class="bg-white dark:bg-gray-900">
    <!-- Header -->
    <div class="border-b bg-gray-50 dark:bg-gray-800 p-8">
      <div class="flex items-center space-x-2">
        <h3 class="pb-3 mb-2 text-mobile-subheading sm:text-lg lg:text-2xl font-semibold">
          Hybrid Keyword Search
        </h3>
      </div>
      
      <!-- Progress Bar -->
      <div v-if="isAnalyzing" class="w-full bg-muted rounded-full h-2 mb-4">
        <div 
          class="bg-primary h-2 rounded-full transition-all duration-300"
          :style="{ width: `${analysisProgress}%` }"
        />
      </div>

      <!-- Hybrid Keyword Search -->
      <div v-if="hasAnalyzed && !isAnalyzing" class="mt-4">
        <div class="space-y-3">
          <!-- Suggested Keywords (shown after analysis) -->
          <div v-if="extractedKeywords.length > 0" class="mt-4">
            <div class="flex items-center space-x-2 mb-3">
              <Icon name="lucide:lightbulb" class="w-4 h-4 text-yellow-500" />
              <h4 class="text-sm font-medium text-foreground">Suggested Domain Keywords</h4>
            </div>
            
            <div class="flex flex-wrap gap-2">
              <button
                v-for="keyword in extractedKeywords.slice(0, 12)"
                :key="keyword.keyword"
                class="inline-flex items-center px-3 py-1.5 cursor-pointer text-xs font-medium rounded-full border transition-colors hover:bg-primary/10 hover:border-primary/20 bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400"
                @click="quickSearch(keyword.keyword)"
              >
                <span>{{ keyword.keyword }}</span>
                <span class="ml-1 text-xs opacity-60">({{ keyword.frequency }})</span>
              </button>
            </div>
            
            <div class="text-xs text-muted-foreground mt-4">
              💡 Click any keyword for instant search • Business entities and domain concepts or search it by yourself
            </div>
          </div>
          <div class="flex space-x-2">
            <div class="flex-1">
              <Input
                v-model="searchKeyword"
                placeholder="Search for features like 'auth', 'user', 'api'..."
                class="text-sm"
                @keyup.enter="performKeywordSearch"
              />
            </div>
            <Button 
              :disabled="!searchKeyword.trim() || isSearching"
              size="sm"
              @click="performKeywordSearch"
            >
              <Icon 
                :name="isSearching ? 'lucide:loader-2' : 'lucide:search'"
                class="w-4 h-4"
                :class="{ 'animate-spin': isSearching }"
              />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="p-4 bg-white dark:bg-gray-900">
      <!-- No Files State -->
      <div 
        v-if="!hasFiles" 
        class="text-center py-8 px-4"
      >
        <div class="w-16 h-16 mx-auto mb-4 bg-muted/30 rounded-full flex items-center justify-center">
          <Icon name="lucide:folder-open" class="w-8 h-8 text-muted-foreground" />
        </div>
        <h4 class="text-lg font-semibold text-foreground mb-2">
          No Project Files
        </h4>
        <p class="text-sm text-muted-foreground">
          Load a project to see smart suggestions based on code analysis.
        </p>
      </div>

      <!-- Not Analyzed State -->
      <div 
        v-else-if="!hasAnalyzed && !isAnalyzing" 
        class="text-center py-8 px-4"
      >
        <div class="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
          <Icon name="lucide:brain" class="w-8 h-8 text-primary" />
        </div>
        <h4 class="text-lg font-semibold text-foreground mb-2">
          Ready for Hybrid Analysis
        </h4>
        <p class="text-sm text-muted-foreground mb-4">
          Analyze your project with both AST parsing and LLM embeddings to get intelligent suggestions and powerful keyword search.
        </p>
        <Button class="px-6" @click="analyzeBtnClicked">
          <Icon name="lucide:brain" class="w-4 h-4 mr-2" />
          Start Hybrid Analysis
        </Button>
      </div>

      <!-- Analysis Complete - Ready for Search -->
      <div v-else-if="hasAnalyzed && !isAnalyzing && !keywordSearchResults" class="text-center py-8 px-4">
        <div class="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
          <Icon name="lucide:check-circle" class="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h4 class="text-lg font-semibold text-foreground mb-2">
          Analysis Complete!
        </h4>
        <p class="text-sm text-muted-foreground mb-4">
          <span v-if="hasLoadedFromCache">
            Domain keywords loaded from cache! Your project analysis is ready for instant search.
          </span>
          <span v-else>
            Your project has been analyzed with both AST parsing and LLM embeddings. Use the keyword search above to find relevant files with intelligent ranking.
          </span>
        </p>
        <div class="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <div class="flex items-center justify-center space-x-4">
            <div class="text-center">
              <div class="font-medium">🕵️ AST Analysis</div>
              <div class="text-xs">Code structure parsed</div>
            </div>
            <div class="text-center">
              <div class="font-medium">🧠 LLM Embeddings</div>
              <div class="text-xs">
                <span v-if="hasLoadedFromCache">Loaded from cache</span>
                <span v-else>Semantic understanding ready</span>
              </div>
            </div>
            <div v-if="hasLoadedFromCache" class="text-center">
              <div class="font-medium">💾 Cache</div>
              <div class="text-xs">Instant loading</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Keyword Search Results -->
      <div v-else-if="keywordSearchResults" class="space-y-6">

        <!-- Search Results List -->
        <div class="space-y-4">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-lg font-semibold text-foreground">
              Search Results for "{{ keywordSearchResults.data.keyword }}"
            </h4>
            <span class="text-sm text-muted-foreground">
              {{ keywordSearchResults.data.files.length }} files found
            </span>
          </div>
          
          <div
            v-for="result in keywordSearchResults.data.files.slice(0, 10)"
            :key="result.file"
            class="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow"
            :class="{
              'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950': result.hasSynergy,
              'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950': result.llmScore > 0 && !result.hasSynergy,
              'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800': result.astScore > 0 && result.llmScore === 0
            }"
          >
            <!-- File Header -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center space-x-2 min-w-0">
                <span class="font-mono text-sm font-semibold break-all">{{ result.file }}</span>
              </div>
            </div>

            <!-- Score and Action Buttons -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center space-x-2 min-w-0">
                <span class="font-mono text-sm font-semibold break-all">Score: {{ result.finalScore.toFixed(3) }}</span>
              </div>
              <div class="text-xs font-medium">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="inline-block">
                      <Button
                        size="sm"
                        variant="outline"
                        :disabled="!hasActiveContextSet"
                        @click="addFileToContext(result.file)"
                      >
                        <Icon name="lucide:plus" class="w-4 h-4 mr-1" />
                        Add to Context
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p v-if="!hasActiveContextSet">Create or select a context set first from the left sidebar</p>
                    <p v-else>Add this file to the active context set</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              </div>
            </div>
          </div>
          
          <!-- Show More Button -->
          <div 
            v-if="keywordSearchResults.data.files.length > 10"
            class="text-center py-4"
          >
            <Button
              variant="outline"
              @click="createContextFromSearch(keywordSearchResults)"
            >
              <Icon name="lucide:folder-plus" class="w-4 h-4 mr-1" />
              Create Context Set from All {{ keywordSearchResults.data.files.length }} Results
            </Button>
          </div>
        </div>
      </div>


    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { SmartSuggestion, KeywordSearchSuggestion } from '@/composables/useSmartContextSuggestions'

// Get shared state from smart suggestions composable (this is the source of truth)
const smartSuggestionsComposable = useSmartContextSuggestions()
const isAnalyzing = smartSuggestionsComposable?.isAnalyzing || ref(false)
const analysisProgress = smartSuggestionsComposable?.analysisProgress || ref(0)
const extractedKeywords = smartSuggestionsComposable?.extractedKeywords || ref([])
const hasLoadedFromCache = smartSuggestionsComposable?.hasLoadedFromCache || ref(false)
const clearAnalysisState = smartSuggestionsComposable?.clearAnalysisState || (() => {})
const performHybridKeywordSearch = smartSuggestionsComposable?.performHybridKeywordSearch || (async () => ({} as KeywordSearchSuggestion))
const loadCachedKeywords = smartSuggestionsComposable?.loadCachedKeywords || (async () => false)

// Use hybrid analysis for manual trigger
const hybridAnalysis = useHybridAnalysis()
const { performHybridAnalysis } = hybridAnalysis

const projectStore = useProjectStore()
const fileTree = projectStore?.fileTree || ref([])
const activeContextSetName = projectStore?.activeContextSetName || ref('')
const createContextSet = projectStore?.createContextSet || (() => {})
const setActiveContextSet = projectStore?.setActiveContextSet || (() => {})
const addFileToActiveContextSet = projectStore?.addFileToActiveContextSet || (() => false)

const accessibilityComposable = useAccessibility()
const announceStatus = accessibilityComposable?.announceStatus || (() => {})

// Local state
const suggestions = ref<SmartSuggestion[]>([])
const keywordSearchResults = ref<KeywordSearchSuggestion | null>(null)
const searchKeyword = ref('')
const isSearching = ref(false)

// Computed hasAnalyzed based on extracted keywords or cache
const hasAnalyzed = computed(() => {
  try {
    const keywordsLength = extractedKeywords.value.length
    const loadedFromCache = hasLoadedFromCache.value
    const result = keywordsLength > 0 || loadedFromCache
    
    // Debug logging
    console.log('🔍 SmartSuggestionsPanel hasAnalyzed check:', {
      keywordsLength,
      loadedFromCache,
      result,
      extractedKeywords: extractedKeywords.value.slice(0, 3) // First 3 keywords for debugging
    })
    
    return result
  } catch (error) {
    console.warn('Error checking analysis state:', error)
    return false
  }
})

// File tree item interface
interface FileTreeItem {
  path: string
  name: string
  type: 'file' | 'directory'
  handle?: FileSystemDirectoryHandle | FileSystemFileHandle
  children?: FileTreeItem[]
}

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

// Computed
const allFiles = computed(() => {
  try {
    const treeValue = fileTree?.value || []
    return getAllFilesFromTree(treeValue)
  } catch (error) {
    console.warn('Error getting all files:', error)
    return []
  }
})

const hasFiles = computed(() => {
  try {
    return allFiles.value.length > 0
  } catch (error) {
    console.warn('Error accessing files:', error)
    return false
  }
})

const hasActiveContextSet = computed(() => {
  try {
    return !!(activeContextSetName.value && activeContextSetName.value.trim())
  } catch (error) {
    console.warn('Error checking active context set:', error)
    return false
  }
})

// No longer need these computeds since we don't show traditional suggestions

// Helper function to find a file in the file tree by path
const findFileInTree = (filePath: string): FileTreeItem | null => {
  try {
    return allFiles.value.find(file => file?.path === filePath) || null
  } catch (error) {
    console.warn('Error searching file tree:', error)
    return null
  }
}

// Methods
const addFileToContext = (filePath: string) => {
  try {
    const fileItem = findFileInTree(filePath)
    if (fileItem) {
      const success = addFileToActiveContextSet(fileItem)
      if (success) {
        announceStatus(`Added ${filePath} to context set`)
      } else {
        announceStatus(`Failed to add ${filePath} to context set`)
      }
    } else {
      announceStatus(`File ${filePath} not found in project`)
    }
  } catch (error) {
    announceStatus(`Error adding file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const analyzeBtnClicked = async () => {
  try {
    if (!hasFiles.value) return

    const result = await performHybridAnalysis(allFiles.value, {
      onComplete: (newSuggestions) => {
        suggestions.value = newSuggestions
      }
    })

    if (!result.success) {
      console.warn('Hybrid analysis completed but returned unsuccessful result')
    }
  } catch (error) {
    console.error('Analysis failed:', error)
    announceStatus(`Analysis failed: ${error instanceof Error ? error.message : 'Please try again.'}`)
  }
}

const performKeywordSearch = async () => {
  if (!searchKeyword.value.trim() || !hasAnalyzed.value) return

  isSearching.value = true
  
  try {
    // Get files for search
    const files = allFiles.value
    const filesToSearch: Array<{ path: string; content: string }> = []
    
    for (const file of files) {
      try {
        if (file.handle && file.type === 'file') {
          const fileHandle = file.handle as FileSystemFileHandle
          const fileObj = await fileHandle.getFile()
          const content = await fileObj.text()
          
          filesToSearch.push({
            path: file.path,
            content: content
          })
        }
      } catch (error) {
        console.warn(`Failed to load content for search: ${file.path}:`, error)
      }
    }

    console.log(`🔍 Performing hybrid search for: "${searchKeyword.value}"`)
    const searchResults = await performHybridKeywordSearch(searchKeyword.value, filesToSearch)
    
    keywordSearchResults.value = searchResults

    announceStatus(`Search complete. Found ${searchResults.data.files.length} relevant files.`)
  } catch (error) {
    console.error('Keyword search failed:', error)
    announceStatus('Search failed. Please try again.')
  } finally {
    isSearching.value = false
  }
}

const quickSearch = (keyword: string) => {
  searchKeyword.value = keyword
  performKeywordSearch()
}

const createContextFromSearch = (suggestion: KeywordSearchSuggestion) => {
  try {
    const contextName = `${suggestion.data.keyword}_search`
    
    // Create the context set
    createContextSet(contextName)
    setActiveContextSet(contextName)
    
    // Add top files to the context set
    let addedCount = 0
    for (const result of suggestion.data.files.slice(0, 10)) {
      const fileItem = findFileInTree(result.file)
      if (fileItem) {
        try {
          const success = addFileToActiveContextSet(fileItem)
          if (success) addedCount++
        } catch (error) {
          console.warn(`Failed to add file ${result.file}:`, error)
        }
      }
    }
    
    announceStatus(`Created context set "${contextName}" with ${addedCount} files from search results`)
    
  } catch (error) {
    announceStatus(`Failed to create context set: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Load cached keywords when files are available
const tryLoadCachedKeywords = async () => {
  if (!hasFiles.value) {
    console.log('📭 No files available, skipping cache load')
    return
  }
  
  try {
    console.log('🔍 Attempting to load cached keywords for current project...')
    
    // Get all files from the tree
    const files = allFiles.value
    console.log(`📁 Current project has ${files.length} files`)
    
    // Prepare files for cache lookup (filtering and content loading)
    const { prepareFilesForAnalysis } = hybridAnalysis
    const filesToAnalyze = await prepareFilesForAnalysis(files)
    console.log(`🎯 Prepared ${filesToAnalyze.length} files for cache lookup`)
    
    // Try to load cached keywords
    const loaded = await loadCachedKeywords(filesToAnalyze)
    if (loaded) {
      announceStatus(`Loaded ${extractedKeywords.value.length} cached domain keywords`)
      console.log('🎯 Successfully loaded cached domain keywords for this project')
    } else {
      console.log('📭 No cached keywords found for this project')
    }
  } catch (error) {
    console.warn('Failed to load cached keywords:', error)
  }
}

// Clear suggestions when files change and try to load cache
watch(() => fileTree?.value, async (newTree, _oldTree) => {
  try {
    if (newTree) {
      // Clear all local state first
      suggestions.value = []
      keywordSearchResults.value = null
      searchKeyword.value = ''
      
      // Clear analysis state from the composable (keywords, embeddings, etc.)
      // But give a small delay to avoid interfering with automatic analysis
      clearAnalysisState()
      
      console.log('🔄 Project switched, cleared analysis state')
      
      // Small delay to ensure UI updates and let automatic analysis start
      await nextTick()
      
      // Give time for automatic analysis to complete before trying cache
      setTimeout(async () => {
        try {
          if (hasFiles.value && extractedKeywords.value.length === 0) {
            console.log('🔍 Attempting delayed cache load after project switch...')
            await tryLoadCachedKeywords()
          }
        } catch (error) {
          console.warn('Error in delayed cache load:', error)
        }
      }, 2000) // 2 second delay to let automatic analysis complete
    }
  } catch (error) {
    console.warn('Error in fileTree watcher:', error)
  }
}, { immediate: false })

// Debug watcher to monitor state changes
watch([extractedKeywords, hasLoadedFromCache], ([keywords, fromCache], [prevKeywords, prevFromCache]) => {
  console.log('🔍 SmartSuggestionsPanel state changed:', {
    keywords: keywords.length,
    keywordsList: keywords.slice(0, 3),
    fromCache,
    prevKeywords: prevKeywords?.length || 0,
    prevFromCache
  })
}, { immediate: true, deep: true })

// Also try to load on component mount if files are already available
onMounted(() => {
  nextTick(() => {
    console.log('🔍 SmartSuggestionsPanel mounted with state:', {
      hasFiles: hasFiles.value,
      extractedKeywords: extractedKeywords.value.length,
      hasLoadedFromCache: hasLoadedFromCache.value
    })
    
    if (hasFiles.value) {
      tryLoadCachedKeywords()
    }
  })
})
</script>

 