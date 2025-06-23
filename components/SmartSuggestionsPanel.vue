<!--
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->
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
      <div v-if="hasFiles && !isAnalyzing" id="smart-suggestions-search-bar" class="mt-4">
        <div class="space-y-3">
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

      <!-- Ready for Search State -->
      <div 
        v-else-if="hasFiles && !isAnalyzing && !keywordSearchResults" 
        class="text-center py-8 px-4"
      >
        <div class="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
          <Icon name="lucide:search" class="w-8 h-8 text-primary" />
        </div>
        <h4 class="text-lg font-semibold text-foreground mb-2">
          Ready to Search
        </h4>
        <p class="text-sm text-muted-foreground mb-4">
          Use the search bar above to find relevant files with intelligent hybrid ranking. The search combines AST parsing and LLM embeddings for the best results.
        </p>
        <div class="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <div class="flex items-center justify-center space-x-4">
            <div class="text-center">
              <div class="font-medium">🕵️ AST Analysis</div>
              <div class="text-xs">Real-time structure parsing</div>
            </div>
            <div class="text-center">
              <div class="font-medium">🧠 LLM Embeddings</div>
              <div class="text-xs">On-demand semantic analysis</div>
            </div>
            <div class="text-center">
              <div class="font-medium">⚡ Hybrid</div>
              <div class="text-xs">Best of both approaches</div>
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

            <!-- Score and Classification Info -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center space-x-3 min-w-0">
                <div class="flex items-center space-x-2">
                  <span class="font-mono text-sm font-semibold text-primary">{{ result.scorePercentage || Math.round(result.finalScore * 100) }}%</span>
                  <div class="text-xs text-muted-foreground">
                    ({{ result.finalScore.toFixed(3) }})
                  </div>
                </div>
                <div v-if="result.classification" class="flex items-center space-x-1">
                  <span class="text-xs px-2 py-1 rounded-full font-medium"
                        :class="{
                          'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300': result.classification === 'entry-point',
                          'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300': result.classification === 'core-logic',
                          'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300': result.classification === 'helper',
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300': result.classification === 'config',
                          'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300': result.classification === 'unrelated' || result.classification === 'unknown'
                        }">
                    {{ result.classification }}
                  </span>
                </div>
                <div v-if="result.workflowPosition && result.workflowPosition !== 'unknown' && result.workflowPosition !== 'unrelated'" class="text-xs text-muted-foreground">
                  {{ result.workflowPosition }}
                </div>
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
import { logger } from '~/utils/logger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { SmartSuggestion, KeywordSearchSuggestion } from '@/composables/useSmartContextSuggestions'

// Get shared state from smart suggestions composable (this is the source of truth)
const smartSuggestionsComposable = useSmartContextSuggestions()
const isAnalyzing = smartSuggestionsComposable?.isAnalyzing || ref(false)
const analysisProgress = smartSuggestionsComposable?.analysisProgress || ref(0)
const clearAnalysisState = smartSuggestionsComposable?.clearAnalysisState || (() => {})
const performHybridKeywordSearch = smartSuggestionsComposable?.performHybridKeywordSearch || (async () => ({} as KeywordSearchSuggestion))

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

// Note: hasAnalyzed is no longer needed since search works on-demand

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
    logger.warn('Error getting all files:', error)
    return []
  }
})

const hasFiles = computed(() => {
  try {
    return allFiles.value.length > 0
  } catch (error) {
    logger.warn('Error accessing files:', error)
    return false
  }
})

const hasActiveContextSet = computed(() => {
  try {
    return !!(activeContextSetName.value && activeContextSetName.value.trim())
  } catch (error) {
    logger.warn('Error checking active context set:', error)
    return false
  }
})

// No longer need these computeds since we don't show traditional suggestions

// Helper function to find a file in the file tree by path
const findFileInTree = (filePath: string): FileTreeItem | null => {
  try {
    return allFiles.value.find(file => file?.path === filePath) || null
  } catch (error) {
    logger.warn('Error searching file tree:', error)
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

// Note: Manual analysis button is no longer needed since search works on-demand

const performKeywordSearch = async () => {
  if (!searchKeyword.value.trim() || !hasFiles.value) return

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
        logger.warn(`Failed to load content for search: ${file.path}:`, error)
      }
    }

    const searchResults = await performHybridKeywordSearch(searchKeyword.value, filesToSearch)
    
    keywordSearchResults.value = searchResults

    announceStatus(`Search complete. Found ${searchResults.data.files.length} relevant files.`)
  } catch (error) {
    logger.error('Keyword search failed:', error)
    announceStatus('Search failed. Please try again.')
  } finally {
    isSearching.value = false
  }
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
          logger.warn(`Failed to add file ${result.file}:`, error)
        }
      }
    }
    
    announceStatus(`Created context set "${contextName}" with ${addedCount} files from search results`)
    
  } catch (error) {
    announceStatus(`Failed to create context set: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Note: Keyword loading is no longer needed since search works on-demand

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
      
      
      // Small delay to ensure UI updates and let automatic analysis start
      await nextTick()
      
      // Note: No need for analysis delay since search works on-demand
    }
  } catch (error) {
    logger.warn('Error in fileTree watcher:', error)
  }
}, { immediate: false })

// Note: State monitoring simplified since search works on-demand

// Note: No setup needed on mount since search works on-demand
</script>

 